# Bodhi — Tauri rebuild (M0: Scaffold)

A from-scratch rebuild of Bodhi Pomodoro: **Tauri 2 (Rust) + Svelte 5 + TypeScript + Vite**,
SQLite via `sqlx` directly in Rust. Fully offline, no accounts, no tracking.

Full product spec: [`../REBUILD_PROMPT.md`](../REBUILD_PROMPT.md).

## Run it

```bash
cd bodhi
npm install

# Frontend only (works in any browser; Tauri APIs fall back to mocks)
npm run dev

# Full desktop app (needs the Rust toolchain + Tauri system deps)
npx tauri dev
```

Linux system deps for `tauri dev` / `cargo check`:

```bash
sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

## M0 scope (this milestone)

- [x] Pet window: 240×310, transparent, frameless, always-on-top, skip-taskbar
- [x] Procedural SVG monk + tree (stages 0–4) + label pill
- [x] Native drag-to-move (`startDragging`), position persists across restarts
- [x] Single-instance lock, 2 Hz `bodhi://state` event stream
- [x] SQLite connected + migrated (`bodhi.db`, WAL mode), `db_health` command
- [x] CI: frontend (lint · types · test · build) + Rust (fmt · clippy · check) on win/mac/linux

## Scripts

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Vite dev server (port 1420)          |
| `npm test`          | Vitest unit tests                    |
| `npm run lint`      | ESLint (flat config)                 |
| `npm run check`     | svelte-check (types)                 |
| `npm run format`    | Prettier write                       |
| `npx tauri dev`     | Full desktop app                     |
| `cargo fmt --check` | Rust formatting (in `src-tauri/`)    |
| `cargo clippy …`    | Rust lints, warnings denied (see CI) |

## Layout

```
bodhi/
├── src/                    # Svelte frontend (pure renderer)
│   ├── App.svelte          # pet window: scene + drag + click pulse
│   ├── app.css             # design tokens + injected-art rules
│   └── lib/
│       ├── art.ts          # procedural SVG (monk, tree, leaves)
│       ├── format.ts       # pure display helpers (+ tests)
│       ├── state.ts        # backend-state mirror (store)
│       ├── tauri.ts        # Tauri bridge w/ browser fallbacks
│       └── types.ts        # mirrors of the Rust structs
└── src-tauri/              # Rust backend (source of truth)
    ├── tauri.conf.json     # pet window + bundle config
    ├── capabilities/       # least-privilege API grants
    ├── migrations/         # SQLx migrations (full v1 schema)
    └── src/
        ├── main.rs         # builder: plugins, setup, commands, tick
        ├── state.rs        # phases + snapshots (M1: timer machine)
        └── db.rs           # SQLite connect + migrate + WAL
```

## Architecture rules (enforced in review)

1. **Backend owns time, phases, data.** Frontend renders + collects input only.
2. **No new dependency without a weight justification.**
3. Capabilities stay minimal — every permission must map to a used API.
4. `cargo clippy --all-targets -- -D warnings` and `eslint` stay clean.
