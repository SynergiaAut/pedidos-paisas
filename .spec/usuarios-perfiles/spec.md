# Usuarios y perfiles operativos

## Contexto

Fast Order necesita distinguir usuarios por responsabilidad real en el granero, no solo por `admin` o `user`. La operacion ya separa pedidos, despacho, inventario, cuadre y analitica.

## Decisiones

- `admin` se conserva como rol maestro para configuracion y administracion.
- Se agregan roles operativos: `pedidos`, `despacho`, `inventario`, `cuadre`, `analitica`.
- `user`, `cashier` y `kitchen` se mantienen como roles heredados para no romper datos previos.
- La edicion de perfiles debe pasar por Server Actions con verificacion de admin y `service_role`; el navegador no debe escribir perfiles sensibles directamente.

## Alcance actual

- Redisenar `/admin/usuarios` para ver estado, rol, descripcion operativa y editar nombre/rol/estado.
- Crear usuarios desde administracion con correo, clave temporal, nombre, rol base y accesos iniciales.
- Guardar accesos granulares por modulo en `profiles.app_permissions` como JSON.
- Mostrar checklist editable por usuario para `pedidos`, `despacho`, `crm`, `inventario`, `cuadre`, `analitica` y `admin`.
- Evitar que un admin se quite su propio rol o se desactive accidentalmente.
- Documentar variable local `DISABLE_BACKGROUND_JOBS` para correr UI sin crons.

## Pendiente

- Aplicar restricciones de navegacion por rol en cada modulo.
- Definir si cada rol puede crear, editar, cerrar o solo consultar dentro de su modulo.
- Obligar cambio de clave temporal en el primer inicio de sesion, si Camilo lo requiere como politica.
