# Bodhi Development Roadmap

This roadmap breaks down the coding tasks into manageable phases. Since you are building this from scratch, follow these phases to ensure you have a working prototype quickly.

## Phase 1: The Foundation & The Goal Setter 
*Goal: Get the script running, taking input, and talking to an LLM.*
- [ ] Initialize the Python project and virtual environment.
- [ ] Create `cli.py` to prompt the user on startup: "What is your main goal for today?"
- [ ] Set up `brain.py` with your LLM API keys (OpenAI, Gemini, or local models via Ollama).
- [ ] Write a basic test script where you pass a fake "activity" string to the LLM and get a "pushback" response.

## Phase 2: The "Eyes" (OS Monitoring)
*Goal: Allow the system to automatically see what you are doing.*
- [ ] Implement `monitor.py` using `pygetwindow`.
- [ ] Create a loop that logs the active window title every 10 seconds.
- [ ] Implement `state_manager.py` to aggregate these 10-second polls into a summary (e.g., "10:00-10:15 - VS Code (app.py)").
- [ ] Combine Phase 1 and 2: Have the LLM read the window summary and judge it against the stated goal.

## Phase 3: The Interventions
*Goal: Allow the system to interrupt you effectively.*
- [ ] Implement `notifier.py` using `win10toast` to send Windows native notifications.
- [ ] Wire the system together: Polling -> LLM Evaluation -> Windows Toast (if off-track).
- [ ] **Bonus**: Build a "hard block" UI (e.g., using `tkinter`) that takes up the center of the screen and forces you to type a response explaining why you are off-track before it closes.

## Phase 4: Codebase & Git Awareness
*Goal: Make Bodhi a "Tech Lead", not just a time tracker.*
- [ ] Add `watchdog` to monitor your project folder for file saves.
- [ ] When a file is saved, append the filename and a brief summary of changes to the state.
- [ ] Add a feature where typing `bodhi next` in the terminal analyzes `git diff` and suggests the highest-priority next coding task based on the project architecture.

## Phase 5: Refinement & Daemonization
- [ ] Configure the script to run silently in the background on Windows startup.
- [ ] Fine-tune the LLM prompts so it is helpful but not annoying (finding the right balance of pushback).
