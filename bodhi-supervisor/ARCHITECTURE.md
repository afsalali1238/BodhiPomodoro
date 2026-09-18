# Bodhi Architecture

This document outlines the software architecture for the Bodhi Supervisor. The system is designed as a modular background daemon (running locally on Windows) that collects context, processes it through an LLM, and triggers interventions.

## 🏗️ System Components

The project should be broken down into four main modules:

### 1. `monitor.py` (The Eyes)
Responsible for gathering telemetry from the user's machine.
- **Window Tracker**: Uses `pygetwindow` and `psutil` to poll the active window title every `X` seconds. (e.g., identifies if the user is in "VS Code - main.py" vs. "YouTube - Google Chrome").
- **File Watcher**: Uses `watchdog` to monitor the active project directory for file saves. If a file is modified, it logs the file path and a brief summary/diff.
- **Git Watcher**: Reads `git status` or recent commits to understand the macro-state of the codebase.

### 2. `state_manager.py` (The Memory)
Maintains the current context of the session.
- Stores the "Daily Goal" set by the user.
- Keeps a rolling buffer of the last 30 minutes of activity (e.g., "Spent 15 mins in CSS, 5 mins in browser").
- Can be implemented as a simple `state.json` file or an in-memory SQLite database.

### 3. `brain.py` (The Tech Lead)
The core logic that communicates with the LLM.
- Periodically (e.g., every 15 minutes, or triggered by a threshold of distracting behavior) sends the data from `state_manager.py` to the LLM.
- **Prompt Structure**: 
  *"You are an assertive AI Tech Lead. The user's stated goal is [Goal]. Over the last 15 minutes, they have been working on [Window/File Activity]. Evaluate if they are on track. If they are distracted or working on low-priority items, generate a short, firm pushback message. If they are on track, output 'OK'."*

### 4. `notifier.py` (The Voice)
Responsible for interrupting the user.
- Uses `win10toast` or custom Tkinter/PyQt popups to display the LLM's pushback directly on the screen.
- Can optionally require the user to type a justification before the popup closes (forcing accountability).

## 🔄 Data Flow

1. User starts the Bodhi daemon.
2. CLI prompts the user: *"What is the main goal for this session?"* -> Saves to State.
3. `monitor.py` begins polling in the background, updating the State continuously.
4. Every `N` minutes, `brain.py` analyzes the State via the LLM.
5. If the LLM determines an intervention is needed, `notifier.py` fires a desktop notification.
6. User acknowledges the notification, and the loop continues.
