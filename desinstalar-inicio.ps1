# Quita el acceso directo de Inicio y para el servicio.
$acceso = Join-Path ([Environment]::GetFolderPath("Startup")) "Puente Browser Eye.lnk"
if (Test-Path $acceso) { Remove-Item $acceso }
& (Join-Path $PSScriptRoot "detener.ps1")
Write-Host "Ya no arranca con Windows."
