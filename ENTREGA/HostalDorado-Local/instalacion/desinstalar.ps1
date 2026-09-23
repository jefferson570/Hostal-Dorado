# ================================================================
#  HOSTAL DORADO - Quitar el servicio de la PC de recepción
# ----------------------------------------------------------------
#  Detiene el sistema y evita que arranque solo. NO borra los datos:
#  la carpeta "data" (base de datos y respaldos) queda intacta.
# ================================================================
$Tarea = 'HostalDorado'
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) { Write-Host 'Ejecuta DESINSTALAR.bat como administrador.' -ForegroundColor Red; Read-Host 'Enter para cerrar'; exit 1 }

Stop-ScheduledTask -TaskName $Tarea -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $Tarea -Confirm:$false -ErrorAction SilentlyContinue
# Por si quedó un proceso de node del sistema escuchando en el puerto 3000.
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Get-NetFirewallRule -DisplayName 'Hostal Dorado' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Remove-Item (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'Hostal Dorado.url') -ErrorAction SilentlyContinue

Write-Host ''
Write-Host '  Servicio de Hostal Dorado detenido y quitado.' -ForegroundColor Green
Write-Host '  Tus datos siguen en la carpeta "data" del sistema.'
Write-Host ''
Read-Host 'Presiona Enter para cerrar'
