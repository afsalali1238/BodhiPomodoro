$wsh = New-Object -ComObject WScript.Shell

# Desktop shortcut
$desktop = [Environment]::GetFolderPath('Desktop')
$s = $wsh.CreateShortcut("$desktop\Bodhi Pomodoro.lnk")
$s.TargetPath = "$env:LOCALAPPDATA\Bodhi Pomodoro\Bodhi Pomodoro.exe"
$s.Description = "Focus timer with Buddha pet"
$s.WorkingDirectory = "$env:LOCALAPPDATA\Bodhi Pomodoro"
$s.Save()

# Start Menu shortcut
$startMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Bodhi Pomodoro"
if (-not (Test-Path $startMenu)) { New-Item -ItemType Directory -Path $startMenu | Out-Null }
$s2 = $wsh.CreateShortcut("$startMenu\Bodhi Pomodoro.lnk")
$s2.TargetPath = "$env:LOCALAPPDATA\Bodhi Pomodoro\Bodhi Pomodoro.exe"
$s2.Description = "Focus timer with Buddha pet"
$s2.WorkingDirectory = "$env:LOCALAPPDATA\Bodhi Pomodoro"
$s2.Save()

# Startup shortcut (auto-start)
$startup = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$s3 = $wsh.CreateShortcut("$startup\Bodhi Pomodoro.lnk")
$s3.TargetPath = "$env:LOCALAPPDATA\Bodhi Pomodoro\Bodhi Pomodoro.exe"
$s3.Description = "Bodhi Pomodoro Auto-Start"
$s3.WorkingDirectory = "$env:LOCALAPPDATA\Bodhi Pomodoro"
$s3.Save()

Write-Host "All shortcuts created successfully"