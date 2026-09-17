# Screenshots & animations — paste into the root `README.md`

All of it is rendered from the app's own UI files (`src/pet.html`, `laser.html`, the wizard) at 2×.
Files live in `prototype/docs/images/`; the paths below are written for the **repo-root** README.

```markdown
## See it work

### One full cycle — focus, session end, walk out, break, return
<p align="center">
  <img src="prototype/docs/images/full-loop.gif" width="280" alt="Bodhi sits, meditates, stands up, walks behind the tree, the break sign appears, then he comes back">
</p>

### Start a session in three taps
<p align="center">
  <img src="prototype/docs/images/start-wizard.gif" width="300" alt="Duration, then task, then the apps you'll use">
</p>

| Duration | Task | Focus apps |
| --- | --- | --- |
| <img src="prototype/docs/images/wizard-1-time.png" width="230"> | <img src="prototype/docs/images/wizard-2-task.png" width="230"> | <img src="prototype/docs/images/wizard-3-apps.png" width="230"> |

### Drift off and he fires
<p align="center">
  <img src="prototype/docs/images/lasers-desktop.gif" width="820" alt="Beams sweeping across the desktop at a chat window">
</p>

Head shake first, then the shades go on, then the screen shakes and the pill reads *Return to the path*.

<p align="center">
  <img src="prototype/docs/images/distraction.gif" width="260" alt="Glance, shades, shake, nod">
</p>

### Breaks you actually take
<p align="center">
  <img src="prototype/docs/images/breathing.gif" width="260" alt="Breathe in 4, hold 4, out 6">
  <img src="prototype/docs/images/07-break-water.png" width="230" alt="Drink water sign on the empty cushion">
</p>

### He keeps himself busy while you're idle
<p align="center">
  <img src="prototype/docs/images/idle-poses.gif" width="240" alt="Headphones, then reading">
</p>

### The tree grows with you
<p align="center">
  <img src="prototype/docs/images/tree-growth.gif" width="240" alt="Sapling to full canopy">
  <img src="prototype/docs/images/tree-growth.png" width="640" alt="All five stages side by side">
</p>

### End of day
<p align="center"><img src="prototype/docs/images/report.png" width="620" alt="Daily work report: time by task, timeline, distractions, notes"></p>
```

## What's in `images/`

| File | Size | Shows |
| --- | --- | --- |
| `full-loop.gif` | 1.5 MB | 85 frames: idle → focus → session-end buttons → stands → walks behind the tree → break sign → returns |
| `lasers-desktop.gif` | 266 KB | Beams sweeping the desktop toward a chat window |
| `distraction.gif` | 605 KB | Glance → shades on → shake → nod when you come back |
| `start-wizard.gif` | 180 KB | The three wizard steps |
| `breathing.gif` | 406 KB | Breathing circle, in 4 · hold 4 · out 6 |
| `idle-poses.gif` | 138 KB | Headphones / reading |
| `tree-growth.gif` · `tree-growth.png` | 82 KB · 1 MB | Growth stages, animated and side by side |
| `01-idle · 02-focus · 04-glance · 05-blast · 05b-shake · 06-session-end · 07-break-water · 08-break-breathe` | — | Stills, transparent PNG at 2× |
| `wizard-1-time · wizard-2-task · wizard-3-apps` | — | Wizard steps as stills |
| `report.png` | 203 KB | Daily report window |

Total ≈ 5.5 MB. GitHub plays the GIFs inline; no clicks needed.

## Re-rendering

The GIFs come from a Playwright script that loads `src/pet.html` with a mocked `window.bodhi`, pushes state objects (`phase`, `fx`, `activity`, …) and screenshots each frame, then stitches them with Pillow. Ask Claude to re-render after any UI change — the frame recipes are per-phase and take a couple of minutes.
