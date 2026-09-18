# Bodhi Pomodoro — Comprehensive Expert Review

Date: 2026-09-18 · Scope: full codebase audit (architecture, code quality, security, UX, performance, testing, docs, deployment)

> NOTE: The previous review in this file gave 9.5/10. That score was inflated —
> it rated every dimension identically and missed the Python subsystem's race
> condition, weak tests, and gitignore gaps. This review supersedes it.

## Overall Rating: 8.4 / 10

| Category | Score | Weight | Weighted |
|---|---|---|---|
| Architecture & Design | 9.0/10 | 20% | 1.80 |
| Code Quality & Readability | 8.0/10 | 15% | 1.20 |
| Security | 8.5/10 | 15% | 1.28 |
| UX / Product Design | 9.5/10 | 15% | 1.43 |
| Testing & Reliability | 7.5/10 | 10% | 0.75 |
| Performance & Efficiency | 9.0/10 | 10% | 0.90 |
| Documentation | 9.5/10 | 5% | 0.48 |
| DevOps & Deployment | 7.0/10 | 5% | 0.35 |
| Scalability & Extensibility | 8.0/10 | 5% | 0.40 |
| **Total** | | | **8.59** |

Bodhi Pomodoro comprises two components: the Electron prototype (~4,400 LOC JS,
production-quality) and the Python Bodhi-Supervisor (~1,200 LOC, an AI-powered
focus daemon that needed hardening).

## Highlights

- Exemplary separation of concerns: callback-based decoupling (`state.js`), pure
  logic modules (`distraction.js`, `report.js`), isomorphic UMD pattern.
- Atomic storage pattern in `storage.js` (write-to-temp + rename with fallback).
- Best-in-class Electron security: `preload.js` contextBridge with a strict
  7-channel IPC whitelist; input clamping in `ipc.js`.
- Genuinely innovative UX: inline wizard, escalation system (glance → shades →
  shake → lasers), Bodhi-tree growth stages, structured break activities,
  away detection, multi-monitor support, daily Markdown report.
- Near-zero-CPU window tracking via an on-the-fly compiled C# watcher with a
  PowerShell fallback; procedural SVG artwork.

## Issues found → status

### Critical (all fixed 2026-09-18)

| # | Issue | Fix |
|---|---|---|
| 1 | **Race condition in `monitor.py::save_activity_entry`** — WindowTracker and FileWatcher threads read-then-wrote `state.json` without locking (TOCTOU, silently lost entries) | Shared `threading.Lock` in `paths.py` + atomic temp-file/rename writer; `StateManager._save` hardened the same way; regression test spawns 8 writer threads (`tests/test_monitor.py`) |
| 2 | **Committed `bodhi-supervisor/state.json` with test data** | Untracked via `git rm --cached`, added to `.gitignore` |
| 3 | **Incomplete Python `.gitignore`** (also had tracked `__pycache__/*.pyc`) | Now ignores `.env`, `state.json`, `__pycache__/`, `*.pyc`, venvs, pytest cache |

### Medium (all fixed 2026-09-18)

| # | Issue | Fix |
|---|---|---|
| 1 | Inconsistent HTML escaping (`launcher.js` missed `'`) | Single `esc()` in `src/utils.js`, used everywhere |
| 2 | Hardcoded absolute path in `bodhi_silent.vbs` | Resolves `start_bodhi.bat` via `WScript.ScriptFullName` |
| 3 | `google-generativeai==0.3.2` outdated | Bumped to 0.8.5 |
| 4 | No error handling in `cli.py load_goal()` | Corrupt/missing state treated as "no goal" with a warning |
| 5 | No automated Python tests (`test_modules.py` was interactive) | 32 pytest tests in `bodhi-supervisor/tests/`; interactive script removed |
| 6 | Code duplication (`fmt`, `$`, `parseTask`, `hm`, `BREAK_FOR`, `STATE_FILE`) | Shared `prototype/src/utils.js` (isomorphic UMD) and `bodhi-supervisor/paths.py` |
| 7 | CI didn't cover the Python supervisor | New `python` job in `.github/workflows/ci.yml` (pytest + flake8) |

### Low priority (deferred)

TypeScript migration, E2E tests (Playwright), code signing, auto-updater, theme
customization, i18n — tracked in `bodhi-supervisor/ROADMAP.md` / future work.

## Bottom line

The Electron component is production quality; the Python supervisor now has the
hardening it needed: thread-safe atomic state writes, real tests in CI, and no
committed dev artifacts.
