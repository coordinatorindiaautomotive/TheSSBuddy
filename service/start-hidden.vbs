' service/start-hidden.vbs
' Launches TheSSBuddy service-runner completely hidden in background with 0 window

Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get current script directory and project root
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
rootDir = fso.GetParentFolderName(scriptDir)

' Ensure logs directory exists
logDir = rootDir & "\logs"
If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If

' Launch node service-runner.js hidden (window style 0 = hidden)
runnerPath = scriptDir & "\service-runner.js"
cmd = """C:\Program Files\nodejs\node.exe"" """ & runnerPath & """"

WshShell.CurrentDirectory = rootDir
WshShell.Run cmd, 0, False
