#!/usr/bin/env python3
"""Shared paths and file helpers for Bodhi Supervisor.

Every module used to define its own ``STATE_FILE`` constant (monitor.py,
cli.py, state_manager.py, brain.py). They all import it from here now so
there is a single source of truth, plus one shared lock and one atomic
writer that every read-modify-write of state.json must go through.
"""

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Optional

#: Persistent session state (goal, activity log, interventions).
STATE_FILE = Path(__file__).parent / "state.json"

#: Guards every read-modify-write cycle of STATE_FILE. WindowTracker and
#: FileWatcher callbacks arrive from separate threads; without this lock the
#: read-then-write in save_activity_entry() was a TOCTOU race that could
#: silently drop entries.
state_lock = threading.Lock()


def atomic_write_json(path: Path, data: dict) -> None:
    """Write JSON to *path* crash-safely (temp file + atomic rename).

    Mirrors the write-to-temp + rename pattern used by the Electron app's
    storage.js so a crash or power loss mid-write can never truncate or
    half-write the state file.

    Args:
        path: Destination file.
        data: JSON-serializable payload.
    """
    path = Path(path)
    fd, tmp_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent)
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp_name, path)  # atomic on POSIX and Windows
    except Exception:
        # Best-effort cleanup of the leftover temp file; not fatal either way.
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise


def load_state_json(path: Path = STATE_FILE, default: Optional[dict] = None) -> dict:
    """Load state.json, tolerating a missing or corrupt file.

    Args:
        path: State file location.
        default: Value returned when the file is missing/unreadable.

    Returns:
        Parsed dict, or a fresh copy of *default*.
    """
    fallback = {"daily_goal": "", "session_start": "", "activity_log": []} \
        if default is None else default
    if not path.exists():
        return dict(fallback)
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return dict(fallback)
