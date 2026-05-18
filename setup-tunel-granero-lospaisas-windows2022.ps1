<#
  setup-tunel-granero-lospaisas-windows2022.ps1
  Wrapper para ejecutar el script base de tunel con parametros del cliente.

  Cliente: Granero Los Paisas de Palmira
  Servidor cliente: Windows Server 2022 (IP publica: 190.108.77.142)
  Destino tunel: me.services.ibla.co:32045

  Uso (PowerShell como Administrador):
    Set-ExecutionPolicy Bypass -Scope Process -Force
    .\setup-tunel-granero-lospaisas-windows2022.ps1

  Si Firebird corre en otra maquina de la LAN, sobrescriba -DbHost con IP privada.
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false)]
  [string]$Usuario = 'fb-granero-paisas',

  [Parameter(Mandatory = $false)]
  [int]$Puerto = 13053,

  [Parameter(Mandatory = $false)]
  [string]$DbHost = 'localhost',

  [Parameter(Mandatory = $false)]
  [string]$Servidor = 'me.services.ibla.co',

  [Parameter(Mandatory = $false)]
  [int]$SshPort = 32045,

  [Parameter(Mandatory = $false)]
  [string]$Nombre = 'fb-granero-paisas'
)

$ErrorActionPreference = 'Stop'

$baseScript = Join-Path $PSScriptRoot 'setup-tunel-cliente-windows.ps1'
if (-not (Test-Path $baseScript)) {
  throw "No se encontro el script base: $baseScript"
}

Write-Host 'Iniciando configuracion de tunel para Granero Los Paisas...' -ForegroundColor Cyan
Write-Host "Cliente Windows: 190.108.77.142" -ForegroundColor Gray
Write-Host "Destino SSH   : ${Servidor}:${SshPort}" -ForegroundColor Gray
Write-Host "Tunnel user   : $Usuario" -ForegroundColor Gray
Write-Host "Tunnel port   : 127.0.0.1:$Puerto (remoto)" -ForegroundColor Gray
Write-Host "DbHost local  : $DbHost" -ForegroundColor Gray

& $baseScript `
  -Usuario $Usuario `
  -Puerto $Puerto `
  -DbHost $DbHost `
  -Servidor $Servidor `
  -SshPort $SshPort `
  -Nombre $Nombre
