# Bodhi Pomodoro

A minimalist desktop focus timer with a monk character that sits beside you while you work.

## Features

- **Focus timer** with customizable session lengths
- **Distraction detection** — lasers fire when you drift to blocked sites/apps
- **Break reminders** — water, stretch, breathe, eye rest prompts  
- **Tree growth** — your Bodhi tree grows as you complete sessions
- **Daily reports** — track focus time, tasks completed, and distractions
- **Always-on-top** — pet stays visible above all windows
- **Away detection** — pauses timer when you step away

## Quick Start

```bash
npm install
npm start
```

## Usage

- **Click the monk** to start a focus session
- **Right-click** to open the tray menu
- **Ctrl+Alt+P** — start/pause
- **Ctrl+Alt+S** — skip current phase
- **Ctrl+Alt+T** — open task picker
- **Ctrl+Alt+R** — daily work report

## Config

Settings window lets you customize:
- Focus/break durations
- Allowed and blocked apps (lasers fire outside allowed apps)
- Away detection time
- Hide in meetings/fullscreen
- Laser behavior

## Build

```bash
npm run dist:win
```

## License

MIT
