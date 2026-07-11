<#
  setup-tunel-cliente-windows.ps1
  Script base para configurar un tunel SSH reverso hacia me.services.ibla.co
  Este script se llama desde los wrappers especificos de cada cliente.

  Autor: Synerg-IA / ibla.co compatible
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]  [string]$Usuario,
  [Parameter(Mandatory = $true)]  [int]$Puerto,
  [Parameter(Mandatory = $false)] [string]$DbHost    = 'localhost',
  [Parameter(Mandatory = $true)]  [string]$Servidor,
  [Parameter(Mandatory = $true)]  [int]$SshPort,
  [Parameter(Mandatory = $true)]  [string]$Nombre
)

$ErrorActionPreference = 'Stop'
$BaseDir  = "C:\$Nombre"
$KeyFile  = "$BaseDir\id_tunnel"
$LogFile  = "$BaseDir\tunnel.log"
$TaskName = "FB-Tunnel-$Nombre"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host " Configurador de Tunel SSH para Firebird (ibla.co)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Usuario SSH : $Usuario"
Write-Host "  Servidor    : ${Servidor}:${SshPort}"
Write-Host "  Puerto tunel: $Puerto (remoto) -> ${DbHost}:3050 (local)"
Write-Host "  Directorio  : $BaseDir"
Write-Host ""

# ── 1. CREAR DIRECTORIO BASE ──────────────────────────────────────────────────
if (-not (Test-Path $BaseDir)) {
    New-Item -ItemType Directory -Path $BaseDir | Out-Null
    Write-Host "[1/5] Directorio creado: $BaseDir" -ForegroundColor Green
} else {
    Write-Host "[1/5] Directorio ya existe: $BaseDir" -ForegroundColor Gray
}

# ── 2. VERIFICAR / GENERAR CLAVE SSH ─────────────────────────────────────────
if (-not (Test-Path $KeyFile)) {
    Write-Host "[2/5] Generando par de claves SSH..." -ForegroundColor Yellow
    # Verificar que ssh-keygen este disponible (viene con Windows 10/2019+)
    if (-not (Get-Command ssh-keygen -ErrorAction SilentlyContinue)) {
        throw "ssh-keygen no encontrado. Instala OpenSSH: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0"
    }
    ssh-keygen -t ed25519 -f $KeyFile -N '""' -C "$Nombre@$(hostname)"
    Write-Host "[2/5] Claves generadas en $KeyFile" -ForegroundColor Green
} else {
    Write-Host "[2/5] Clave SSH existente: $KeyFile" -ForegroundColor Gray
}

# Mostrar la clave publica para que sea registrada en el servidor
Write-Host ""
Write-Host "CLAVE PUBLICA (registrar en me.services.ibla.co):" -ForegroundColor Magenta
Write-Host "─────────────────────────────────────────────────" -ForegroundColor Magenta
Get-Content "$KeyFile.pub"
Write-Host "─────────────────────────────────────────────────" -ForegroundColor Magenta
Write-Host ""

# ── 3. CREAR ARCHIVO known_hosts PARA EVITAR PROMPT INTERACTIVO ──────────────
Write-Host "[3/5] Configurando known_hosts..." -ForegroundColor Yellow
$SshDir = "$env:USERPROFILE\.ssh"
if (-not (Test-Path $SshDir)) { New-Item -ItemType Directory -Path $SshDir | Out-Null }
$KnownHostsFile = "$SshDir\known_hosts"
# Escanear y agregar la huella del servidor
$SshKeyScan = ssh-keyscan -p $SshPort $Servidor 2>$null
if ($SshKeyScan) {
    $SshKeyScan | Add-Content -Path $KnownHostsFile
    Write-Host "[3/5] Huella del servidor registrada." -ForegroundColor Green
} else {
    Write-Host "[3/5] Advertencia: No se pudo escanear la huella. Agrega -o StrictHostKeyChecking=no manualmente." -ForegroundColor Yellow
}

# ── 4. CREAR EL SCRIPT QUE MANTIENE EL TUNEL ACTIVO ─────────────────────────
Write-Host "[4/5] Creando script de mantenimiento del tunel..." -ForegroundColor Yellow
$TunnelScript = "$BaseDir\run-tunnel.ps1"
$SshArgs = "-N -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -R 127.0.0.1:${Puerto}:${DbHost}:3050 -i `"$KeyFile`" -p $SshPort ${Usuario}@${Servidor}"

$ScriptContent = @"
# Auto-generado por setup-tunel-cliente-windows.ps1
# Mantiene el tunel SSH activo con reconexion automatica

`$LogFile = '$LogFile'
`$MaxLog  = 500KB

while (`$true) {
    if ((Test-Path `$LogFile) -and (Get-Item `$LogFile).Length -gt `$MaxLog) {
        `$lines = Get-Content `$LogFile | Select-Object -Last 200
        `$lines | Set-Content `$LogFile
    }

    "`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [TUNEL] Iniciando conexion SSH..." | 
        Add-Content `$LogFile

    try {
        & ssh $SshArgs 2>&1 | ForEach-Object { 
            "`$(Get-Date -Format 'HH:mm:ss') `$_" | Add-Content `$LogFile 
        }
    } catch {
        "`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [ERROR] `$_" | Add-Content `$LogFile
    }

    "`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [TUNEL] Reconectando en 15s..." | 
        Add-Content `$LogFile
    Start-Sleep -Seconds 15
}
"@

$ScriptContent | Set-Content -Path $TunnelScript -Encoding UTF8
Write-Host "[4/5] Script creado: $TunnelScript" -ForegroundColor Green

# ── 5. CREAR TAREA PROGRAMADA ─────────────────────────────────────────────────
Write-Host "[5/5] Registrando tarea programada '$TaskName'..." -ForegroundColor Yellow

# Eliminar tarea anterior si existe
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

$Action    = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$TunnelScript`""

$Trigger   = New-ScheduledTaskTrigger -AtStartup
$Settings  = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable

$Principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName  $TaskName `
    -Action    $Action `
    -Trigger   $Trigger `
    -Settings  $Settings `
    -Principal $Principal `
    -Force | Out-Null

Write-Host "[5/5] Tarea programada registrada." -ForegroundColor Green

# ── INICIAR EL TUNEL AHORA ──────────────────────────────────────────────────
Write-Host ""
Write-Host "Iniciando tunel ahora..." -ForegroundColor Cyan
Start-ScheduledTask -TaskName $TaskName

Start-Sleep -Seconds 3
$State = (Get-ScheduledTask -TaskName $TaskName).State
Write-Host "Estado de la tarea: $State" -ForegroundColor $(if ($State -eq 'Running') { 'Green' } else { 'Yellow' })

Write-Host ""
Write-Host "==================================================" -ForegroundColor Green
Write-Host " CONFIGURACION COMPLETADA" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green
Write-Host " Logs del tunel: $LogFile"
Write-Host " Ver logs      : Get-Content '$LogFile' -Tail 20 -Wait"
Write-Host ""
Write-Host " IMPORTANTE: Envia esta clave publica al administrador" -ForegroundColor Yellow
Write-Host " de me.services.ibla.co para autorizar la conexion:" -ForegroundColor Yellow
Get-Content "$KeyFile.pub"
