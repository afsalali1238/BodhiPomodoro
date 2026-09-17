// @ts-check
/**
 * @fileoverview High-efficiency foreground-window watcher for Windows.
 * Uses a lightweight native C# helper compiled on the fly with Windows built-in csc.exe,
 * with automatic fallback to PowerShell.
 */
const { spawn, execFile, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} ActiveWindowSample
 * @property {string} t Window title
 * @property {string} p Process name
 * @property {number} x Screen X
 * @property {number} y Screen Y
 * @property {number} w Window width
 * @property {number} h Window height
 * @property {{x: number, y: number, width: number, height: number}} [dip] DIP-scaled bounds
 */

const CS_SOURCE = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Diagnostics;

class BodhiWatcher {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);

  static string Escape(string s) {
    if (s == null) return "";
    return s.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "").Replace("\n", " ");
  }

  static void Main(string[] args) {
    Console.OutputEncoding = Encoding.UTF8;
    if (args.Length > 0 && args[0] == "--list-apps") {
      Process[] procs = Process.GetProcesses();
      bool first = true;
      Console.Write("[");
      foreach (Process p in procs) {
        try {
          if (p.MainWindowHandle != IntPtr.Zero && !string.IsNullOrEmpty(p.MainWindowTitle)) {
            if (!first) Console.Write(",");
            Console.Write(string.Format("{{\"p\":\"{0}\",\"t\":\"{1}\"}}", Escape(p.ProcessName), Escape(p.MainWindowTitle)));
            first = false;
          }
        } catch {}
      }
      Console.WriteLine("]");
      return;
    }

    StringBuilder sb = new StringBuilder(512);
    while (true) {
      try {
        IntPtr h = GetForegroundWindow();
        if (h != IntPtr.Zero) {
          sb.Length = 0;
          GetWindowText(h, sb, 512);
          uint pid = 0;
          GetWindowThreadProcessId(h, out pid);
          string pName = "";
          try {
            using (Process p = Process.GetProcessById((int)pid)) {
              pName = p.ProcessName;
            }
          } catch {}
          RECT r;
          GetWindowRect(h, out r);
          int w = r.Right - r.Left;
          int ht = r.Bottom - r.Top;
          Console.WriteLine(string.Format("{{\"t\":\"{0}\",\"p\":\"{1}\",\"x\":{2},\"y\":{3},\"w\":{4},\"h\":{5}}}",
            Escape(sb.ToString()), Escape(pName), r.Left, r.Top, w, ht));
        }
      } catch {}
      Thread.Sleep(1500);
    }
  }
}
`;

const PS_SOURCE = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class BodhiFg {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
"@
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
while ($true) {
  $h = [BodhiFg]::GetForegroundWindow()
  $sb = New-Object System.Text.StringBuilder 512
  [void][BodhiFg]::GetWindowText($h, $sb, 512)
  $procId = 0
  [void][BodhiFg]::GetWindowThreadProcessId($h, [ref]$procId)
  $name = ''
  try { $name = (Get-Process -Id $procId).ProcessName } catch {}
  $r = New-Object BodhiFg+RECT
  [void][BodhiFg]::GetWindowRect($h, [ref]$r)
  $o = @{ t = $sb.ToString(); p = $name; x = $r.Left; y = $r.Top; w = ($r.Right - $r.Left); h = ($r.Bottom - $r.Top) }
  [Console]::Out.WriteLine(($o | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
  Start-Sleep -Milliseconds 1500
}
`;

const { app } = require('electron');

/**
 * Ensures native helper binary exists or compiles it via csc.exe.
 * @returns {string|null} Path to the compiled exe or null if unavailable.
 */
function getNativeBinary() {
  if (process.platform !== 'win32') return null;
  const targetDir = path.join(app ? app.getPath('userData') : process.cwd(), 'bin');
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  } catch (e) {
    // If this directory truly can't be created, compilation below will fail
    // too and we fall back to the PowerShell watcher — but log it so a
    // permissions issue isn't a total mystery.
    console.warn(`[watcher] Could not create ${targetDir}:`, e.message);
  }
  const exePath = path.join(targetDir, 'bodhi-watcher.exe');

  if (fs.existsSync(exePath)) return exePath;

  const cscCandidates = [
    'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe',
    'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe'
  ];
  const csc = cscCandidates.find(p => fs.existsSync(p));
  if (!csc) return null;

  try {
    const csFile = path.join(targetDir, 'BodhiWatcher.cs');
    fs.writeFileSync(csFile, CS_SOURCE, 'utf8');
    execFileSync(csc, ['/nologo', '/optimize', '/target:exe', `/out:${exePath}`, csFile], { windowsHide: true, timeout: 15000 });
    try {
      fs.unlinkSync(csFile);
    } catch (cleanupErr) {
      // Leftover .cs source file is harmless; just note it.
      console.warn(`[watcher] Could not remove temporary source file ${csFile}:`, cleanupErr.message);
    }
    if (fs.existsSync(exePath)) return exePath;
  } catch (e) {
    console.warn('[watcher] Native compilation fallback:', e.message);
  }
  return null;
}

/**
 * Starts active window sampling loop.
 * @param {(sample: ActiveWindowSample) => void} onSample
 * @param {(err: Error) => void} [onError]
 * @returns {{available: boolean, stop: () => void}}
 */
function startWatcher(onSample, onError) {
  if (process.platform !== 'win32') return { stop() {}, available: false };

  const nativeExe = getNativeBinary();
  let child = /** @type {import('child_process').ChildProcess|null} */ (null);
  let stopped = false;
  let buf = '';

  const handleStdout = (/** @type {string} */ d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      try {
        onSample(JSON.parse(line));
      } catch {
        // Intentionally silent: a line can legitimately be malformed if the
        // watcher process was killed mid-write, or if a window title contains
        // characters the escaper missed. This runs multiple times per second,
        // so we don't log here to avoid spamming stderr.
      }
    }
  };

  const launch = () => {
    if (stopped) return;
    if (nativeExe && fs.existsSync(nativeExe)) {
      child = spawn(nativeExe, [], { windowsHide: true });
    } else {
      const targetDir = path.join(app ? app.getPath('userData') : process.cwd(), 'bin');
      try {
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      } catch (e) {
        console.warn(`[watcher] Could not create ${targetDir}:`, e.message);
      }
      const psFile = path.join(targetDir, 'bodhi-watcher.ps1');
      fs.writeFileSync(psFile, PS_SOURCE, 'utf8');
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', psFile],
        { windowsHide: true });
    }

    if (child.stdout) {
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', handleStdout);
    }
    child.on('exit', () => {
      if (!stopped) setTimeout(launch, 5000);
    });
    child.on('error', e => onError && onError(e));
  };

  launch();
  return {
    available: true,
    stop() {
      stopped = true;
      try {
        if (child) child.kill();
      } catch {
        // The child process may have already exited; killing it again is a no-op.
      }
    }
  };
}

// Friendly process name map
const FRIENDLY = {
  chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', brave: 'Brave', code: 'VS Code', winword: 'Word',
  excel: 'Excel', powerpnt: 'PowerPoint', outlook: 'Outlook', 'ms-teams': 'Teams', teams: 'Teams', notion: 'Notion',
  figma: 'Figma', whatsapp: 'WhatsApp', telegram: 'Telegram', slack: 'Slack', spotify: 'Spotify', obsidian: 'Obsidian',
  acrobat: 'Acrobat', acrord32: 'Acrobat Reader', notepad: 'Notepad', windowsterminal: 'Terminal', cursor: 'Cursor',
  antigravity: 'Antigravity', claude: 'Claude', chatgpt: 'ChatGPT', zoom: 'Zoom'
};

const HIDE = [
  'explorer', 'shellexperiencehost', 'searchhost', 'startmenuexperiencehost', 'textinputhost', 'systemsettings',
  'lockapp', 'electron', 'bodhi pomodoro', 'powershell', 'nvidia share', 'rtkuwp'
];

/**
 * Returns a list of applications with visible windows.
 * @returns {Promise<Array<{process: string, name: string, title: string}>>}
 */
function listApps() {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve([]);

    const parseOutput = (/** @type {string} */ out) => {
      let rows;
      try { rows = JSON.parse(out); } catch { return resolve([]); }
      if (!Array.isArray(rows)) rows = [rows];
      const seen = new Map();
      for (const r of rows) {
        const key = String(r.p || '').toLowerCase();
        if (!key || HIDE.includes(key)) continue;
        const name = key === 'applicationframehost' ? String(r.t || '').slice(0, 50) : (FRIENDLY[key] || r.p);
        if (name) seen.set(key + '|' + name, { process: r.p, name, title: String(r.t || '').slice(0, 80) });
      }
      resolve([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
    };

    const nativeExe = getNativeBinary();
    if (nativeExe && fs.existsSync(nativeExe)) {
      execFile(nativeExe, ['--list-apps'], { windowsHide: true, timeout: 5000 }, (err, out) => {
        if (!err && out && out.trim()) {
          return parseOutput(out);
        }
        // Fallback to powershell on error
        runPsListApps(parseOutput, resolve);
      });
    } else {
      runPsListApps(parseOutput, resolve);
    }
  });
}

function runPsListApps(parseOutput, resolve) {
  const cmd = "Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { [pscustomobject]@{ p = $_.ProcessName; t = $_.MainWindowTitle } } | ConvertTo-Json -Compress";
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd],
    { windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024 }, (err, out) => {
      if (err || !out.trim()) return resolve([]);
      parseOutput(out);
    });
}

module.exports = {
  startWatcher,
  listApps
};
