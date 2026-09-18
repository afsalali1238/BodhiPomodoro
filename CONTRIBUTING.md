# Contributing to Bodhi Pomodoro

Thanks for your interest! Bodhi has two components, each with its own toolchain.

## Repository layout

- `prototype/` — the Electron desktop app (vanilla JS, no framework, no bundler).
- `bodhi-supervisor/` — the optional Python focus daemon ("Bodhi Supervisor").

## Getting started

### Electron app

```bash
cd prototype
npm ci            # Node >= 20.11
npm start         # launch the app
npm test          # node --test unit suite
npm run lint      # eslint
```

Renderer scripts are plain `<script>` tags (no modules). Shared helpers live in
`src/utils.js`, which is isomorphic: it is `require()`d by main-process code and
loaded as `window.BodhiUtils` in renderer windows. If you add a helper used in
more than one place, put it there instead of duplicating it.

### Python supervisor

```bash
cd bodhi-supervisor
python -m venv .venv && source .venv/bin/activate   # or .venv\Scripts\activate on Windows
pip install -r requirements-dev.txt
pytest tests/ -v   # unit tests
flake8 .           # lint
```

Windows-only integrations (`win10toast`, `pygetwindow`) are imported behind
`try/except` guards so the code and tests run on any platform.

## Pull requests

- Keep changes focused; one concern per PR.
- Add or update tests for behavior changes (both suites run in CI).
- Run the relevant `npm test` / `pytest` and linter before pushing.
- Never commit secrets (`.env`), runtime state (`state.json`), or build artifacts.

## Reporting issues

Describe your OS, the app version, and steps to reproduce. For the Python
daemon, include the output of `python bodhi.py --status`.
