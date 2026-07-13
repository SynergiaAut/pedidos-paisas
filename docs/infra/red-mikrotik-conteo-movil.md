# Red: acceso desde WiFi (móviles) hacia Fast Order en la LAN (Mikrotik)

**Contexto:** servidor Windows Server 2022 en el Granero Los Paisas, con Fast Order dockerizado (puerto 3000). Los PCs de mostrador entran por la LAN. La WiFi para celulares está en una VLAN separada en el Mikrotik (RouterBoard), sin ruteo/firewall abierto hacia la LAN — aislamiento intencional para proteger POS, ERP e impresoras de cualquier celular conectado al WiFi.

**Problema que resuelve:** la feature de conteo móvil por link (`.spec/conteo-movil/`) necesita que los celulares de los bodegueros, conectados al WiFi de la tienda, abran un link `http://<servidor>:3000/conteo/<token>`. Con la segmentación actual, ese tráfico se bloquea antes de llegar al servidor.

**Decisión (2026-07-12):** no fusionar las redes ni desactivar la segmentación. Se agrega **una regla de firewall angosta**: permitir tráfico de la subred WiFi hacia la IP del servidor, **solo puerto 3000/tcp**. Todo lo demás de la LAN sigue inalcanzable desde el WiFi.

## Prerrequisito: IP fija para el servidor

Si el servidor no tiene IP reservada en la LAN, resérvala primero (DHCP lease estático en el Mikrotik) para que la regla y el link no se rompan si cambia la IP.

```
/ip dhcp-server lease print where server=<nombre-del-server-dhcp-lan>
/ip dhcp-server lease add address=<IP-FIJA-DESEADA> mac-address=<MAC-DEL-SERVIDOR> server=<nombre-del-server-dhcp-lan>
```

## Paso 1 — Ubicar la regla actual que bloquea WiFi → LAN

La nueva regla debe ir **antes** de la que bloquea, porque RouterOS evalúa las reglas de arriba hacia abajo y se detiene en el primer match.

```
/ip firewall filter print where chain=forward
```

Anota el número (`.number`) de la regla que hoy bloquea/deniega tráfico entre la VLAN WiFi y la LAN.

## Paso 2 — Agregar la regla de excepción

Reemplaza `<WIFI_SUBNET>` (ej. `10.20.20.0/24`) y `<SERVER_LAN_IP>` (ej. `192.168.1.50`) por los valores reales del Granero:

```
/ip firewall filter add chain=forward \
    src-address=<WIFI_SUBNET> \
    dst-address=<SERVER_LAN_IP>/32 \
    dst-port=3000 protocol=tcp \
    action=accept \
    comment="Fast Order - conteo movil (WiFi -> servidor, solo puerto 3000)" \
    place-before=<NUMERO_DE_LA_REGLA_QUE_BLOQUEA>
```

## Paso 3 — (Opcional pero recomendado) nombre local en vez de IP cruda

Para que el link sea legible (`http://fastorder.local:3000/...` en vez de una IP), si el Mikrotik hace de DNS local:

```
/ip dns static add name=fastorder.local address=<SERVER_LAN_IP>
```

Y usar `APP_BASE_URL=http://fastorder.local:3000` en el `.env.local` del servidor (ver `.spec/conteo-movil/tasks.md`, TASK-M15).

## Paso 4 — Probar

Desde un celular conectado a la WiFi de la tienda (no a la LAN):

1. Abrir `http://<SERVER_LAN_IP-o-fastorder.local>:3000` en el navegador → debe cargar el login de Fast Order (confirma alcance de red).
2. Abrir un link real de conteo (`/conteo/<token>`) generado desde `/inventario` → debe cargar la vista pública de conteo.
3. Confirmar que **otras** direcciones de la LAN (ej. la IP del ERP Milenium o de una impresora de red) siguen sin responder desde el mismo celular — la segmentación general debe seguir intacta.

## Nota de seguridad

Esta regla abre alcance de red al puerto 3000 completo de Fast Order, no solo a la ruta `/conteo`— cualquier celular en el WiFi podrá ver la pantalla de login del dashboard interno, aunque no podrá autenticarse sin credenciales ni ver datos (RLS + middleware ya lo protegen, ver `.spec/constitution.md` Artículo 3). Se acepta este alcance como riesgo bajo porque la barrera real de seguridad es la autenticación + RLS, no la invisibilidad de red. Si más adelante se quiere restringir el alcance solo a `/conteo`, se necesitaría un reverse proxy (ej. nginx) delante de Next.js que filtre por ruta — no se justifica hoy por complejidad adicional.

## Alternativa descartada (queda como plan B)

Si en algún momento no es viable tocar el firewall del Mikrotik, existe la opción de reutilizar el túnel SSH inverso que ya expone Milenium hacia `me.services.ibla.co` (ver `docs/infra/tunel-ssh.md`) para publicar la ruta `/conteo` a internet, y que los celulares entren por datos móviles en vez de depender de la WiFi de la tienda. Más piezas en movimiento (túnel/subdominio adicional, exposición permanente a internet) — no se eligió como opción principal porque la regla de firewall es más simple y no depende de infraestructura externa.
