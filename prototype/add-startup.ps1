$wsh = New-Object -ComObject WScript.Shell
$s = $wsh.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Bodhi Pomodoro.lnk")
$s.TargetPath = "C:\Users\HP\AppData\Local\Bodhi Pomodoro\electron.exe"
$s.Arguments = "."
$s.Description = "Bodhi Pomodoro Auto-Start"
$s.WorkingDirectory = "C:\Users\HP\AppData\Local\Bodhi Pomodoro"
$s.Save()
