$file = "C:\Users\HP\Desktop\antigravity\Buddha pet\prototype\dist\Bodhi Pomodoro 0.3.0.exe"
if (Test-Path $file) {
    try {
        Remove-Item -Force $file -ErrorAction Stop
        Write-Host "Removed $file"
    } catch {
        Write-Host "Could not remove: $($_.Exception.Message)"
    }
}