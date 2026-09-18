# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed
- **Race condition** in `bodhi-supervisor/monitor.py::save_activity_entry`. The
  WindowTracker and FileWatcher threads both read-modify-wrote `state.json`
  without locking (a TOCTOU race that could silently drop activity entries).
  All writes now go through a shared `threading.Lock` and an atomic
  temp-file + rename writer.
- Removed a committed `bodhi-supervisor/state.json` containing development
  data; it is now git-ignored as runtime state.
- `bodhi_silent.vbs` no longer hardcodes an absolute user path; it resolves
  `start_bodhi.bat` relative to its own folder.
- `cli.load_goal()` no longer crashes on a corrupt or half-written state file.

### Changed
- Unified duplicated helpers (`fmt`, `$`, `esc`, `hm`, `parseTask`, `BREAK_FOR`)
  into `prototype/src/utils.js` (isomorphic, like `report.js`).
- Made HTML escaping consistent (single quotes now escaped everywhere).
- Bumped `google-generativeai` 0.3.2 → 0.8.5.
- Centralized the Python `STATE_FILE` path in `paths.py`.
- CI now runs the Python supervisor suite (pytest + flake8) in addition to the
  Electron tests.

### Added
- `bodhi-supervisor/tests/` pytest suite (32 tests), including a regression test
  for the activity-log race condition.
- `bodhi-supervisor/.gitignore` coverage for `.env`, `state.json`, `__pycache__`,
  and `*.pyc`.
- `CONTRIBUTING.md` and this `CHANGELOG.md`.

## [0.3.0]

- Polished all button surfaces with a unified design system.
- Inline time popup, compact launcher, idle poses, laser blocking, session
  persistence, auto-backup, and error logging.
