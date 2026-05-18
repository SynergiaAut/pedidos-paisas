Set WshShell = CreateObject("WScript.Shell")
' Correr el archivo batch en modo oculto (0)
WshShell.Run chr(34) & "C:\milenium-agent\arrancar.bat" & Chr(34), 0
Set WshShell = Nothing
