# Manual Corto - Tunel SSH Firebird (Granero Los Paisas de Palmira)

## Datos del cliente

- Cliente: Granero Los Paisas de Palmira
- Servidor Windows: 190.108.77.142
- Sistema operativo: Windows Server 2022
- Servidor destino tunel: me.services.ibla.co
- Puerto SSH destino: 32045

Rutas de base de datos reportadas por el cliente:
- C:\Millenium Enterprise\BD\GRANESLOSPAISAS2021.FDB

## Parametros propuestos para este cliente

- Usuario de tunel: fb-granero-paisas
- Puerto remoto de tunel: 13053

Nota:
- Si el puerto 13053 ya esta ocupado en me.services.ibla.co, usar otro libre (13054, 13055, etc.)
  y mantener el mismo valor en servidor y cliente.

## 1) Configurar servidor remoto (me.services.ibla.co)

```bash
ssh -p 32045 administrador@me.services.ibla.co
cd /home/administrador/services/ponypro/fb-tunnel
sudo ./setup-server-tunnel.sh --usuario fb-granero-paisas --puerto 13053
```

## 2) Configurar cliente Windows 2022 (190.108.77.142)

Copiar en la maquina Windows los archivos:
- setup-tunel-cliente-windows.ps1
- setup-tunel-granero-lospaisas-windows2022.ps1

Abrir PowerShell como Administrador y ejecutar:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup-tunel-granero-lospaisas-windows2022.ps1
```

Si Firebird esta en otra maquina de la LAN (no local), ejecutar:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
.\setup-tunel-granero-lospaisas-windows2022.ps1 -DbHost 192.168.1.50
```

## 3) Registrar clave publica del cliente en me.services.ibla.co

En Windows, copiar la salida de:

```powershell
Get-Content "C:\fb-granero-paisas\id_tunnel.pub"
```

En me.services.ibla.co, pegar la clave:

```bash
KEY='<CLAVE_PUBLICA_COMPLETA>'
echo "restrict,permitlisten=\"127.0.0.1:13053\" $KEY" \
  >> /home/fb-granero-paisas/.ssh/authorized_keys
```

## 4) Validaciones tecnicas

En me.services.ibla.co:

```bash
ss -tlnp | grep 13053
nc -zv 127.0.0.1 13053
```

En Windows:

```powershell
Get-ScheduledTask -TaskName "FB-Tunnel-fb-granero-paisas"
Get-ScheduledTaskInfo -TaskName "FB-Tunnel-fb-granero-paisas"
Get-Content "C:\fb-granero-paisas\tunnel.log" -Tail 100
Test-NetConnection -ComputerName me.services.ibla.co -Port 32045
```

## Entregables para cierre

Enviar:
1. Clave publica SSH completa
2. Estado de la tarea programada en Windows
3. Ultimas lineas de tunnel.log
4. Confirmacion de DbHost usado (localhost o IP privada)
