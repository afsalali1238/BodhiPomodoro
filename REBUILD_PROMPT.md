# PROMPT: Rebuild "Bodhi Pomodoro" From Scratch
# (Copy everything below the line into your coding agent)
---
You are a senior desktop-app engineer + product designer. Build **Bodhi Pomodoro** from scratch: a lightweight, local-first desktop focus companion.

## 1. Product vision (what it is)

A pixel-charming **monk pet who lives on the user's desktop** (a small transparent always-on-top window) and runs Pomodoro focus sessions with them:

- He **meditates/breathes with you** during focus, **stands up and walks behind his tree** when break starts, and **returns** when break ends.
- A **Bodhi tree** behind him grows through 5 stages as the user completes lifetime sessions (the long-term hook).
- If the user drifts to distracting apps/sites mid-focus, he escalates: **head-shake glance → laser beams fired at the offending window** (aimed at its real screen position).
- End of day, he **bows and generates a daily work report** (focus time, tasks, distractions, timeline).
- No accounts, no cloud, no backend. **100% offline, private, instant.**

Personality: calm, warm, slightly playful. He never shames — he nudges. Comedy (lasers) + attachment (pet + tree) is the retention engine, not guilt.

**Non-goals for v1:** no AI/LLM features, no sync, no mobile app, no team features, no plugin system, no user accounts.

## 2. Tech stack (mandatory — light but best quality)

| Layer | Choice | Why |
|---|---|---|
| App framework | **Tauri 2.x** (Rust backend + system WebView) | ~10MB binary vs ~150MB Electron; ~30–60MB RAM idle; real native APIs without hacks |
| Frontend | **Svelte 5 + TypeScript + Vite** (plain SPA, no SvelteKit) | Smallest quality framework runtime (~few KB), simplest reactivity for a pet UI |
| Styling | **Hand-written CSS with design tokens** (no Tailwind/Bootstrap) | This UI is bespoke SVG art + small panels; a CSS framework is dead weight |
| Art | **Procedural inline SVG** (all art generated in code) | Zero image assets, infinitely scalable, DPI-perfect, tiny |
| Storage | **SQLite via `sqlx` directly in Rust** for sessions/tasks/logs + **Store** (`tauri-plugin-store`, Rust-side) for settings/window prefs | Single-file DB, crash-safe, trivial reporting queries; no server; zero SQL JS-permissions needed since the backend owns all data |
| Window watcher | **Native Rust** (`windows` crate on Windows; `core-graphics`/`appkit` on macOS; best-effort X11 on Linux) | Replaces the old C#-compile-on-the-fly hack with one clean native module |
| Idle detection | Rust (`user-idle` crate or platform APIs) | Away detection without JS polling |
| Global shortcuts | `tauri-plugin-global-shortcut` | |
| Tray | Tauri 2 built-in tray API | |
| Notifications | `tauri-plugin-notification` | |
| Autostart | `tauri-plugin-autostart` | |
| Single instance | `tauri-plugin-single-instance` | |
| Sound | **WebAudio-synthesized chime** (no audio files) | Soft temple bell via oscillators |
| Tests | **Vitest** (frontend logic) + **cargo test** (Rust) | |
| Lint/format | ESLint (flat) + Prettier for TS/Svelte; `rustfmt` + `clippy -D warnings` for Rust | |
| CI | GitHub Actions matrix win/mac/linux: lint + test + build | |
| Packaging | `tauri build`: Windows NSIS + portable exe, macOS DMG, Linux AppImage | |

**Forbidden:** Electron, React/Vue/Angular, any CSS framework, any backend/server, any analytics/tracking SDK, any remote fonts or CDN assets (fully offline).

### Performance budgets (hard requirements — verify before calling v1 done)
- Windows installer ≤ 15MB; installed ≤ 40MB
- Idle RAM ≤ 80MB total; idle CPU < 1% (no JS busy-loops; timers tick at 2Hz max, watcher polls at ~1.5s in a native thread)
- Cold start to visible pet < 1.5s on a mid laptop
- Pet window render must stay 60fps during breathing/falling-leaves animations

## 3. Architecture

```
┌──────────────────────────── FRONTEND (Svelte/TS) ────────────────────────────┐
│ pet window (transparent, 240×310 logical) │ panels: wizard(inline), tasks,   │
│ settings, report, laser overlay (all small Svelte roots, one Vite build)     │
│                                                                               │
│  stores/state.ts      ← single typed mirror of backend state (via events)    │
│  art/figures.ts       ← procedural SVG: monk (sit/stand), tree(stages 0-4),  │
│                         props (cup/glass/sign/breath ring), falling leaves   │
│  audio/chime.ts       ← WebAudio bell                                        │
└───────────────▲───────────────────────────────▲──────────────────────────────┘
                │ Tauri commands (invoke)       │ Tauri events (state push)
┌───────────────┴───────────────────────────────┴──────────────────────────────┐
│ BACKEND (Rust) — the source of truth. Timer lives HERE so it survives       │
│ renderer reloads. Emits `bodhi://state` event at most when second changes.  │
│  state.rs    ← phase machine + pause/resume + tick loop (500ms)              │
│  watcher.rs  ← foreground window sampler (title, process, rect)              │
│  rules.rs    ← distraction classify + grace/cooldown/escalation (pure, tested)│
│  idle.rs     ← OS idle seconds                                               │
│  db.rs       ← SQLite: days/sessions/breaks/distractions/tasks/notes         │
│  report.rs   ← day summary + Markdown export (pure, tested)                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

Rules:
- Backend owns time, phases, and data. Frontend is a pure renderer + input collector. Never keep timer truth in JS.
- All Rust↔Svelte communication via explicit typed commands/events (no stringly-typed soup). Generate TS types from Rust where practical.
- `rules.rs` and `report.rs` must be **pure functions with unit tests** (no Tauri types inside).
- One watcher, one state, one DB. No duplicate polling loops anywhere.

## 4. The state machine (exact spec)

Phases: `idle → focus → waking → walkingOut → break → returning → ready → (focus…)`. Plus `paused` flag with `pauseReason: user | away`.

- **idle:** pet sits under tree, label "Click to start". Click (no drag) opens the inline start wizard.
- **focus:** timer runs. Breathing animation + progress ring + falling leaves + aura. `activeMs` accumulates only while unpaused and not away. Distraction watcher armed.
- **waking (15s):** focus timer hit zero. Notification: "Session complete — did you finish [task]?" Decision buttons appear above pet: `+5 min` (extend) / `Done ✓` (if task) / `Not yet` (go to break). Auto-proceeds to `walkingOut` after 15s.
- **walkingOut (1.5s):** session is COMMITTED to DB here (minutes from activeMs, min 0.1). Pet stands, walks left behind tree, fades. Tree stage-up check + notification if grew.
- **break:** empty cushion + wooden sign showing the activity ("drink water", "breathe slowly", "stand & stretch", "look far away"; long breaks: "coffee break", "take a walk"). Tap sign when done → nod. Breathe activity shows guided 4-4-6 ring (in 4s / hold 4s / out 6s loop).
- **returning (1.5s):** pet walks back from behind tree. Then `ready`.
- **ready:** "Back · click to sit". Click opens wizard. If `autoStartFocus`, starts next focus after 1.5s.
- **Pause:** manual anytime in focus/break. Away-auto-pause when OS idle ≥ `awayPauseMin` (subtracts idle span from activeMs, logs awayMin); auto-resume + nod when activity returns.
- **Skip:** focus→waking, waking→break, break→finish (log + return).
- **Reset:** confirm dialog → idle, clears timers (keeps history).

Durations: focus presets 10/15/25/50/90/custom(1–240). Break auto-map: 15→3, 25→5, 50→10, 90→20, else clamp(round(min/5), 3..20). Long break every `cyclesBeforeLong` (default 4). Demo mode: "Take Bodhi for a walk" = 1-min full cycle.

## 5. Feature specs (all must ship in v1)

### 5.1 Pet window
- 240×310 logical, transparent, frameless, `resizable: false`, always-on-top (floating level; raised to screensaver level only during laser blasts so beams render under him), skip taskbar, visible on all workspaces.
- Draggable by body (not by buttons/wizard); position + display remembered per monitor; auto-clamped into work area; follows display disconnects.
- Size: `auto` (20% of display height, clamped 0.4×–1×) or fixed 40/50/60/75/100%. **Size-lock:** any unexpected resize snaps back; window must NEVER grow/shrink on click.
- Single click (press+release without drag) = primary action (open wizard in idle/ready; pause/resume in focus/break). Right-click = context menu. Double-click (empty area) = tasks. Escape closes wizard.
- Renders at devicePixelRatio cleanly (SVG scales; no bitmaps).

### 5.2 Start wizard (inline, ON the pet — not a separate window)
3 steps, compact card overlaying the tree area (~236px wide):
1. **Duration:** chips 10/15/25/50/90 + custom number input + `⚡ Quick Start (Xm)` one-tap button.
2. **Task:** "No specific task (Skip)" + open tasks with `done/estimate` badges + new-task input (Enter). Skippable via setting `askTaskOnStart`.
3. **Focus apps:** chips from currently-running apps (process names, friendly labels: `code→VS Code` etc.) + Strict Mode toggle. `Start {Xm} Focus` button.
- Back/close controls on every step. Remembers last session (minutes/apps/strict) as defaults. Clicking outside the card closes it.

### 5.3 Distraction detection + lasers (Windows + macOS in v1; Linux best-effort)
- Sample foreground window every ~1.5s: title, process, rect (DIP-correct).
- **Modes:** (a) Blocklist: fire on rules like youtube/instagram/reddit/netflix/whatsapp/telegram/steam/twitch/x (domain rule matches process exactly or name-part in title); (b) Strict session: ONLY chosen apps allowed — anything else fires; inside an allowed browser, blocklisted sites still fire.
- **Never fire on:** own windows, shell surfaces (taskbar/start/spotlight/lock/login), allow-listed apps (allow always wins in blocklist mode).
- **Escalation (pure state machine, tested):** grace 5s → tier0 `glance` (head shake, 1.6s) → tier1 `beam` (1.5s) → tier2 `sweep` (3s) → tier3 `full + screen shake + "Return to the path"` (3s). Cooldown 30s between firings (8s after a mere glance). Offenses decay after 5 min. Returning to allowed app stops blast + nod.
- **Laser overlay:** fullscreen transparent click-through window on the pet's display; two beams from his sunglass lenses to the center of the offending window (clamped to work area); tier-styled intensity; `reduceMotion` replaces shake/sweep with a calm pulse. Pet puts shades on during any blast tier ≥1.
- Log every distraction: timestamp, matched rule, tier. Count per session + per day.
- Auto-hide pet during meetings (Teams/Zoom/Meet/WebEx detection) and fullscreen apps (toggleable). Snooze lasers 15 min from tray.

### 5.4 Breaks + nudges
- Activities rotate per cycle; long-break pool separate. Sign tap = done → nod + logged.
- **Break nudge:** if user keeps working (OS active) 90s into a break → wiggling sign "rest, please" + notification (toggleable).
- Guided breathing ring for breathe activity; steam animation on coffee cup; water glass prop per activity.

### 5.5 Tree + idle life
- Tree stages 0–4 at lifetime totals 0/5/15/40/80 sessions. Stage-up → notification "The Bodhi tree grew". Same seeded procedural canopy every launch (deterministic, not random per load).
- Idle/ready: pet cycles relaxed poses every ~8s (headphones-listening, reading-newspaper). Falling leaves only during unpaused focus.

### 5.6 Tasks
- CRUD + reorder + estimates (1–12, supports quick-add syntax "Write report 3p"), current-task pointer, sessions-done counter, mark done (logs to day + advances pointer), today's done list. Task line under pet label shows `title · done/est`, click opens tasks.

### 5.7 Reports + wrap-up
- Per-day record: sessions (start/end/minutes/task/distractions/apps), breaks, distractions, awayMin, completedTasks, freeform notes.
- End-of-day at `reportTime` (default 18:00, once/day): bow animation + notification `X sessions · Y focused · Z tasks done`, click opens report.
- Report view: totals header, completed list, time-by-task, timeline, top distracting apps, wellbeing (activities done), editable notes, **Copy** + **Save .md** (file picker, default `Work report YYYY-MM-DD.md`).

### 5.8 Tray + shortcuts + settings
- Tray tooltip shows live phase + time + task; menu: Start/Pause/Skip/Reset, Start session…, Tasks…, Daily report…, Timing presets (Classic 25/5, Short 15/3, Deep 50/10, Monk 90/20, Custom…), Screen submenu, Size submenu, Lasers (enabled/snooze/test blast), Demo walk, Settings…, Quit.
- Global: `Ctrl+Alt+P` start/pause · `S` skip · `T` tasks · `R` report. Must not crash if already taken (warn + continue).
- Settings (all persist, all live-apply): focus/break/long minutes, cycles-before-long, display, size, always-on-top, auto-start break/focus, sound, ask-task-on-start, lasers on/off + max tier + grace + cooldown, block/allow lists (editable), focus apps, away minutes, hide-in-meetings, hide-fullscreen, break nudge, report time, reduce motion, launch-at-login.
- First run: seed defaults + open Settings once with a 3-step onboarding hint (click Bodhi → pick time → pick apps).

### 5.9 Reliability
- Atomic writes (tmp + rename) for all persistence; SQLite in WAL mode with periodic checkpoint.
- Crash restore: on launch, resume focus/break with remaining time if it was active; recover gracefully if it expired while dead.
- Auto-backup DB every 10 min (keep last 3). Single-instance lock (second launch focuses pet). Graceful shutdown persists everything.

## 6. UI/UX system (mandatory design language)

Design tokens (CSS variables): `--bg:#1b1a17; --panel:rgba(28,24,20,.92); --ink:#eee3cc; --muted:#a89c85; --accent:#f59a3c; --accent-hi:#ffb054; --cream:#ffd9a8; --danger:#ff6b5b; --radius:10px;` Font: system stack (`Segoe UI`, San Francisco, system-ui). No webfonts (offline + light).

- **Buttons:** pill, 1px accent border on dark fill; hover inverts to accent fill + dark text; active slightly darker; 130–150ms eases; visible `:focus-visible` ring. Primary CTA: accent gradient + soft shadow.
- **Chips:** toggle pills for times/apps; selected = solid accent, dark bold text.
- **Cards/panels:** near-opaque dark panels, 10px radius, 1px accent border, deep soft shadow; thin accent scrollbars.
- **Motion principles:** everything physical and calm — 200–400ms ease-outs, breathe 5s loop, rise/walk 1.4–1.5s, shake only for max-tier lasers. `prefers-reduced-motion` respected AND an in-app Reduce Motion toggle that kills shake/sweep/leaves.
- **Feedback:** every action acknowledges in <100ms (optimistic UI + chime where apt); destructive actions (delete task, reset) always confirm; empty states always tell the user what to do next ("Nothing open. Add a task above.").
- **Text:** sentence case, warm tone, no jargon. Timer always `MM:SS`. Numbers always `done/estimate`.
- **Accessibility:** all interactive elements keyboard-reachable with visible focus; Esc closes overlays; contrast ≥ 4.5:1 for text; laser feature fully usable with Reduce Motion (pulse + label instead of shake).

Art direction for the SVG monk: soft-3D shaded vector style — pale skin (#fbf3ea), orange robe (#f59a3c) over one shoulder, topknot, dark shades (idle) / closed serene eyes (focus) / glowing red lenses (blast). Tree: gnarled trunk + dense two-tone canopy + pink blossoms at stages 3–4. Cushion: deep red. Ground: layered green ellipse. All figures origin-anchored bottom-center for walk/breathe transforms.

## 7. Data model (SQLite)

```sql
-- one row per calendar day (key: YYYY-MM-DD)
days(date TEXT PK, away_min REAL DEFAULT 0, notes TEXT DEFAULT '');
sessions(id INTEGER PK, date TEXT, start_ms INTEGER, end_ms INTEGER,
  minutes REAL, task_id TEXT NULL, task_title TEXT NULL,
  distractions INTEGER DEFAULT 0, extended INTEGER DEFAULT 0, apps_json TEXT DEFAULT '[]');
breaks(id INTEGER PK, date TEXT, start_ms INTEGER, minutes REAL,
  activity TEXT, done INTEGER DEFAULT 0, is_long INTEGER DEFAULT 0);
distractions(id INTEGER PK, date TEXT, at_ms INTEGER, rule TEXT, tier INTEGER);
completed_tasks(id INTEGER PK, date TEXT, task_id TEXT, title TEXT, at_ms INTEGER, sessions INTEGER);
tasks(id TEXT PK, title TEXT, estimate INTEGER DEFAULT 1, sessions_done INTEGER DEFAULT 0,
  done INTEGER DEFAULT 0, created_ms INTEGER, done_ms INTEGER NULL, sort INTEGER DEFAULT 0);
meta(key TEXT PK, value TEXT); -- total_sessions, current_task_id, last_wrap_date, schema_version
```

## 8. Build order (milestones — demo each, keep PRs small)

- **M0 Scaffold:** Tauri 2 + Svelte 5 + TS + Vite running; pet window (transparent/always-on-top/drag); CI lint+test; SQLite connected. Done = pet sits on screen, draggable, position persists.
- **M1 Timer core:** Rust state machine + tick + pause/resume/skip/reset + phases through ready; ring + label + chime; crash restore. Done = full focus→break→ready loop works with keyboard only.
- **M2 Wizard + tasks:** inline 3-step wizard; tasks CRUD; session commit; tree stages. Done = start real sessions with tasks; tree grows at 5 sessions (test with seeded meta).
- **M3 Watcher + lasers:** native sampler; rules engine + escalation (unit-tested); laser overlay aimed at real windows; snooze/test; meeting/fullscreen hide. Done = lasers fire on a distracting app within ~7s in strict mode.
- **M4 Breaks + reports:** activities + sign + breathing ring + nudge; daily report view + wrap-up + export. Done = end-to-end day: sessions → breaks → 18:00 bow → exported .md.
- **M5 Shell polish:** tray menu, global shortcuts, settings window, onboarding, onboarding hints, reduce-motion pass, keyboard/a11y pass. Done = checklist in §5.8 + §6 all green.
- **M6 Ship:** icons, NSIS/DMG/AppImage, auto-update wiring (or documented manual path), README with GIFs, performance budgets verified and pasted into README.

## 9. Definition of done (v1)
- [ ] Every §5 bullet works on Windows; pet+timer+tasks+reports work on macOS/Linux (lasers may degrade gracefully with a clear in-app note where OS APIs forbid it)
- [ ] `rules.rs` + `report.rs` ≥ 90% unit coverage; frontend state logic covered by Vitest; `clippy -D warnings` + ESLint clean
- [ ] Cold start < 1.5s; idle < 1% CPU / < 80MB RAM (measured, not guessed — report method)
- [ ] No console errors; no unhandled promise rejections; no Rust panics in normal use
- [ ] Crash-kill mid-focus → relaunch resumes correctly (tested manually, steps in README)
- [ ] Works fully offline (test with network disabled)
- [ ] README: what/why, GIFs of full loop + lasers, shortcuts, settings tour, build instructions, budgets table

## 10. How to work
- Build milestone by milestone in order; do not scaffold everything upfront.
- After each milestone, show: what works, how to run it, and a screenshot/GIF.
- Keep diffs reviewable (< ~400 lines per change). Refactor mercilessly when a module passes ~300 lines.
- When in doubt, choose the calmer UX and the lighter implementation. Ask before adding ANY dependency — justify weight vs value in KB.

Now: start with M0. Show me the running pet window first.
---
