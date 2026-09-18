#!/usr/bin/env python3
"""Notifier module - Windows notifications and blocking intervention UI."""

import threading
import time
from typing import Optional, Callable
from win10toast import ToastNotifier


class Notifier:
    """Handles Windows toast notifications."""
    
    def __init__(self):
        self.toaster = ToastNotifier()
        self._last_notification_time = 0
        self._min_interval = 30  # Minimum seconds between notifications
    
    def notify(self, title: str, message: str, duration: int = 10, 
               callback: Optional[Callable] = None) -> bool:
        """
        Show a Windows toast notification.
        
        Args:
            title: Notification title
            message: Notification body
            duration: How long to show (seconds)
            callback: Optional function called when notification is clicked
        
        Returns:
            True if notification was shown, False if rate-limited
        """
        now = time.time()
        if now - self._last_notification_time < self._min_interval:
            return False  # Rate limited
        
        self._last_notification_time = now
        
        # Run in thread to avoid blocking
        def show():
            self.toaster.show_toast(
                title=title,
                msg=message,
                duration=duration,
                threaded=True
            )
            # Note: win10toast doesn't support click callbacks easily
            # For click handling, we'd need a more complex approach
        
        threading.Thread(target=show, daemon=True).start()
        return True
    
    def notify_pushback(self, message: str) -> bool:
        """Show a pushback notification from Bodhi."""
        return self.notify(
            title="🧘 Bodhi - Focus Check",
            message=message,
            duration=15
        )


class BlockingIntervention:
    """A blocking Tkinter dialog that requires user justification."""
    
    def __init__(self):
        self.result: Optional[str] = None
        self._root = None
    
    def show(self, title: str, message: str, require_response: bool = True) -> Optional[str]:
        """
        Show a blocking dialog.
        
        Args:
            title: Dialog title
            message: Message to display
            require_response: If True, user must type something to close
        
        Returns:
            User's response text, or None if cancelled/closed
        """
        import tkinter as tk
        from tkinter import ttk
        
        self.result = None
        
        # Create root window (or use existing)
        self._root = tk.Tk()
        self._root.withdraw()  # Hide initially
        
        # Create dialog as Toplevel for better control
        dialog = tk.Toplevel(self._root)
        dialog.title(title)
        dialog.geometry("500x300")
        dialog.resizable(False, False)
        dialog.attributes('-topmost', True)  # Stay on top
        dialog.grab_set()  # Modal
        
        # Center on screen
        dialog.update_idletasks()
        x = (dialog.winfo_screenwidth() // 2) - 250
        y = (dialog.winfo_screenheight() // 2) - 150
        dialog.geometry(f"+{x}+{y}")
        
        # Style
        style = ttk.Style()
        style.configure("Big.TLabel", font=("Segoe UI", 11))
        style.configure("Title.TLabel", font=("Segoe UI", 14, "bold"))
        
        # Main frame
        main_frame = ttk.Frame(dialog, padding=20)
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Icon + title
        title_frame = ttk.Frame(main_frame)
        title_frame.pack(fill=tk.X, pady=(0, 15))
        
        ttk.Label(title_frame, text="🧘", font=("Segoe UI", 24)).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Label(title_frame, text="Bodhi - Focus Intervention", style="Title.TLabel").pack(side=tk.LEFT)
        
        # Message
        msg_frame = ttk.Frame(main_frame)
        msg_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 15))
        
        msg_label = ttk.Label(msg_frame, text=message, style="Big.TLabel", wraplength=440, justify=tk.LEFT)
        msg_label.pack(anchor=tk.W)
        
        # Response entry (if required)
        self._entry_var = tk.StringVar()
        self._entry = None
        
        if require_response:
            ttk.Label(main_frame, text="Explain your focus or justify this activity:", style="Big.TLabel").pack(anchor=tk.W, pady=(10, 5))
            self._entry = ttk.Entry(main_frame, textvariable=self._entry_var, font=("Segoe UI", 11), width=55)
            self._entry.pack(fill=tk.X, pady=(0, 15))
            self._entry.focus_set()
            
            # Bind Enter to submit
            self._entry.bind("<Return>", lambda e: self._submit(dialog))
        
        # Buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill=tk.X)
        
        if require_response:
            ttk.Button(btn_frame, text="Submit & Continue", command=lambda: self._submit(dialog)).pack(side=tk.RIGHT, padx=(10, 0))
            ttk.Button(btn_frame, text="I'm Back on Track", command=lambda: self._submit(dialog, "Returning to goal")).pack(side=tk.RIGHT)
        else:
            ttk.Button(btn_frame, text="OK", command=lambda: self._submit(dialog, "Acknowledged")).pack(side=tk.RIGHT)
        
        # Handle window close
        dialog.protocol("WM_DELETE_WINDOW", lambda: self._submit(dialog, ""))
        
        # Run the dialog
        self._root.mainloop()
        
        return self.result
    
    def _submit(self, dialog, response: str = None) -> None:
        """Handle dialog submission."""
        if response is None:
            response = self._entry_var.get().strip() if self._entry else ""
        
        self.result = response if response else None
        dialog.grab_release()
        dialog.destroy()
        self._root.quit()
        self._root.destroy()
        self._root = None


def test_notifier() -> None:
    """Test the notifier."""
    notifier = Notifier()
    print("Sending test notification...")
    notifier.notify_pushback("You've been on YouTube for 15 minutes. How does this serve your goal?")
    time.sleep(2)
    print("Notification sent.")


def test_blocking() -> None:
    """Test the blocking intervention dialog."""
    intervention = BlockingIntervention()
    print("Showing blocking dialog (will wait for input)...")
    response = intervention.show(
        "Bodhi - Focus Check",
        "You've spent 20 minutes on CSS tweaks but your goal is the database schema.\n\nWhat's the priority right now?",
        require_response=True
    )
    print(f"User response: {response}")


if __name__ == "__main__":
    # test_notifier()
    test_blocking()