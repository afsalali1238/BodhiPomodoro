# Bodhi Pomodoro v0.3 — Build Handoff

**Builder:** Afsal · **Reviewer:** Claude · **Updated:** 2026-09-17
**Scope:** personal use, Windows 11, one screen (1280×720 @ 150%) plus any extra monitors. No public release, signing or auto-update.
**This file replaces the v0.2 handoff.** `HANDOFF.md` is the old v1 plan; ignore it.

---

## 1. Product in one paragraph

A small vector monk inspired by the Buddha sits under a Bodhi tree on your desktop. Click him and a **Start panel** opens: pick a time (15/25/50/90/custom), pick or add a task, and tap the apps you'll use. While he meditates, switching to any other app makes him put his shades on and fire lasers. When the session ends you choose **Done ✓ / +5 min / Not yet**, he walks off screen for your break and holds a sign (water, breathe, stretch, rest eyes, coffee). At 18:00 he bows and gives you a daily work report.

**Protect this:** his absence *is* the break. Nothing may compete with that moment.

## 2. Current status

| Area | Status | Notes |
| --- | --- | --- |
| Timer (endsAt), phases, skip, reset, crash restore | Done | See review item R4 |
| Auto size (≈20% of screen height) + compact text | Done | Tray ▸ Size, Settings ▸ Size |
| Start panel: time chips, task pick/add, app chips, strict lasers | Done | `launcher.html/js` |
| Session-end choices (Done ✓ / +5 / Not yet) | Done | Pet + panel, 15 s window |
| Break activities + props + breathing guide + nudge | Done | |
| Away auto-pause | Done | See R5 |
| Lasers: glance → beam → sweep → full, grace, cooldown, snooze | Done | Strict mode = anything outside chosen apps |
| Reduce-motion lasers | Partial | See R2 |
| Hide in meetings / fullscreen | Done, **untested on Windows** | |
| Tasks tab, Today tab | Done | |
| Daily report window (copy, save .md, notes) | Basic | |
| Settings fields (lasers, lists, away, report time…) | Done by you | See R1 |
| Tree growth over weeks | Done | |
| Tests | 9 passing | `npm test` |

## 3. How it works

### 3.1 Loop
```
Idle ─click─▶ Start panel ─Start─▶ Focus ─timer 0─▶ Waking (15 s: Done ✓ | +5 min | Not yet)
  ▲                                                        │
Ready ◀─ Returning ◀─timer 0─ Break (sign + activity) ◀─ WalkingOut
```
- Pause is a flag: `pauseReason` = `user` or `away`.
- Break length follows the chosen time: 15→3, 25→5, 50→10, 90→20, custom ≈ minutes÷5 (3–20). Long break every `cyclesBeforeLong` sessions.

### 3.2 Start panel (`launcher.html/js`)
| Section | Behaviour |
| --- | --- |
| How long? | Chips 15/25/50/90 + custom input (1–240). Shows break length. Remembers last choice. |
| What are you working on? | Radio list of open tasks + “No specific task” + “+ New task…” input (typing overrides the selection). |
| Apps for this session | Chips from `apps:list` (open windows via PowerShell). Tap to toggle. “+ Add app by process name”. ↻ refresh. Remembers last choice. |
| Lasers if I leave these apps | On (default): Start is disabled until ≥ 1 app is chosen. Off: only the distraction list (YouTube etc.) triggers. |
| Start button | “Start 25 min · task name” → `session:start`. Panel hides. |
| While running | Card with phase, time, task, app chips, Pause/Skip/End; in a break, “Did it ✓”; at session end, Done ✓ / +5 min / Not yet. |
| Tasks tab | Add (`… 2p` = 2 sessions), ✓ done, ✕ delete, “Done today” with ↺ reopen. |
| Today tab | Focused, sessions, tasks done, distractions + Open report + Settings. |

### 3.3 Laser rules (`distraction.js`, tested)
1. Ignore our own app and Windows shell processes (explorer, Start, search, lock screen, input host, task manager).
2. **Strict session (apps chosen):** process not in chosen apps → distraction named after the process. Process in chosen apps → still a distraction if the title matches the distraction list (e.g. YouTube tab in Chrome).
3. **Non-strict:** allow list wins, otherwise the distraction list (title or process).
4. Escalation: after 5 s grace → tier 0 glance → 8 s later tier 1 aimed beam (1.5 s) → tier 2 sweep (3 s) → tier 3 sweep + shake + “Return to the path”. 30 s cooldown between beams; offenses counted over 5 min; `laserMax` caps the tier. Refocus stops the beam and he nods.

## 4. Files

| File | Role |
| --- | --- |
| `src/main.js` | Single source of truth: state, timer, phases, tasks, log, lasers, hide logic, windows, tray, shortcuts, IPC, restore |
| `src/distraction.js` | Pure matching + escalation (unit tested) |
| `src/report.js` | Pure report summary + Markdown/plain text (unit tested) |
| `src/watcher.js` | `startWatcher` (foreground window every 1.5 s) + `listApps` (open apps once) via PowerShell |
| `src/preload.js` | `window.bodhi` bridge |
| `src/figures.js` | Vector monk, tree by stage, gradients |
| `src/pet.html/js` | Pet scene, session-end buttons, sign, props, breathing, fx, compact mode |
| `src/walker.html/js` | Walking monk window |
| `src/launcher.html/js` | Start panel + Tasks + Today |
| `src/laser.html/js` | Laser overlay canvas |
| `src/report.html` + `reportView.js` | Daily report window |
| `src/settings.html/js` | Settings |
| `src/tasks.html/js` | **Legacy** picker, no longer opened (see R3) |
| `tests/*.test.js` | `npm test` |

### Data (`%APPDATA%\bodhi-pomodoro\`)
- `settings.json` — `DEFAULTS` in main.js, `schemaVersion: 3`, includes `scale` (`'auto'` or number) and `lastSession {minutes, focusApps, strict}`.
- `tasks.json` — `{ tasks: [{id, title, estimate, sessionsDone, done, createdAt, doneAt}], currentTaskId }`
- `log.json` — `{ totalSessions, lastWrapDate, days: { 'YYYY-MM-DD': { sessions[{start,end,minutes,taskId,taskTitle,distractions,extended,apps}], breaks[], distractions[{at,app,tier}], completedTasks[], awayMin, notes } } }`
- `session.json` — restore snapshot.

### IPC contract (keep names)
| Channel | Dir | Payload / returns |
| --- | --- | --- |
| `state` | main → pet, settings, tasks, launcher | phase, paused, pauseReason, remaining, total, cycle, isLongBreak, activity, activityDone, nudged, fx, treeStage, task, today, session{minutes, apps}, snoozed, petScale, settings |
| `toggle`, `menu` | pet → main | — |
| `pet-action` | pet/launcher → main | `extend` `done` `go` `activity` `tasks` `settings` |
| `action` | settings/launcher → main | `start` `skip` `reset` `demo` `report` `tasks` `testLaser` |
| `open` | launcher → main | `report` `settings` |
| `apps:list` | invoke | `[{process, name, title}]` |
| `session:defaults` | invoke | `{minutes, focusApps, strict, presets}` |
| `session:start` | invoke | `{minutes, taskId, newTask, focusApps, strict}` → `true/false` |
| `launcher-tab` | main → launcher | `start` `tasks` `today` |
| `tasks:list/add/update/delete/reorder/select` | invoke | tasks db |
| `report:get/notes/save`, `clipboard:write` | invoke | see preload |
| `blast` | main → laser | `{lensL, lensR, target, tier, duration, width, height, sound, reduceMotion}` |
| `walker`, `chime`, `report-date`, `drag-*`, `save-settings`, `get-displays` | — | unchanged |

`fx`: `glance` `nod` `bow` `blast` `blast-shake` `null`.

## 5. Review findings to fix (from Claude's review of the current code)

| # | Severity | Issue | Where | Fix |
| --- | --- | --- | --- | --- |
| R1 | High | Every number field is clamped to ≥ 1 on save, so Max tier 0, Grace 0 and similar can't be saved | `settings.js` save | Clamp per field: timing ≥ 1, `laserMax` 0–3, `graceSec` 0–60, `cooldownSec` 5–120, `awayPauseMin` 0–30 (0 = off) |
| R2 | Medium | Reduce-motion outline draws a fixed 120×80 box at the window centre and draws nothing for sweeps (`target` is null) | `laser.js` | Send the offending window rect (`dip`) in `blast`; outline that rect, or the whole screen edge when there's no target |
| R3 | Low | `tasks.html/js` and `openTasks_` are dead code now | `main.js`, `src/tasks.*` | Delete, or keep only if you want a separate window. Port your ↑↓ keyboard navigation into the launcher's task list |
| R4 | Medium | Crash restore doesn't restore `sessionMin` / `sessionApps`, so after a restart lasers fall back to Settings ▸ Focus apps and breaks use settings lengths | `persistSession` / `restoreSession` | Save and restore both fields |
| R5 | Low | Windows lock pauses as `away` but doesn't add to `awayMin` | `powerMonitor 'lock-screen'` | Store `lockedAt`; on resume add the minutes |
| R6 | High (test first) | Store apps (WhatsApp from Microsoft Store, Calculator, Photos) report `ApplicationFrameHost` as the process. In strict mode they either all count as one app or can't be selected (hidden in `listApps`) | `watcher.js`, `distraction.js` | In PowerShell, when the process is ApplicationFrameHost, use the window title's app name (`… - WhatsApp`) as the name; treat it as `uwp:<name>` |
| R7 | Medium | Demo walk reuses the last session's apps, so lasers can fire during the demo | `demoWalk` | Clear `S.sessionApps` in demo |
| R8 | Low | If you have 0 sessions at report time, `lastWrapDate` is set and there's no wrap-up later that day | `endOfDayCheck` | Only set `lastWrapDate` when the wrap-up actually shows |
| R9 | Low | Tray ▸ Timing presets change Settings, but the Start panel remembers its own last time, which can confuse | tray menu | Remove the Timing submenu (the panel owns time) or make it open the panel |
| R10 | Info | Fullscreen YouTube in an allowed Chrome hides the pet and suppresses lasers | `onWindowSample` | By design; add a strict-mode exception if it bothers you |

## 6. Build milestones (you build, I review)

| # | Build | Est. | Done when |
| --- | --- | --- | --- |
| B1 | Run on Windows; walk the acceptance tests below; note failures | 1–2 h | List of what breaks |
| B2 | Fix R1, R4, R7 | 1 h | Tests in §7 #3, #10 pass |
| B3 | Fix R6 (Store apps) + confirm `apps:list` shows your real apps | 2 h | WhatsApp Store app selectable and detected |
| B4 | Tune lasers on real apps (grace, rules, DPI alignment of beams to shades) | 2–3 h | #6–#8 pass on your screen |
| B5 | Fix R2 (reduce motion) | 1 h | Outline matches offending window |
| B6 | Clean up R3, R5, R8, R9 | 1 h | No dead windows or menus |
| B7 | Report polish: weekly totals, WhatsApp-friendly copy | 2–3 h | Paste into WhatsApp reads cleanly |
| B8 | Dogfood 5 workdays | — | No stuck phase; report within 5 min/day of reality |
| B9 | `npm run dist:win` → portable exe | 15 min | Runs from Desktop |

## 7. Acceptance tests (Windows)

| # | Test | Pass |
| --- | --- | --- |
| 1 | Launch on 1280×720 @ 150% | Pet ≈ 120×145 DIP, text readable, Settings/panel fit on screen |
| 2 | Tray ▸ Take Bodhi for a walk | Full loop in ~2 min, no lasers |
| 3 | Panel: 25 min, new task “Test 2p”, apps Chrome + Excel, Start | Pet shows task 0/2; `session.apps` = both |
| 4 | Stay in Excel 30 s | Nothing fires |
| 5 | Alt+Tab / open Start menu briefly | Nothing fires |
| 6 | Switch to WhatsApp for 20 s | Head shake at ~5 s, beam at ~13 s, from his shades toward WhatsApp |
| 7 | In Chrome open YouTube | Lasers after grace even though Chrome is allowed |
| 8 | Switch back to Excel mid-beam | Beam stops within one poll (≤ 1.5 s), he nods |
| 9 | Session end → Done ✓ | Task moves to Done today; report lists it |
| 10 | Session end → +5 min, then kill app in Task Manager, relaunch | Resumes with same time **and same apps** |
| 11 | Idle 3+ min during focus | “Waiting for you”, time not counted, Away > 0 in report |
| 12 | Teams call / fullscreen PowerPoint | Pet hidden, no lasers, timer continues |
| 13 | Keep typing through a break | One “rest, please” nudge |
| 14 | Report time = now + 1 min | Bow + notification → report opens; Copy and Save .md match |
| 15 | Drag pet to a second monitor | Selected display switches; walk and lasers stay on that monitor |

## 8. Review protocol

Send me any of these and I'll review against this handoff:
- **A file or diff:** “review B3” + paste, or say which files changed in the folder (I can read `prototype/`).
- **A bug:** what you did, what happened, what you expected, plus a screenshot if it's visual.
- **A console error:** run `npm start` from a terminal and paste the output.

What I check each time:
1. **Contracts:** IPC names, state fields and data file shapes are unchanged or updated in this doc.
2. **Main is the source of truth:** no timers or phase decisions in renderers.
3. **Pure logic stays pure and tested:** matching, escalation, report. Add a test for any rule change.
4. **Edge cases:** pause/away/hidden/snoozed during every phase; restart mid-phase; multi-monitor and DPI.
5. **Privacy:** window titles never written to disk; only the matched rule or process name is logged.
6. **UX guardrails:** the break moment stays clean; nothing steals focus while you type; lasers never fire in breaks, meetings or fullscreen.

I'll reply with a table: severity · file:line · issue · suggested fix, plus a patch when it's small.
