' Launches start_bodhi.bat fully hidden.
' The bat file is resolved relative to THIS script's folder, so Bodhi works
' no matter where the repo is checked out (no hardcoded user paths).
Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run Chr(34) & scriptDir & "\start_bodhi.bat" & Chr(34), 0
Set WshShell = Nothing
Set fso = Nothing
