#!/usr/bin/env python3
"""Bodhi Supervisor - Main daemon orchestrating monitoring, evaluation, and interventions."""

import os
import time
import threading
import signal
import sys
from pathlib import Path
from typing import Optional

# Import our modules
from cli import get_user_goal, save_goal
from state_manager import StateManager
from monitor import WindowTracker, FileWatcher, GitWatcher, save_activity_entry
from brain import Brain
from notifier import Notifier, BlockingIntervention


class BodhiDaemon:
    """Main Bodhi supervisor daemon."""

    def __init__(self, project_path: Optional[str] = None,
                 eval_interval: int = 300,  # 5 minutes
                 poll_interval: int = 10):   # 10 seconds
        self.project_path = Path(project_path).resolve() if project_path else Path.cwd()
        self.eval_interval = eval_interval
        self.poll_interval = poll_interval

        self.state = StateManager()
        self.brain: Optional[Brain] = None
        self.notifier = Notifier()
        self.blocking = BlockingIntervention()

        # Monitoring components
        self.window_tracker: Optional[WindowTracker] = None
        self.file_watcher: Optional[FileWatcher] = None
        self.git_watcher: Optional[GitWatcher] = None

        # Control
        self.running = False
        self._eval_thread: Optional[threading.Thread] = None
        self._shutdown = threading.Event()

    def initialize(self) -> bool:
        """Initialize all components. Returns True if ready to run."""
        # Check for goal
        if not self.state.has_goal():
            print("No goal set. Running CLI to get goal...")
            goal = get_user_goal()
            save_goal(goal)
            self.state.set_goal(goal)

        goal = self.state.get_goal()
        print(f"🎯 Goal: {goal}")

        # Initialize brain (requires API key)
        try:
            provider = "openai" if "OPENAI_API_KEY" in os.environ else "gemini"
            self.brain = Brain(provider=provider, project_path=str(self.project_path))
            print(f"🧠 Brain initialized ({provider})")
        except ValueError as e:
            print(f"⚠️  Brain not available: {e}")
            print("   Set OPENAI_API_KEY or GEMINI_API_KEY in .env for LLM evaluations")
            self.brain = None

        # Initialize monitors
        self.window_tracker = WindowTracker(
            interval=self.poll_interval,
            callback=self._on_activity
        )

        self.file_watcher = FileWatcher(
            watch_path=str(self.project_path),
            callback=self._on_activity
        )

        self.git_watcher = GitWatcher(str(self.project_path))

        print(f"📁 Watching project: {self.project_path}")
        print(f"⏱️  Poll interval: {self.poll_interval}s, Eval interval: {self.eval_interval}s")

        return True

    def _on_activity(self, entry: str) -> None:
        """Callback for activity from monitors."""
        save_activity_entry(entry)

    def start(self) -> None:
        """Start the daemon."""
        if self.running:
            return

        print("\n🚀 Starting Bodhi Supervisor...")
        self.running = True
        self._shutdown.clear()

        # Start monitors
        self.window_tracker.start()
        self.file_watcher.start()

        # Start evaluation loop
        self._eval_thread = threading.Thread(target=self._evaluation_loop, daemon=True)
        self._eval_thread.start()

        print("✅ Bodhi is running. Press Ctrl+C to stop.\n")

    def stop(self) -> None:
        """Stop the daemon."""
        if not self.running:
            return

        print("\n🛑 Stopping Bodhi...")
        self.running = False
        self._shutdown.set()

        # Stop monitors
        if self.window_tracker:
            self.window_tracker.stop()
        if self.file_watcher:
            self.file_watcher.stop()

        # Wait for eval thread
        if self._eval_thread:
            self._eval_thread.join(timeout=5)

        print("✅ Bodhi stopped.")

    def _evaluation_loop(self) -> None:
        """Periodic evaluation loop."""
        while self.running and not self._shutdown.is_set():
            # Wait for interval or shutdown
            self._shutdown.wait(self.eval_interval)

            if not self.running or self._shutdown.is_set():
                break

            self._evaluate()

    def _evaluate(self) -> None:
        """Run a single evaluation cycle."""
        if not self.brain:
            return

        goal = self.state.get_goal()
        if not goal:
            return

        # Get recent activity summary
        activity_summary = self.state.get_formatted_summary(15)  # Last 15 min

        if activity_summary == "No recent activity.":
            return

        # Get activity log for brain
        recent_activity = self.state.get_recent_activity(15)

        print(f"\n[Eval] Checking focus... ({len(recent_activity)} recent entries)")

        try:
            result = self.brain.evaluate(goal, recent_activity)

            if result != "OK":
                print(f"[Eval] Pushback: {result}")
                self._intervene(result)
            else:
                print("[Eval] OK - On track")

        except Exception as e:
            print(f"[Eval] Error: {e}")

    def _intervene(self, message: str) -> None:
        """Trigger an intervention."""
        # First try toast notification
        sent = self.notifier.notify_pushback(message)

        if not sent:
            print("[Notify] Rate limited, trying blocking dialog...")
            # Fallback to blocking dialog
            response = self.blocking.show(
                "Bodhi - Focus Intervention",
                message,
                require_response=True
            )
            if response:
                self.state.log_intervention(message, response)
                print(f"[Intervention] User responded: {response}")
        else:
            # Log intervention with empty response (toast doesn't capture response)
            self.state.log_intervention(message, "")

    def suggest_next_task(self) -> str:
        """Get next task suggestion from brain."""
        if not self.brain:
            return "Brain not available (no API key)"

        goal = self.state.get_goal()
        recent_files = [e for e in self.state.get_all_activity() if "File saved" in e][-10:]
        git_diff = self.git_watcher.get_diff_summary() if self.git_watcher else ""

        try:
            return self.brain.suggest_next_task(goal, git_diff, recent_files)
        except Exception as e:
            return f"Error getting suggestion: {e}"


#: The running daemon instance (set in main()). Module-level so the signal
#: handler can reach it without poking at globals().
daemon: Optional["BodhiDaemon"] = None


def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully."""
    print("\n\nReceived shutdown signal...")
    if daemon is not None:
        daemon.stop()
    sys.exit(0)


def main() -> None:
    """Main entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Bodhi Supervisor - AI Focus Guardian")
    parser.add_argument("--project", "-p", help="Project directory to watch")
    parser.add_argument("--eval-interval", "-e", type=int, default=300,
                        help="Evaluation interval in seconds (default: 300)")
    parser.add_argument("--poll-interval", type=int, default=10,
                        help="Window poll interval in seconds (default: 10)")
    parser.add_argument("--next", action="store_true",
                        help="Get next task suggestion and exit")
    parser.add_argument("--status", action="store_true",
                        help="Show current status and exit")
    parser.add_argument("--reset", action="store_true",
                        help="Reset session (keep goal)")

    args = parser.parse_args()

    # Handle special commands
    if args.reset:
        StateManager().reset_session()
        print("Session reset.")
        return

    if args.status:
        sm = StateManager()
        goal = sm.get_goal()
        duration = sm.get_session_duration()
        pomo = sm.get_pomodoro_count()
        interventions = sm.get_interventions()

        print(f"Goal: {goal or 'Not set'}")
        print(f"Session: {duration}")
        print(f"Pomodoros: {pomo}")
        print(f"Interventions: {len(interventions)}")
        print("\nRecent activity:")
        for a in sm.get_recent_activity(30)[-10:]:
            print(f"  {a}")
        return

    # Create daemon
    global daemon
    daemon = BodhiDaemon(
        project_path=args.project,
        eval_interval=args.eval_interval,
        poll_interval=args.poll_interval
    )

    if not daemon.initialize():
        return

    if args.next:
        suggestion = daemon.suggest_next_task()
        print(f"\n💡 Next task suggestion:\n{suggestion}")
        return

    # Set up signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Run
    daemon.start()

    # Keep main thread alive
    try:
        while daemon.running:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        daemon.stop()


if __name__ == "__main__":
    main()
