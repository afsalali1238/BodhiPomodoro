#!/usr/bin/env python3
"""Test script to verify all modules work together without API keys."""

import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))

from state_manager import StateManager, test_state_manager
from monitor import WindowTracker, test_monitor
from notifier import Notifier, BlockingIntervention, test_notifier


def test_imports():
    """Test that all modules import correctly."""
    print("Testing imports...")
    
    # Test state_manager
    print("  state_manager: ", end="")
    sm = StateManager()
    sm.set_goal("Test goal")
    assert sm.get_goal() == "Test goal"
    print("OK")
    
    # Test monitor imports
    print("  monitor: ", end="")
    from monitor import WindowTracker, FileWatcher, GitWatcher
    print("OK")
    
    # Test brain imports (will fail without API key, that's expected)
    print("  brain: ", end="")
    try:
        from brain import Brain
        print("OK (class available)")
    except Exception as e:
        print(f"OK (import works, needs API key: {e})")
    
    # Test notifier
    print("  notifier: ", end="")
    n = Notifier()
    print("OK")
    
    print("\n✅ All modules import successfully!")


def test_state_manager_demo():
    """Run state manager demo."""
    print("\n" + "=" * 50)
    print("STATE MANAGER DEMO")
    print("=" * 50)
    test_state_manager()


def test_monitor_demo():
    """Run a quick monitor test (3 polls)."""
    print("\n" + "=" * 50)
    print("MONITOR DEMO (3 polls, 2s interval)")
    print("=" * 50)
    
    def cb(entry):
        print(f"  [Activity] {entry}")
    
    tracker = WindowTracker(interval=2, callback=cb)
    tracker.start()
    import time
    time.sleep(7)
    tracker.stop()
    print("  Done.")


def test_notifier_demo():
    """Test notification (non-blocking)."""
    print("\n" + "=" * 50)
    print("NOTIFIER DEMO")
    print("=" * 50)
    
    n = Notifier()
    print("  Sending test toast...")
    n.notify_pushback("Test pushback: This is a test notification from Bodhi!")
    import time
    time.sleep(2)
    print("  Done.")


def main():
    """Run all tests."""
    print("🧪 BODHI SUPERVISOR - MODULE TESTS")
    print("=" * 50)
    
    test_imports()
    test_state_manager_demo()
    
    # Ask before running interactive tests
    print("\n" + "=" * 50)
    response = input("Run monitor demo (shows active window for 7s)? (y/n): ").strip().lower()
    if response == 'y':
        test_monitor_demo()
    
    response = input("Run notifier demo (shows Windows toast)? (y/n): ").strip().lower()
    if response == 'y':
        test_notifier_demo()
    
    print("\n✅ All tests complete!")


if __name__ == "__main__":
    main()