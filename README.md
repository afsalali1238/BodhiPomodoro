<div align="center">
  <h1>🧘‍♂️ Bodhi Pomodoro</h1>
  <p><b>Your personal vector desktop monk who lives on your screen, helps you focus, and occasionally shoots lasers at your distractions.</b></p>
  
  *A highly optimized, transparent desktop pet built with Electron & Vanilla JS.*
</div>

---

> **Platform support:** Bodhi runs on Windows, macOS, and Linux as a focus timer and
> desktop pet. The **distraction-detection lasers, "Pick from running apps," and
> "Start with Windows"** features rely on a Windows-only foreground-window watcher
> (native C#, compiled on the fly, with a PowerShell fallback) and are currently
> **Windows-only**. On macOS/Linux those features are automatically disabled and
> Bodhi still works great as a timer/desktop pet.

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

## 🌟 What is Bodhi Pomodoro?

Traditional Pomodoro apps hide in your menu bar. Bodhi lives **on your screen**. 

He sits peacefully under a Bodhi tree (which actually grows as you complete more sessions) right on top of your windows. When you're focusing, he breathes with you. When it's time for a break, he goes for a walk. 

And when you get distracted by Twitter or YouTube? He gently (and then not-so-gently) reminds you to get back to work using **screen-tracking lasers**. 💥

## ✨ Features

### 🎯 The Focus Master
* **Inline Quick Start:** Just click Bodhi to open a compact, 3-step wizard. Pick your time, type your task, choose which apps are "allowed", and go!
* **Smart Distraction Detection:** Bodhi uses a highly optimized, native C# window watcher (using near 0% CPU!) to know what app you're looking at.
* **Laser Nudges:** If you open a distracting app during a focus session, Bodhi gives you a 5-second grace period. If you don't switch back, he fires animated lasers directly at the offending window! *(Supports a "reduce motion" mode for accessibility).*

### 🌳 Grow Together
* **The Bodhi Tree:** Every time you complete a focus session, you gain experience. Complete enough sessions, and the Bodhi tree behind him grows into a beautiful, sprawling canopy.
* **Idle Chilling:** When you aren't running a timer, Bodhi relaxes. You'll catch him reading a newspaper, listening to music with headphones, or just taking a nap.
* **In-Scene Animations:** No clunky separate windows. When it's break time, Bodhi seamlessly stands up, walks *behind* his tree, and disappears to take a rest.

### 📊 Meaningful Reports
* **Daily Wrap-up:** At the end of your workday (configurable in settings), Bodhi takes a bow and generates a beautiful Markdown report of your day.
* **Task Tracking:** Track exactly what you worked on, how many distractions you had, and how much deep focus time you achieved.

### ⚙️ Deeply Customizable
* **Multi-Monitor Support:** Drag Bodhi to whichever screen you're working on.
* **Flexible Timers:** Classic (25/5), Deep (50/10), Monk Mode (90/20), or entirely custom.
* **Auto-Away:** Automatically pauses your timer if your computer is idle for too long (e.g., you walked away for coffee).
* **Strict Mode:** Only allow specific apps (like VS Code and Figma); everything else triggers the lasers!

---

## 🛠️ Tech Stack & Architecture

Bodhi is designed to be **incredibly lightweight**. 

* **Vanilla JS + Electron:** No heavy React/Vue bundles. UI interactions are lightning-fast.
* **Native C# Watcher:** Instead of polling with heavy Node modules or PowerShell, Bodhi compiles a tiny 8KB native binary on the fly that tracks foreground windows with almost zero memory or battery drain.
* **Atomic Storage:** Your tasks and sessions are saved atomically with automatic backups, ensuring your data never corrupts on a crash.
* **Procedural SVG:** The pet, tree, and props aren't massive GIF files—they are dynamically generated SVGs, meaning they scale perfectly to any DPI and weigh almost nothing.

## 🚀 Getting Started

To run Bodhi locally from the source:

```bash
# 1. Clone the repository
git clone https://github.com/afsalali1238/BodhiPomodoro.git

# 2. Enter the prototype directory
cd prototype

# 3. Install dependencies
npm install

# 4. Start Bodhi!
npm start
```

## 🧪 Development

```bash
cd prototype
npm install
npm test        # unit tests (state machine, distraction rules, reports, storage)
npm run lint    # ESLint
```

CI runs both on every push/PR (see `.github/workflows/ci.yml`).

## ⌨️ Shortcuts

Bodhi respects your workflow. Use global hotkeys anywhere in Windows:
* `Ctrl + Alt + P` - Start/Pause/Resume Focus
* `Ctrl + Alt + S` - Skip current phase (Finish focus early / Skip break)
* `Ctrl + Alt + T` - Open your Task list
* `Ctrl + Alt + R` - Open your Daily Report

---
<div align="center">
  <i>Stay focused. Protect your time. Grow the tree.</i> 🌳
</div>
