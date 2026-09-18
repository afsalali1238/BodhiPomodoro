"""Tests for cli.py — goal loading/saving edge cases."""

import json

import cli


def test_load_goal_missing_file(patch_state_file):
    assert cli.load_goal() is None


def test_save_then_load_goal(patch_state_file, capsys):
    cli.save_goal("Build the auth API")
    assert cli.load_goal() == "Build the auth API"

    out = capsys.readouterr().out
    assert "Goal saved" in out

    state = json.loads(patch_state_file.read_text(encoding="utf-8"))
    assert state["daily_goal"] == "Build the auth API"
    assert state["activity_log"] == []
    assert state["session_start"]


def test_load_goal_corrupt_file(patch_state_file, capsys):
    patch_state_file.write_text("{ broken", encoding="utf-8")
    assert cli.load_goal() is None
    assert "Could not read" in capsys.readouterr().out


def test_load_goal_empty_goal_is_none(patch_state_file):
    patch_state_file.write_text(json.dumps({"daily_goal": ""}), encoding="utf-8")
    assert cli.load_goal() is None


def test_get_user_goal_reprompts_on_empty(patch_state_file, monkeypatch):
    answers = iter(["   ", "", "Write the docs"])
    monkeypatch.setattr("builtins.input", lambda _="": next(answers))
    assert cli.get_user_goal() == "Write the docs"
