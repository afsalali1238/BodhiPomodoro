@echo off
REM Bodhi Supervisor - Quick Start Script
REM Run this to start Bodhi with your project

cd /d "%~dp0"

REM Activate venv and run
call venv\Scripts\activate

REM Default: watch current directory, eval every 5 min, poll every 10 sec
python bodhi.py --project . --eval-interval 300 --poll-interval 10

pause