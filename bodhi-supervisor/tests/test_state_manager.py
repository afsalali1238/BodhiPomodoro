"""Tests for state_manager.py — persistence, aggregation, and session state."""

import json
from datetime import datetime, timedelta
from pathlib import Path

from state_manager import StateManager


def make_sm(tmp_path: Path, name: str = "state.json") -> StateManager:
    return StateManager(state_file=tmp_path / name)


def test_goal_lifecycle(tmp_path):
    sm = make_sm(tmp_path)
    assert not sm.has_goal()
    sm.set_goal("Build the auth API")
    assert sm.has_goal()
    assert sm.get_goal() == "Build the auth API"
    assert sm.get_session_duration() is not None


def test_state_persists_across_instances(tmp_path):
    make_sm(tmp_path).set_goal("Refactor payments")
    sm2 = make_sm(tmp_path)
    assert sm2.get_goal() == "Refactor payments"


def test_log_activity_caps_at_200(tmp_path):
    sm = make_sm(tmp_path)
    sm.set_goal("cap test")
    for i in range(250):
        sm.log_activity(f"entry-{i:03d}")
    log = sm.get_all_activity()
    assert len(log) == 200
    assert log[0] == "entry-050"
    assert log[-1] == "entry-249"


def test_recent_activity_filters_by_window(tmp_path):
    sm = make_sm(tmp_path)
    sm.set_goal("window test")
    now = datetime.now()
    fresh = now.strftime("%H:%M")
    old = (now - timedelta(hours=3)).strftime("%H:%M")
    sm.log_activity(f"{old} - chrome.exe: old tab")
    sm.log_activity(f"{fresh} - Code.exe: current file")

    recent = sm.get_recent_activity(15)
    assert f"{fresh} - Code.exe: current file" in recent
    assert f"{old} - chrome.exe: old tab" not in recent


def test_recent_activity_handles_unparseable_entries(tmp_path):
    sm = make_sm(tmp_path)
    sm.set_goal("weird entries")
    sm.log_activity("no timestamp here")
    # Unparseable entries are included rather than dropped.
    assert "no timestamp here" in sm.get_recent_activity(15)


def test_formatted_summary_groups_by_app(tmp_path):
    sm = make_sm(tmp_path)
    sm.set_goal("summary")
    now = datetime.now().strftime("%H:%M")
    sm.log_activity(f"{now} - Code.exe: auth.py")
    sm.log_activity(f"{now} - Code.exe: models.py")
    sm.log_activity(f"{now} - chrome.exe: YouTube")

    summary = sm.get_formatted_summary(15)
    assert "Code.exe" in summary
    assert "chrome.exe" in summary

    top = sm.get_top_apps(15, top_n=1)
    assert top[0][0] == "Code.exe"


def test_formatted_summary_empty(tmp_path):
    sm = make_sm(tmp_path)
    assert sm.get_formatted_summary(15) == "No recent activity."


def test_interventions_and_pomodoros(tmp_path):
    sm = make_sm(tmp_path)
    assert sm.increment_pomodoro() == 1
    assert sm.increment_pomodoro() == 2
    assert sm.get_pomodoro_count() == 2

    sm.log_intervention("You're drifting back to YouTube.", "Reading docs")
    interventions = sm.get_interventions()
    assert len(interventions) == 1
    assert interventions[0]["user_response"] == "Reading docs"


def test_reset_session_keeps_goal(tmp_path):
    sm = make_sm(tmp_path)
    sm.set_goal("Keep me")
    sm.log_activity("10:00 - Code.exe: x.py")
    sm.increment_pomodoro()

    sm.reset_session()
    assert sm.get_goal() == "Keep me"
    assert sm.get_all_activity() == []
    assert sm.get_pomodoro_count() == 0


def test_corrupt_state_file_falls_back_to_defaults(tmp_path):
    target = tmp_path / "state.json"
    target.write_text("{{{ definitely not json", encoding="utf-8")
    sm = StateManager(state_file=target)
    assert sm.get_goal() == ""
    assert sm.get_all_activity() == []


def test_saved_file_is_always_valid_json(tmp_path):
    sm = make_sm(tmp_path)
    sm.set_goal("json check")
    sm.log_activity("10:00 - Code.exe: y.py")
    data = json.loads((tmp_path / "state.json").read_text(encoding="utf-8"))
    assert data["daily_goal"] == "json check"
    # Atomic writer must not leave temp files behind.
    assert sorted(p.name for p in tmp_path.iterdir()) == ["state.json"]
