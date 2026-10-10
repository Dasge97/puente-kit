' Arranca puente-kit.mjs con Node sin abrir ninguna ventana.
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = carpeta
shell.Run "node """ & carpeta & "\puente-kit.mjs""", 0, False
