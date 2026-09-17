@echo off
setlocal enabledelayedexpansion

set APPNAME=Bodhi Pomodoro
set VERSION=0.3.0
set SOURCE=C:\Users\HP\Desktop\antigravity\Buddha pet\prototype\dist\win-unpacked
set DEST=%LOCALAPPDATA%\%APPNAME%
set DESKTOP=%USERPROFILE%\Desktop
set STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\%APPNAME%

echo Installing %APPNAME%...

if not exist "%DEST%" mkdir "%DEST%"
xcopy /E /Y "%SOURCE%\*" "%DEST%\"

powershell -Command "Set-Location -LiteralPath '%DESKTOP%'; $s = New-Object -ComObject WScript.Shell; $link = $s.CreateShortcut('%DESKTOP%\%APPNAME%.lnk'); $link.TargetPath = '%DEST%\electron.exe'; $link.Arguments = '.'; $link.Description = '%APPNAME% Focus Timer'; $link.WorkingDirectory = '%DEST%'; $link.Save()"

if not exist "%STARTMENU%" mkdir "%STARTMENU%"
powershell -Command "Set-Location -LiteralPath '%STARTMENU%'; $s = New-Object -ComObject WScript.Shell; $link = $s.CreateShortcut('%STARTMENU%\%APPNAME%.lnk'); $link.TargetPath = '%DEST%\electron.exe'; $link.Arguments = '.'; $link.Description = '%APPNAME% Focus Timer'; $link.WorkingDirectory = '%DEST%'; $link.Save()"

echo Done! Open from Desktop or Start Menu.
exit /b 0
