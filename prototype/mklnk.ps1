$wsh = New-Object -COM WScript.Shell
$s = $wsh.CreateShortcut("$env:USERPROFILE\Desktop\Bodhi Pomodoro.lnk")
$s.TargetPath = "C:\Users\HP\Desktop\antigravity\Buddha pet\prototype\dist\Bodhi Pomodoro 0.3.0.exe"
$s.Description = "Focus timer with Buddha pet"
$s.Save()
