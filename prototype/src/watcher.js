// Foreground-window watcher for Windows using one long-lived PowerShell process.
// No native modules: user32 calls via Add-Type. Emits {t: title, p: process, x, y, w, h}.
// Titles are only held in memory; nothing is logged.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PS = String.raw`
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

function startWatcher(onSample, onError) {
  if (process.platform !== 'win32') return { stop() {}, available: false };
  const file = path.join(os.tmpdir(), 'bodhi-watcher.ps1');
  fs.writeFileSync(file, PS, 'utf8');
  let child = null, stopped = false, buf = '';
  const launch = () => {
    child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', file],
      { windowsHide: true });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try { onSample(JSON.parse(line)); } catch { /* ignore partial */ }
      }
    });
    child.on('exit', () => { if (!stopped) setTimeout(launch, 5000); });
    child.on('error', e => onError && onError(e));
  };
  launch();
  return { available: true, stop() { stopped = true; try { child && child.kill(); } catch { } } };
}

// One-shot list of apps that currently have a visible window (for the focus-app picker).
const FRIENDLY = { chrome: 'Chrome', msedge: 'Edge', firefox: 'Firefox', brave: 'Brave', code: 'VS Code', winword: 'Word',
  excel: 'Excel', powerpnt: 'PowerPoint', outlook: 'Outlook', 'ms-teams': 'Teams', teams: 'Teams', notion: 'Notion',
  figma: 'Figma', whatsapp: 'WhatsApp', telegram: 'Telegram', slack: 'Slack', spotify: 'Spotify', obsidian: 'Obsidian',
  acrobat: 'Acrobat', acrord32: 'Acrobat Reader', notepad: 'Notepad', 'windowsterminal': 'Terminal', cursor: 'Cursor',
  antigravity: 'Antigravity', claude: 'Claude', chatgpt: 'ChatGPT', zoom: 'Zoom' };
const HIDE = ['explorer', 'shellexperiencehost', 'searchhost', 'startmenuexperiencehost', 'textinputhost', 'systemsettings',
  'lockapp', 'electron', 'bodhi pomodoro', 'powershell', 'nvidia share', 'rtkuwp'];

function listApps() {
  return new Promise(resolve => {
    if (process.platform !== 'win32') return resolve([]);
    const cmd = "Get-Process | Where-Object { $_.MainWindowTitle } | ForEach-Object { [pscustomobject]@{ p = $_.ProcessName; t = $_.MainWindowTitle } } | ConvertTo-Json -Compress";
    require('child_process').execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', cmd],
      { windowsHide: true, timeout: 8000, maxBuffer: 1024 * 1024 }, (err, out) => {
        if (err || !out.trim()) return resolve([]);
        let rows; try { rows = JSON.parse(out); } catch { return resolve([]); }
        if (!Array.isArray(rows)) rows = [rows];
        const seen = new Map();
        for (const r of rows) {
          const key = String(r.p || '').toLowerCase();
          if (!key || HIDE.includes(key)) continue;
          const name = key === 'applicationframehost' ? String(r.t || '').slice(0, 50) : (FRIENDLY[key] || r.p);
          if (name) seen.set(key + '|' + name, { process: r.p, name, title: String(r.t || '').slice(0, 80) });
        }
        resolve([...seen.values()].sort((a, b) => a.name.localeCompare(b.name)));
      });
  });
}

module.exports = { startWatcher, listApps };
