"""Tests for monitor.py — activity logging and the threaded write race fix."""

import json
import threading

import monitor


def test_save_activity_entry_appends(patch_state_file, read_state):
    monitor.save_activity_entry("10:00 - Code.exe: auth.py")
    monitor.save_activity_entry("10:01 - chrome.exe: YouTube")

    state = read_state()
    assert state["activity_log"] == [
        "10:00 - Code.exe: auth.py",
        "10:01 - chrome.exe: YouTube",
    ]


def test_save_activity_entry_preserves_existing_fields(patch_state_file, read_state):
    patch_state_file.write_text(json.dumps({
        "daily_goal": "Ship the release",
        "session_start": "2026-01-01T09:00:00",
        "activity_log": ["09:00 - Code.exe: main.py"],
    }), encoding="utf-8")

    monitor.save_activity_entry("09:05 - Terminal: pytest")

    state = read_state()
    assert state["daily_goal"] == "Ship the release"
    assert state["session_start"] == "2026-01-01T09:00:00"
    assert state["activity_log"][-1] == "09:05 - Terminal: pytest"


def test_save_activity_entry_caps_at_100(patch_state_file, read_state):
    for i in range(120):
        monitor.save_activity_entry(f"entry-{i:03d}")

    log = read_state()["activity_log"]
    assert len(log) == 100
    assert log[0] == "entry-020"
    assert log[-1] == "entry-119"


def test_save_activity_entry_survives_corrupt_state(patch_state_file, read_state):
    patch_state_file.write_text("{ not valid json", encoding="utf-8")

    monitor.save_activity_entry("10:00 - Code.exe: fresh start")

    assert read_state()["activity_log"] == ["10:00 - Code.exe: fresh start"]


def test_save_activity_entry_no_lost_entries_under_concurrency(patch_state_file, read_state):
    """Regression test for the TOCTOU race between WindowTracker and FileWatcher.

    Both monitors call save_activity_entry() from their own threads. Before
    the fix, two threads could read the same state.json snapshot and one
    appended entry would be silently lost. With the lock in place every one
    of the 200 writes must survive (the last 100 after the cap applies),
    all distinct.
    """
    threads, per_thread = 8, 25
    barrier = threading.Barrier(threads)

    def worker(t: int):
        barrier.wait()
        for i in range(per_thread):
            monitor.save_activity_entry(f"t{t}-{i:03d}")

    pool = [threading.Thread(target=worker, args=(t,)) for t in range(threads)]
    for th in pool:
        th.start()
    for th in pool:
        th.join()

    log = read_state()["activity_log"]
    assert len(log) == 100               # capped at 100...
    assert len(set(log)) == 100          # ...with no duplicates or lost writes
    assert all(entry.startswith("t") for entry in log)


def test_no_leftover_temp_files_after_writes(patch_state_file):
    for i in range(5):
        monitor.save_activity_entry(f"entry-{i}")

    leftovers = [p.name for p in patch_state_file.parent.iterdir()
                 if p.name != patch_state_file.name]
    assert leftovers == []
