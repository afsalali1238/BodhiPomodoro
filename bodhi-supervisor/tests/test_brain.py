"""Tests for brain.py — prompt construction and key handling (no live LLM calls)."""

import pytest

from brain import Brain


@pytest.fixture(autouse=True)
def no_api_keys(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)


def test_brain_requires_an_api_key():
    with pytest.raises(ValueError, match="No API key"):
        Brain(provider="openai")


def test_build_prompt_contains_goal_and_activity():
    brain = Brain.__new__(Brain)  # skip client init; build_prompt is pure
    prompt = brain.build_prompt("Build the auth API", [
        "10:00 - Code.exe: auth.py",
        "10:05 - chrome.exe: YouTube",
    ])
    assert "Build the auth API" in prompt
    assert "10:00 - Code.exe: auth.py" in prompt
    assert "10:05 - chrome.exe: YouTube" in prompt
    assert "OK" in prompt  # the on-track output contract


def test_build_prompt_limits_to_last_15_entries():
    brain = Brain.__new__(Brain)
    entries = [f"entry-{i}" for i in range(30)]
    prompt = brain.build_prompt("goal", entries)
    assert "entry-29" in prompt
    assert "entry-15" in prompt
    assert "entry-14" not in prompt


def test_build_prompt_handles_empty_log():
    brain = Brain.__new__(Brain)
    prompt = brain.build_prompt("goal", [])
    assert "No activity recorded yet." in prompt
