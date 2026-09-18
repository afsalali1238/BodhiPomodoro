#!/usr/bin/env python3
"""State Manager - Persistent session state and activity aggregation."""

import json
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional
from collections import defaultdict

STATE_FILE = Path(__file__).parent / "state.json"


class StateManager:
    """Manages persistent session state including goal, activity log, and aggregated summaries."""
    
    def __init__(self, state_file: Path = STATE_FILE):
        self.state_file = state_file
        self._state = self._load()
    
    def _load(self) -> dict:
        """Load state from file."""
        default = {
            "daily_goal": "",
            "session_start": "",
            "activity_log": [],
            "interventions": [],
            "pomodoro_count": 0
        }
        if not self.state_file.exists():
            return default
        try:
            with open(self.state_file) as f:
                data = json.load(f)
            # Ensure all keys exist
            for k, v in default.items():
                if k not in data:
                    data[k] = v
            return data
        except Exception:
            return default
    
    def _save(self) -> None:
        """Save state to file."""
        with open(self.state_file, "w") as f:
            json.dump(self._state, f, indent=2)
    
    # Goal management
    def set_goal(self, goal: str) -> None:
        """Set the daily goal."""
        self._state["daily_goal"] = goal
        self._state["session_start"] = datetime.now().isoformat()
        self._state["activity_log"] = []
        self._state["interventions"] = []
        self._save()
    
    def get_goal(self) -> str:
        """Get the current daily goal."""
        return self._state.get("daily_goal", "")
    
    def has_goal(self) -> bool:
        """Check if a goal is set."""
        return bool(self._state.get("daily_goal", "").strip())
    
    # Activity logging
    def log_activity(self, entry: str) -> None:
        """Add an activity entry."""
        self._state["activity_log"].append(entry)
        # Keep last 200 entries
        if len(self._state["activity_log"]) > 200:
            self._state["activity_log"] = self._state["activity_log"][-200:]
        self._save()
    
    def get_recent_activity(self, minutes: int = 15) -> list:
        """Get activity entries from the last N minutes."""
        if not self._state["activity_log"]:
            return []
        
        cutoff = datetime.now() - timedelta(minutes=minutes)
        recent = []
        for entry in self._state["activity_log"]:
            # Parse timestamp from entry (format: "HH:MM - ...")
            try:
                time_str = entry.split(" - ")[0]
                entry_time = datetime.now().replace(
                    hour=int(time_str.split(":")[0]),
                    minute=int(time_str.split(":")[1]),
                    second=0,
                    microsecond=0
                )
                # Handle midnight crossover
                if entry_time > datetime.now():
                    entry_time -= timedelta(days=1)
                if entry_time >= cutoff:
                    recent.append(entry)
            except Exception:
                # If parsing fails, include it anyway
                recent.append(entry)
        
        return recent
    
    def get_all_activity(self) -> list:
        """Get all activity entries."""
        return self._state["activity_log"]
    
    # Aggregation / Summarization
    def get_time_summary(self, minutes: int = 30) -> dict:
        """Aggregate time spent per app in the last N minutes."""
        recent = self.get_recent_activity(minutes)
        app_time = defaultdict(int)
        
        for entry in recent:
            try:
                # Format: "HH:MM - App: Title"
                parts = entry.split(" - ", 1)
                if len(parts) < 2:
                    continue
                app_part = parts[1].split(":")[0].strip()
                app_time[app_part] += 1  # Each entry = ~1 poll interval (10s)
            except Exception:
                continue
        
        # Convert to minutes (assuming 10s polls)
        return {app: count * 10 / 60 for app, count in app_time.items()}
    
    def get_top_apps(self, minutes: int = 30, top_n: int = 5) -> list:
        """Get top N apps by time spent."""
        summary = self.get_time_summary(minutes)
        return sorted(summary.items(), key=lambda x: x[1], reverse=True)[:top_n]
    
    def get_formatted_summary(self, minutes: int = 15) -> str:
        """Get a human-readable summary for the LLM."""
        recent = self.get_recent_activity(minutes)
        if not recent:
            return "No recent activity."
        
        # Group by app
        by_app = defaultdict(list)
        for entry in recent:
            try:
                parts = entry.split(" - ", 1)
                if len(parts) < 2:
                    continue
                app = parts[1].split(":")[0].strip()
                by_app[app].append(parts[1])
            except Exception:
                continue
        
        lines = []
        for app, titles in by_app.items():
            unique_titles = list(dict.fromkeys(titles))  # Preserve order, dedupe
            lines.append(f"{app}: {', '.join(unique_titles[:3])}" + 
                        (f" (+{len(unique_titles)-3} more)" if len(unique_titles) > 3 else ""))
        
        return "\n".join(lines) if lines else "No recent activity."
    
    # Interventions
    def log_intervention(self, message: str, user_response: str = "") -> None:
        """Log an intervention and user response."""
        self._state["interventions"].append({
            "timestamp": datetime.now().isoformat(),
            "message": message,
            "user_response": user_response
        })
        self._save()
    
    def get_interventions(self) -> list:
        """Get all interventions."""
        return self._state.get("interventions", [])
    
    # Pomodoro
    def increment_pomodoro(self) -> int:
        """Increment and return pomodoro count."""
        self._state["pomodoro_count"] = self._state.get("pomodoro_count", 0) + 1
        self._save()
        return self._state["pomodoro_count"]
    
    def get_pomodoro_count(self) -> int:
        """Get current pomodoro count."""
        return self._state.get("pomodoro_count", 0)
    
    # Session info
    def get_session_duration(self) -> Optional[timedelta]:
        """Get session duration."""
        start_str = self._state.get("session_start")
        if not start_str:
            return None
        try:
            start = datetime.fromisoformat(start_str)
            return datetime.now() - start
        except Exception:
            return None
    
    def reset_session(self) -> None:
        """Reset session state (keep goal)."""
        goal = self._state.get("daily_goal", "")
        self._state = {
            "daily_goal": goal,
            "session_start": datetime.now().isoformat(),
            "activity_log": [],
            "interventions": [],
            "pomodoro_count": 0
        }
        self._save()


def test_state_manager() -> None:
    """Quick test of state manager."""
    sm = StateManager()
    
    # Test goal
    sm.set_goal("Build the auth API")
    print(f"Goal: {sm.get_goal()}")
    
    # Test activity logging
    sm.log_activity("10:00 - Code.exe: auth.py")
    sm.log_activity("10:01 - Code.exe: auth.py")
    sm.log_activity("10:02 - chrome.exe: YouTube")
    sm.log_activity("10:03 - Code.exe: models.py")
    
    print(f"\nRecent activity (5 min):")
    for a in sm.get_recent_activity(5):
        print(f"  {a}")
    
    print(f"\nFormatted summary:")
    print(sm.get_formatted_summary(5))
    
    print(f"\nTime summary:")
    for app, mins in sm.get_time_summary(5).items():
        print(f"  {app}: {mins:.1f} min")


if __name__ == "__main__":
    test_state_manager()