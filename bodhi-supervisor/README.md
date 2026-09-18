# Bodhi: AI Tech Lead & Accountability Partner

Bodhi is a proactive, AI-driven background supervisor designed to keep you focused, manage your priorities, and actively push back when you get distracted or go off-track.

## ✅ Implementation Status

**Phase 1 (Foundation) - DONE**
- [x] Python project with virtual environment
- [x] `cli.py` - Daily stand-up goal setting
- [x] `brain.py` - LLM integration (OpenAI/Gemini)
- [x] Basic test scripts

**Phase 2 (OS Monitoring) - DONE**
- [x] `monitor.py` - Window tracking via `pygetwindow`
- [x] `monitor.py` - File watching via `watchdog`
- [x] `monitor.py` - Git status watching
- [x] `state_manager.py` - Activity aggregation & summaries

**Phase 3 (Interventions) - DONE**
- [x] `notifier.py` - Windows toast notifications (`win10toast`)
- [x] `notifier.py` - Blocking Tkinter intervention dialog
- [x] Full daemon integration in `bodhi.py`

**Phase 4 (Codebase Awareness) - PARTIAL**
- [x] File watcher integrated
- [x] Git diff/status reading
- [ ] `bodhi next` command (partially - `bodhi.py --next` works)

**Phase 5 (Daemonization) - PENDING**
- [ ] Windows startup registration
- [ ] Prompt fine-tuning

## 🚀 Quick Start

```bash
# 1. Navigate to project
cd "C:\Users\HP\Desktop\antigravity\Buddha pet\bodhi-supervisor"

# 2. Activate venv & install deps (done once)
.\venv\Scripts\activate
pip install -r requirements.txt

# 3. Add API key to .env (required for LLM evaluations)
cp .env.example .env
# Edit .env with your OPENAI_API_KEY or GEMINI_API_KEY

# 4. Start Bodhi
# Option A: Double-click start_bodhi.bat
# Option B: Run directly
python bodhi.py --project . --eval-interval 300 --poll-interval 10
```

## 📋 Commands

```bash
# Start monitoring (daemon mode)
python bodhi.py --project . --eval-interval 300 --poll-interval 10

# Show current status
python bodhi.py --status

# Get next task suggestion
python bodhi.py --next

# Reset session (keep goal)
python bodhi.py --reset

# Run CLI standalone (set goal)
python cli.py

# Test all modules
python test_modules.py
```

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌─────────────┐
│   cli.py    │────▶│ state_manager│◀───│  monitor.py │────▶│  brain.py   │
│ (Goal Set)  │     │  (Memory)    │     │  (Eyes)    │     │  (LLM)      │
└─────────────┘     └──────┬───────┘     └────────────┘     └──────┬──────┘
                           │                                         │
                           ▼                                         ▼
                    ┌──────────────┐                         ┌─────────────┐
                    │  notifier.py │◀────────────────────────│  Evaluation │
                    │  (Voice)     │                         │  Loop       │
                    └──────────────┘                         └─────────────┘
```

**Data Flow:**
1. User sets goal via `cli.py` → saved to `state.json`
2. `WindowTracker` polls active window every 10s
3. `FileWatcher` catches file saves in project dir
4. `GitWatcher` reads repo status on demand
5. Every 5 min, `brain.py` evaluates activity vs goal via LLM
6. If off-track, `notifier.py` fires toast or blocking dialog

## 🔧 Configuration

Edit `.env`:
```env
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=...

# Optional intervals
POLL_INTERVAL=10      # Window poll seconds
EVAL_INTERVAL=300     # LLM evaluation seconds
```

## 🛠️ Tech Stack

- **Python** 3.10+
- **OS Integration**: `pygetwindow`, `psutil`, `watchdog`, `win10toast`
- **AI**: OpenAI API / Google Gemini API
- **State**: JSON file (`state.json`)
- **UI**: Tkinter (blocking dialogs)

## 📁 Project Structure

```
bodhi-supervisor/
├── bodhi.py           # Main daemon entry point
├── cli.py             # Goal setting CLI
├── brain.py           # LLM evaluation & suggestions
├── monitor.py         # Window/file/git monitoring
├── state_manager.py   # State persistence & aggregation
├── notifier.py        # Toast + blocking interventions
├── test_modules.py    # Module verification tests
├── start_bodhi.bat    # Windows quick-start
├── start_bodhi.ps1    # PowerShell quick-start
├── requirements.txt   # Dependencies
├── .env.example       # Config template
├── state.json         # Runtime state (auto-generated)
└── venv/              # Virtual environment
```

## 🎯 Next Steps

1. **Add API key** to `.env` for LLM evaluations
2. **Run `python bodhi.py --project .`** to start monitoring
3. **Test pushback** by opening distracting apps (YouTube, social media)
4. **Fine-tune prompts** in `brain.py` if interventions are too aggressive/passive
5. **Add to Windows startup** using Task Scheduler or `shell:startup`