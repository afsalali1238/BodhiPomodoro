# Bodhi Supervisor - Quick Start Script (PowerShell)
# Run this to start Bodhi with your project

Set-Location $PSScriptRoot

# Activate venv and run
& "$PSScriptRoot\venv\Scripts\Activate.ps1"

# Default: watch current directory, eval every 5 min, poll every 10 sec
python bodhi.py --project . --eval-interval 300 --poll-interval 10

Read-Host "Press Enter to exit"