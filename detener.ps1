# Para puente-kit.mjs y el Puente que arrancó él. Un Puente arrancado por otro proceso
# (por ejemplo, por un cliente MCP) no se toca.
$procesos = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
$servicio = $procesos | Where-Object { $_.CommandLine -like "*puente-kit.mjs*" -and $_.CommandLine -notlike "*puente-kit.mjs*pair*" -and $_.CommandLine -notlike "*puente-kit.mjs*status*" }
foreach ($padre in $servicio) {
  $procesos | Where-Object { $_.ParentProcessId -eq $padre.ProcessId -and $_.CommandLine -like "*bridge.mjs*start*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Stop-Process -Id $padre.ProcessId -Force
}
Write-Host "Detenido."
