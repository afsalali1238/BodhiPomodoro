$filePath = "C:\Users\HP\Desktop\antigravity\Buddha pet\prototype\dist\Bodhi Pomodoro 0.3.0.exe"
Get-Process | ForEach-Object {
    try {
        $mods = $_.Modules
        foreach ($m in $mods) {
            if ($m.FileName -like "*Bodhi*") {
                Write-Host "PID: $($_.Id) Name: $($_.ProcessName) Module: $($m.FileName)"
            }
        }
    } catch {}
}