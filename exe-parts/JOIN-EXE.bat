@echo off
cd /d "%~dp0"
copy /b BodhiPomodoro.exe.part00+BodhiPomodoro.exe.part01+BodhiPomodoro.exe.part02+BodhiPomodoro.exe.part03 "..\Bodhi Pomodoro 1.0.0.exe"
echo.
echo Done. "Bodhi Pomodoro 1.0.0.exe" is now in the Buddha pet folder.
echo Expected SHA-256: 13c6ace87445b7338e62ea38e0b22d585c75b6d5ee6564ef7038d09d179623d5
certutil -hashfile "..\Bodhi Pomodoro 1.0.0.exe" SHA256
pause
