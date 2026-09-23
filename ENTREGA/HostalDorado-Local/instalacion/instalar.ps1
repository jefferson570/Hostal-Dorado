# ================================================================
#  HOSTAL DORADO - Instalación en la PC de recepción
# ----------------------------------------------------------------
#  Deja el sistema funcionando como un "servicio" de Windows:
#   - Arranca solo al encender la PC (sin iniciar sesión).
#   - Si el programa se cae, se vuelve a levantar solo.
#   - Funciona sin ventana negra abierta.
#   - Los datos quedan en la carpeta "data" y se respaldan a diario.
#  Se ejecuta con INSTALAR.bat (doble clic). Requiere permisos de administrador.
# ================================================================
$ErrorActionPreference = 'Stop'
$Tarea  = 'HostalDorado'
$Puerto = 3000
$Raiz   = Split-Path -Parent $PSScriptRoot

function Titulo($t) { Write-Host "`n== $t" -ForegroundColor Yellow }
function Ok($t)     { Write-Host "   OK  $t" -ForegroundColor Green }
function Falla($t)  { Write-Host "`n   ERROR: $t`n" -ForegroundColor Red; Read-Host 'Presiona Enter para cerrar'; exit 1 }

Write-Host ''
Write-Host '  ===============================================' -ForegroundColor DarkYellow
Write-Host '        HOSTAL DORADO  -  Instalación local' -ForegroundColor Yellow
Write-Host '  ===============================================' -ForegroundColor DarkYellow

# --- 0. Permisos de administrador ---------------------------------
$esAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $esAdmin) { Falla 'Ejecuta INSTALAR.bat con clic derecho > "Ejecutar como administrador".' }

# --- 1. Node.js ---------------------------------------------------
Titulo 'Verificando Node.js'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { Falla 'Node.js no está instalado. Descárgalo de https://nodejs.org (versión LTS), instálalo y vuelve a ejecutar INSTALAR.bat.' }
$nodeExe = $node.Source
Ok "Node.js $(& $nodeExe -v) en $nodeExe"

# --- 2. Dependencias ----------------------------------------------
Titulo 'Instalando dependencias (solo la primera vez, puede tardar)'
Set-Location $Raiz
if (-not (Test-Path (Join-Path $Raiz 'node_modules\better-sqlite3'))) {
  & npm install --omit=dev
  if ($LASTEXITCODE -ne 0) { Falla 'npm install falló. Revisa tu conexión a internet e inténtalo de nuevo.' }
}
Ok 'Dependencias listas'

# --- 3. Configuración (.env) --------------------------------------
Titulo 'Configuración'
$envFile = Join-Path $Raiz '.env'
if (-not (Test-Path $envFile)) {
  $bytes = New-Object byte[] 48
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $secreto = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  @"
# Generado por el instalador de Hostal Dorado. No compartas este archivo.
NODE_ENV=production
PORT=$Puerto
JWT_SECRET=$secreto
JWT_EXPIRES_IN=12h
DB_PATH=./data/hostal.db
TZ=America/Lima
# Instalación local sin proxy: no confiar en cabeceras X-Forwarded-For.
TRUST_PROXY=0
# Respaldos diarios automáticos (puedes apuntarlo a una carpeta de Google Drive/OneDrive o a un USB).
BACKUP_DIR=./data/respaldos
BACKUP_KEEP=30
GOOGLE_SHEETS_ENABLED=false
"@ | Set-Content -Path $envFile -Encoding ASCII
  Ok 'Archivo .env creado con una clave de seguridad nueva'
} else {
  Ok '.env ya existía: se conserva'
}
New-Item -ItemType Directory -Force (Join-Path $Raiz 'data') | Out-Null

# --- 4. Tarea programada (servicio) -------------------------------
Titulo 'Registrando el servicio para que arranque solo'
$existente = Get-ScheduledTask -TaskName $Tarea -ErrorAction SilentlyContinue
if ($existente) { Stop-ScheduledTask -TaskName $Tarea -ErrorAction SilentlyContinue; Unregister-ScheduledTask -TaskName $Tarea -Confirm:$false }

$log = Join-Path $Raiz 'data\servidor.log'
$accion    = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"`"$nodeExe`" server.js >> `"$log`" 2>&1`"" -WorkingDirectory $Raiz
$inicio    = New-ScheduledTaskTrigger -AtStartup
$usuario   = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$ajustes   = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
               -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $Tarea -Action $accion -Trigger $inicio -Principal $usuario -Settings $ajustes `
  -Description 'Sistema de gestión Hostal Dorado (servidor local en el puerto 3000).' | Out-Null
Ok "Servicio '$Tarea' registrado (arranca al encender la PC y se reinicia si se cae)"

# --- 5. Firewall: permitir celulares/tablets de la misma red Wi-Fi ---
Titulo 'Permitiendo el acceso desde otros equipos de la red local'
Get-NetFirewallRule -DisplayName 'Hostal Dorado' -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName 'Hostal Dorado' -Direction Inbound -Protocol TCP -LocalPort $Puerto -Action Allow -Profile Private,Domain | Out-Null
Ok "Puerto $Puerto abierto solo en redes privadas (no en Wi-Fi públicas)"

# --- 6. Arrancar y comprobar --------------------------------------
Titulo 'Iniciando el sistema'
Start-ScheduledTask -TaskName $Tarea
$listo = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 750
  try { if ((Invoke-WebRequest "http://localhost:$Puerto/api/health" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200) { $listo = $true; break } } catch {}
}
if (-not $listo) { Falla "El sistema no respondió. Revisa el archivo $log" }
Ok 'El sistema está funcionando'

# --- 7. Acceso directo en el escritorio ---------------------------
$escritorio = [Environment]::GetFolderPath('CommonDesktopDirectory')
@"
[InternetShortcut]
URL=http://localhost:$Puerto/
"@ | Set-Content -Path (Join-Path $escritorio 'Hostal Dorado.url') -Encoding ASCII
Ok 'Acceso directo "Hostal Dorado" creado en el escritorio'

# --- Resumen ------------------------------------------------------
$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -ExpandProperty IPAddress
Write-Host ''
Write-Host '  ===============================================' -ForegroundColor DarkYellow
Write-Host '   LISTO. Hostal Dorado quedó instalado.' -ForegroundColor Green
Write-Host '  ===============================================' -ForegroundColor DarkYellow
Write-Host "   En esta PC:          http://localhost:$Puerto"
foreach ($ip in $ips) { Write-Host "   Desde celular/tablet: http://${ip}:$Puerto   (misma red Wi-Fi)" }
Write-Host "   Respaldos diarios en: $Raiz\data\respaldos"
Write-Host ''
Write-Host '   Usuario inicial: admin / admin123  (cámbiala en Configuración)' -ForegroundColor Yellow
Write-Host ''
Start-Process "http://localhost:$Puerto/"
Read-Host 'Presiona Enter para cerrar'
