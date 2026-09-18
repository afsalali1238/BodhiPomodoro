"""Shared pytest fixtures for the Bodhi Supervisor test suite."""

import json
import sys
from pathlib import Path

import pytest

# Make the supervisor package importable regardless of where pytest is run from.
SUPERVISOR_DIR = Path(__file__).resolve().parents[1]
if str(SUPERVISOR_DIR) not in sys.path:
    sys.path.insert(0, str(SUPERVISOR_DIR))


@pytest.fixture
def patch_state_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point every module's STATE_FILE at a throwaway file and return its path."""
    import cli
    import monitor
    import paths

    target = tmp_path / "state.json"
    monkeypatch.setattr(paths, "STATE_FILE", target)
    monkeypatch.setattr(monitor, "STATE_FILE", target)
    monkeypatch.setattr(cli, "STATE_FILE", target)
    return target


@pytest.fixture
def read_state(patch_state_file: Path):
    """Helper returning the current parsed state.json contents."""
    def _read() -> dict:
        with open(patch_state_file, encoding="utf-8") as f:
            return json.load(f)
    return _read
