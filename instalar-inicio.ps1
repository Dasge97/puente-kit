# Crea un acceso directo en la carpeta de Inicio para que el Puente de Browser Eye
# arranque con Windows, y lo arranca ahora.
$vbs = Join-Path $PSScriptRoot "iniciar-oculto.vbs"
$wscript = Join-Path $env:WINDIR "System32\wscript.exe"
$inicio = [Environment]::GetFolderPath("Startup")
$acceso = Join-Path $inicio "Puente Browser Eye.lnk"

$shell = New-Object -ComObject WScript.Shell
$lnk = $shell.CreateShortcut($acceso)
$lnk.TargetPath = $wscript
$lnk.Arguments = "`"$vbs`""
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.Description = "Puente local de Browser Eye"
$lnk.Save()

Start-Process -FilePath $wscript -ArgumentList "`"$vbs`"" -WorkingDirectory $PSScriptRoot
Write-Host "Instalado en: $acceso"
Write-Host "Arrancado. Comprueba el estado con: node `"$PSScriptRoot\puente-kit.mjs`" status"
