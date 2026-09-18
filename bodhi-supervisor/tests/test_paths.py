"""Tests for paths.py — the shared atomic writer and tolerant loader."""

import json

from paths import atomic_write_json, load_state_json


def test_atomic_write_json_roundtrip(tmp_path):
    target = tmp_path / "state.json"
    atomic_write_json(target, {"daily_goal": "test", "n": [1, 2, 3]})
    assert json.loads(target.read_text(encoding="utf-8")) == {
        "daily_goal": "test",
        "n": [1, 2, 3],
    }


def test_atomic_write_json_leaves_no_temp_files(tmp_path):
    target = tmp_path / "state.json"
    for i in range(3):
        atomic_write_json(target, {"i": i})
    assert sorted(p.name for p in tmp_path.iterdir()) == ["state.json"]


def test_atomic_write_json_overwrites_existing(tmp_path):
    target = tmp_path / "state.json"
    target.write_text("old content", encoding="utf-8")
    atomic_write_json(target, {"fresh": True})
    assert json.loads(target.read_text(encoding="utf-8")) == {"fresh": True}


def test_load_state_json_missing_file(tmp_path):
    assert load_state_json(tmp_path / "nope.json") == {
        "daily_goal": "",
        "session_start": "",
        "activity_log": [],
    }


def test_load_state_json_corrupt_file(tmp_path):
    target = tmp_path / "state.json"
    target.write_text("not json at all", encoding="utf-8")
    assert load_state_json(target) == {
        "daily_goal": "",
        "session_start": "",
        "activity_log": [],
    }


def test_load_state_json_custom_default(tmp_path):
    default = {"daily_goal": "fallback"}
    result = load_state_json(tmp_path / "nope.json", default=default)
    assert result == default
    # Must be a copy, not the same object.
    assert result is not default
