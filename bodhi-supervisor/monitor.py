#!/usr/bin/env python3
"""Monitor module - OS-level window and file activity tracking."""

import time
import threading
from pathlib import Path
from datetime import datetime
from typing import Optional, Callable

# pygetwindow only works on Windows/macOS and is not installable everywhere
# (e.g. Linux CI runners). Importing it lazily keeps the pure-Python parts of
# this module (save_activity_entry, FileWatcher, GitWatcher) importable and
# unit-testable on any platform.
try:
    import pygetwindow as gw
except ImportError:  # pragma: no cover - depends on platform
    gw = None

import psutil
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from paths import STATE_FILE, state_lock, atomic_write_json, load_state_json


class WindowTracker:
    """Polls the active window title at regular intervals."""

    def __init__(self, interval: int = 10, callback: Optional[Callable] = None):
        self.interval = interval
        self.callback = callback
        self.running = False
        self._thread: Optional[threading.Thread] = None
        self.last_window = ""
        self.last_app = ""

    def get_active_window_info(self) -> dict:
        """Get the current active window title and process name."""
        try:
            if gw is None:  # platform without pygetwindow support
                return {"title": "Unknown", "app": "Unknown", "pid": None}

            win = gw.getActiveWindow()
            if not win:
                return {"title": "No active window", "app": "Unknown", "pid": None}

            title = win.title or "Untitled"
            # Try to get process name
            pid = win._hWnd  # This is the window handle, not PID
            app = "Unknown"

            # Get process from window handle using psutil
            try:
                import win32process
                _, pid = win32process.GetWindowThreadProcessId(win._hWnd)
                proc = psutil.Process(pid)
                app = proc.name()
            except Exception:
                # Fallback: try to infer from title
                if "chrome" in title.lower():
                    app = "chrome.exe"
                elif "code" in title.lower() or "visual studio" in title.lower():
                    app = "Code.exe"
                elif "firefox" in title.lower():
                    app = "firefox.exe"
                elif "terminal" in title.lower() or "cmd" in title.lower() or "powershell" in title.lower():
                    app = "Terminal"

            return {"title": title, "app": app, "pid": pid}
        except Exception as e:
            return {"title": f"Error: {e}", "app": "Unknown", "pid": None}

    def poll_once(self) -> dict:
        """Single poll of active window."""
        info = self.get_active_window_info()
        title = info["title"]
        app = info["app"]

        # Only log if changed
        if title != self.last_window or app != self.last_app:
            self.last_window = title
            self.last_app = app
            timestamp = datetime.now().strftime("%H:%M")
            entry = f"{timestamp} - {app}: {title}"

            if self.callback:
                self.callback(entry)

            return {"changed": True, "entry": entry, **info}

        return {"changed": False, **info}

    def start(self) -> None:
        """Start the polling loop in a background thread."""
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stop the polling loop."""
        self.running = False
        if self._thread:
            self._thread.join(timeout=2)

    def _loop(self) -> None:
        """Background polling loop."""
        while self.running:
            self.poll_once()
            time.sleep(self.interval)


class FileWatcher(FileSystemEventHandler):
    """Watches a directory for file changes using watchdog."""

    def __init__(self, watch_path: str, callback: Optional[Callable] = None):
        self.watch_path = Path(watch_path).resolve()
        self.callback = callback
        self.observer: Optional[Observer] = None
        self.last_modified = {}

    def on_modified(self, event) -> None:
        """Called when a file is modified."""
        if event.is_directory:
            return

        path = Path(event.src_path)
        # Debounce rapid saves
        now = time.time()
        if path in self.last_modified and now - self.last_modified[path] < 1:
            return
        self.last_modified[path] = now

        # Get relative path
        try:
            rel_path = path.relative_to(self.watch_path)
        except ValueError:
            rel_path = path.name

        timestamp = datetime.now().strftime("%H:%M")
        entry = f"{timestamp} - File saved: {rel_path}"

        if self.callback:
            self.callback(entry)

    def start(self) -> None:
        """Start watching the directory."""
        if self.observer:
            return
        self.observer = Observer()
        self.observer.schedule(self, str(self.watch_path), recursive=True)
        self.observer.start()

    def stop(self) -> None:
        """Stop watching."""
        if self.observer:
            self.observer.stop()
            self.observer.join(timeout=2)
            self.observer = None


class GitWatcher:
    """Monitors git status for context."""

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path).resolve()

    def get_status(self) -> str:
        """Get git status summary."""
        import subprocess
        try:
            result = subprocess.run(
                ["git", "status", "--short"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() or "Clean"
        except Exception:
            return "Not a git repo or error"

    def get_recent_commits(self, count: int = 5) -> str:
        """Get recent commit messages."""
        import subprocess
        try:
            result = subprocess.run(
                ["git", "log", f"-{count}", "--oneline"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() or "No commits"
        except Exception:
            return "Error reading git log"

    def get_diff_summary(self) -> str:
        """Get a summary of uncommitted changes."""
        import subprocess
        try:
            result = subprocess.run(
                ["git", "diff", "--stat"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip() or "No uncommitted changes"
        except Exception:
            return "Error reading git diff"


def save_activity_entry(entry: str) -> None:
    """Append an activity entry to state.json.

    Called from the WindowTracker and FileWatcher threads concurrently, so
    the whole read-modify-write cycle runs under ``state_lock`` and the
    result is written atomically (temp file + rename). Without the lock two
    threads could read the same version of the file and one of the appended
    entries would be silently lost (TOCTOU race).
    """
    with state_lock:
        state = load_state_json(STATE_FILE)
        state.setdefault("activity_log", [])

        # Append entry
        state["activity_log"].append(entry)

        # Keep only last 100 entries
        if len(state["activity_log"]) > 100:
            state["activity_log"] = state["activity_log"][-100:]

        atomic_write_json(STATE_FILE, state)


def monitor_callback(entry: str) -> None:
    """Default callback to save activity to state."""
    save_activity_entry(entry)
    print(f"[Monitor] {entry}")


def test_monitor() -> None:
    """Test window tracking for a few seconds."""
    print("Testing window tracker for 15 seconds...")
    tracker = WindowTracker(interval=3, callback=monitor_callback)
    tracker.start()
    time.sleep(15)
    tracker.stop()
    print("Test complete.")


if __name__ == "__main__":
    test_monitor()
