#!/usr/bin/env python3
"""CLI entry point for Bodhi Supervisor - Daily Stand-up and Goal Setting."""

from dotenv import load_dotenv

from paths import STATE_FILE, atomic_write_json

# Load environment variables
load_dotenv()


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
    """Save the goal to state.json (atomic write)."""
    from datetime import datetime

    state = {
        "daily_goal": goal,
        "session_start": datetime.now().isoformat(),
        "activity_log": []
    }

    atomic_write_json(STATE_FILE, state)

    print(f"\n✅ Goal saved: {goal}")
    print(f"   Session started: {datetime.now().strftime('%H:%M:%S')}")


def load_goal() -> str | None:
    """Load the existing goal from state.json if it exists.

    A missing, corrupt, or half-written state file is treated as "no goal"
    instead of crashing the CLI.
    """
    import json

    if not STATE_FILE.exists():
        return None

    try:
        with open(STATE_FILE, encoding="utf-8") as f:
            state = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"⚠️  Could not read {STATE_FILE.name} ({e}); starting fresh.")
        return None

    goal = state.get("daily_goal")
    return goal if goal else None


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
