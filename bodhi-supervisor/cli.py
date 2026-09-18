#!/usr/bin/env python3
"""CLI entry point for Bodhi Supervisor - Daily Stand-up and Goal Setting."""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

STATE_FILE = Path(__file__).parent / "state.json"


def get_user_goal() -> str:
    """Prompt the user for their main goal for the session."""
    print("\n" + "=" * 50)
    print("  🧘 Bodhi Supervisor - Daily Stand-up")
    print("=" * 50)
    print("\nWhat is your main goal for this session?")
    print("(Be specific - e.g., 'Build the user auth API', 'Refactor the payment module')\n")
    
    while True:
        goal = input("> ").strip()
        if goal:
            return goal
        print("Please enter a goal.")


def save_goal(goal: str) -> None:
    """Save the goal to state.json."""
    import json
    from datetime import datetime
    
    state = {
        "daily_goal": goal,
        "session_start": datetime.now().isoformat(),
        "activity_log": []
    }
    
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)
    
    print(f"\n✅ Goal saved: {goal}")
    print(f"   Session started: {datetime.now().strftime('%H:%M:%S')}")


def load_goal() -> str | None:
    """Load the existing goal from state.json if it exists."""
    if not STATE_FILE.exists():
        return None
    
    import json
    with open(STATE_FILE) as f:
        state = json.load(f)
    return state.get("daily_goal")


def main() -> None:
    """Main CLI entry point."""
    # Check for existing goal
    existing_goal = load_goal()
    
    if existing_goal:
        print(f"\n📌 Previous session goal: {existing_goal}")
        reuse = input("Reuse this goal? (y/n): ").strip().lower()
        if reuse == 'y':
            print(f"\n✅ Continuing with: {existing_goal}")
            return
    
    # Get new goal
    goal = get_user_goal()
    save_goal(goal)


if __name__ == "__main__":
    main()