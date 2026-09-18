#!/usr/bin/env python3
"""Brain module - LLM integration for evaluating user focus and generating pushback."""

import os
import json
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

STATE_FILE = Path(__file__).parent / "state.json"


class Brain:
    """Handles LLM communication for focus evaluation and pushback generation."""
    
    def __init__(self, provider: str = "openai", project_path: str = "."):
        self.provider = provider
        self.project_path = project_path
        self.client = None
        self._init_client()
    
    def _init_client(self) -> None:
        """Initialize the LLM client based on available API keys."""
        if self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                from openai import OpenAI
                self.client = OpenAI(api_key=api_key)
                self.model = "gpt-4o-mini"
        elif self.provider == "gemini":
            api_key = os.getenv("GEMINI_API_KEY")
            if api_key:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                self.client = genai.GenerativeModel("gemini-1.5-flash")
        
        if not self.client:
            raise ValueError(
                f"No API key found for {self.provider}. "
                "Set OPENAI_API_KEY or GEMINI_API_KEY in .env"
            )
    
    def build_prompt(self, goal: str, activity_log: list) -> str:
        """Build the evaluation prompt for the LLM."""
        recent = activity_log[-15:] if activity_log else []
        activity_str = "\n".join(f"- {a}" for a in recent) if recent else "No activity recorded yet."
        
        return f"""You are 'Bodhi', a strict but helpful AI Tech Lead.
The user's declared goal for this session is: "{goal}"
Here is their activity log for the last 15 minutes:
{activity_str}

Your task:
1. Determine if their activity aligns with their goal.
2. If they are ON TRACK, output exactly: "OK"
3. If they are OFF TRACK (distracted, procrastinating, or over-engineering), provide a short, sharp pushback message (max 2 sentences). Call out specifically what they are doing wrong and remind them of the goal."""
    
    def evaluate(self, goal: str, activity_log: list) -> str:
        """Evaluate user activity against goal using LLM."""
        prompt = self.build_prompt(goal, activity_log)
        
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are Bodhi, an assertive AI Tech Lead. Respond only with 'OK' or a pushback message."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=100
            )
            return response.choices[0].message.content.strip()
        
        elif self.provider == "gemini":
            response = self.client.generate_content(prompt)
            return response.text.strip()
        
        return "OK"
    
    def suggest_next_task(self, goal: str, git_diff: str, recent_files: list) -> str:
        """Suggest the next high-priority task based on codebase state."""
        # Build context package from git
        import subprocess
        try:
            recent_commits = subprocess.run(
                ["git", "log", "-n", "3", "--oneline"],
                cwd=self.project_path if hasattr(self, 'project_path') else ".",
                capture_output=True, text=True, timeout=5
            ).stdout.strip() or "No recent commits"
        except Exception:
            recent_commits = "Error reading git log"
        
        try:
            git_status = subprocess.run(
                ["git", "status", "--short"],
                cwd=self.project_path if hasattr(self, 'project_path') else ".",
                capture_output=True, text=True, timeout=5
            ).stdout.strip() or "Clean"
        except Exception:
            git_status = "Error reading git status"
        
        prompt = f"""Based on this git state and the user's current goal, what is the single most logical next coding task? Provide it as a 1-sentence instruction.

Goal: "{goal}"

Recent Commits:
{recent_commits}

Current Uncommitted State:
{git_status}

File Changes (stat):
{git_diff[:2000] if git_diff else "No uncommitted changes"}

Recent file activity:
{chr(10).join(f"- {f}" for f in recent_files[-10:])}"""
        
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are Bodhi, an AI Tech Lead. Output one specific next task as a single sentence."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        
        elif self.provider == "gemini":
            response = self.client.generate_content(prompt)
            return response.text.strip()
        
        return "Continue with current task."


def test_brain() -> None:
    """Test the brain with a mock activity log."""
    # This requires an API key in .env
    try:
        brain = Brain(provider="openai")  # or "gemini"
        test_goal = "Build the user authentication API"
        test_activity = [
            "10:00 - VS Code (auth.py)",
            "10:05 - VS Code (auth.py)",
            "10:10 - Chrome (Stack Overflow - JWT tokens)",
            "10:15 - VS Code (auth.py)",
        ]
        result = brain.evaluate(test_goal, test_activity)
        print(f"Evaluation: {result}")
    except ValueError as e:
        print(f"Skipping test (no API key): {e}")


if __name__ == "__main__":
    test_brain()