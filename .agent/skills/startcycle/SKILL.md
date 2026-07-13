---
name: startcycle
description: Punto de entrada obligatorio para iniciar cualquier sesión de trabajo en el proyecto Fast Order / Pedidos Paisas. Úsalo SIEMPRE al arrancar una nueva sesión, antes de escribir, editar o generar cualquier código, migración o archivo. Implementa el flujo SDD (Spec-Driven Development) acordado con Claude/Cowork: Claude hace la estrategia y produce specs en `.spec/<feature>/`, Antigravity ejecuta la implementación siguiendo esos documentos al pie de la letra. Invoca este skill cuando el usuario diga "empecemos", "sigamos con el proyecto", "qué sigue", "continúa con Fast Order", o simplemente al abrir una conversación nueva sobre este repo.
---

# /startcycle — Arranque de sesión SDD (Fast Order)

Soy el procedimiento de arranque de sesión para **Pedidos Paisas / Fast Order**. Mi trabajo es orientarme antes de tocar una sola línea de código, siguiendo exactamente la metodología Spec-Driven Development (SDD) que este proyecto usa: **Claude/Cowork diseña la estrategia y escribe los documentos de spec; yo (Antigravity) ejecuto la implementación** a partir de esos documentos, sin inventar alcance ni saltarme pasos.

## Qué hago, en orden, cada vez que arranco

### 1. Leo el documento enrutador
Abro `CLAUDE.md` en la raíz del repo. Es el punto de partida obligatorio: explica qué es el proyecto, el stack, la regla de oro de integración con Milenium, y tiene un **mapa de documentación** que me dice a qué archivo ir según la tarea. También reviso su sección **"Estado actual"** — ahí está el resumen más reciente de qué está hecho, qué está bloqueado y qué sigue.

### 2. Leo la constitución
Abro `.spec/constitution.md`. Son las reglas no negociables del proyecto (stack inmutable, única vía de integración con Milenium vía API Flex CRM, seguridad, calidad, proceso SDD). **Nunca las violo**, incluso si un spec puntual no las repite explícitamente — la constitución tiene prioridad sobre cualquier otro documento.

### 3. Reviso el roadmap
Abro `docs/roadmap.md` para entender qué está priorizado y por qué, y si hay bloqueos activos (ej. credenciales pendientes de terceros) que cambien qué se puede ejecutar hoy.

### 4. Busco specs listos para ejecutar
Recorro `.spec/<feature>/` buscando carpetas con `spec.md` + `plan.md` + `tasks.md` completos. Un spec está **listo para ejecutar** cuando `tasks.md` tiene tareas con `- [ ]` (pendientes) y no depende de un bloqueo externo no resuelto (reviso la sección de dependencias del propio `tasks.md` y el roadmap).

Si hay más de un spec listo, **pregunto al usuario cuál trabajar en esta sesión** en vez de asumir. Si no hay ningún spec listo para lo que el usuario pide, **me detengo y lo digo**: no genero código sin spec — esa es una regla no negociable del Artículo 5 de la constitución. En ese caso, sugiero que se genere primero el spec con Claude/Cowork.

### 5. Ejecuto las tareas del spec elegido

- Sigo `tasks.md` **en el orden de sus bloques** (A, B, C…), sin saltar bloques salvo que el propio documento indique que son independientes.
- Antes de cada tarea, releo la sección correspondiente de `plan.md` para no improvisar el diseño técnico — el plan ya tomó esas decisiones.
- Al terminar una tarea y verificarla (la mayoría de tareas trae su propio criterio de "Verifica:"), marco su checkbox como `- [x]` en `tasks.md` inmediatamente. El progreso del spec siempre debe reflejarse en el archivo, no solo en el chat.
- Si encuentro un obstáculo que el plan no contempló (una tabla con columnas distintas, una policy ya existente, un endpoint que responde diferente a lo documentado), **no invento una solución silenciosa**: lo reporto, propongo el ajuste, y si cambia el diseño, lo dejo anotado en el propio `plan.md` o `spec.md` (sección de riesgos/clarifications) antes de continuar.

### 6. Respeto siempre la constitución mientras ejecuto

- Stack inmutable (Next.js App Router + TypeScript + TailwindCSS + Supabase). Nada de microservicios nuevos ni drivers paralelos a `src/lib/flex-crm.ts` para hablar con Milenium.
- Ninguna policy RLS `to public with check (true)` salvo staging insert-only ya justificado en el spec.
- Secretos solo por variables de entorno; nunca hardcodeados; `.env.example` actualizado si agrego una variable nueva.
- TypeScript estricto, sin `any` nuevos en código de integración.
- Todo parser de texto y todo mapeo API→tabla lleva tests con casos reales antes de darlo por terminado.
- Los errores de integración se registran con contexto (endpoint, `db_source`, payload truncado) — nunca un `catch` silencioso.

### 7. Al cerrar la fase (todas las tareas del bloque completadas)

- Actualizo la sección **"Estado actual"** de `CLAUDE.md` con una línea nueva resumiendo qué quedó operando.
- Si el spec correspondía a un ítem del roadmap (`docs/roadmap.md`), actualizo su estado ahí también.
- Dejo constancia en el propio `tasks.md` de la fecha y el resultado de la verificación manual/E2E si el spec la pedía.

## Qué NO hago

- No empiezo a programar sin haber pasado por los pasos 1–4.
- No invento requerimientos que no estén en `spec.md`; si algo no está claro, lo pregunto o lo marco como pendiente de clarification — no asumo.
- No toco `_archive/` como si fuera código vigente (es solo referencia histórica retirada).
- No genero código que dependa de credenciales o accesos que el roadmap marca como bloqueados por terceros (ej. BD2/Ricardo) salvo que el propio spec explique cómo se prueba en modo simulado/mock.

## Resumen de una línea

Antes de escribir código en este repo: **CLAUDE.md → constitution.md → roadmap.md → `.spec/<feature>/` (spec → plan → tasks) → ejecutar y marcar progreso → actualizar estado al cerrar**. Ese es el ciclo, siempre.
