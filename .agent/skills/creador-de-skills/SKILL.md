---
name: creador-de-skills
description: Crea un nuevo Antigravity skill cuando el usuario solicita un skill específico en español. Genera la estructura completa del skill incluyendo el archivo SKILL.md con YAML frontmatter apropiado, directorios opcionales si son necesarios (scripts/, examples/, resources/), y valida que la descripción sea clara, concisa y contenga palabras clave relevantes para el matching semántico del agente.
---

# Creador de Skills de Antigravity

Este skill te ayuda a crear nuevos skills de Antigravity cuando el usuario lo solicite en español.

## Cuándo Usar Este Skill

Usa este skill cuando el usuario:
- Diga "crea un skill para..." o "necesito un skill que..."
- Pida "genera un nuevo skill" o solicite automatizar algo mediante un skill
- Quiera documentar un proceso como skill reutilizable

## Estructura de un Antigravity Skill

Un skill de Antigravity tiene la siguiente estructura:

```
my-skill/                     # Nombre del skill en lowercase-with-hyphens
├── SKILL.md                  # REQUERIDO: Definición principal del skill
├── scripts/                  # OPCIONAL: Scripts ejecutables (Python, Bash, Node.js, Go)
├── examples/                 # OPCIONAL: Implementaciones de referencia
├── resources/                # OPCIONAL: Plantillas, configuraciones, documentación
└── assets/                   # OPCIONAL: Imágenes, logos, archivos estáticos
```

### Ubicación de Skills

**Workspace Scope** (específico del proyecto):
```
<workspace-root>/.agent/skills/nombre-del-skill/
```

**Global Scope** (disponible en todos los proyectos):
```
~/.gemini/antigravity/skills/nombre-del-skill/
```

## Formato del Archivo SKILL.md

El archivo `SKILL.md` consiste en dos partes:

### 1. YAML Frontmatter (Metadata)

El frontmatter es la única parte que el router de alto nivel del agente indexa. Es CRUCIAL para el matching semántico.

```yaml
---
name: nombre-del-skill        # OPCIONAL: identificador único (lowercase-with-hyphens)
                               # Si se omite, se usa el nombre de la carpeta
description: Descripción clara de qué hace el skill y cuándo usarlo. Escrita en tercera persona con palabras clave relevantes para que el agente pueda matchear semánticamente cuando el usuario lo necesite.
---
```

**Reglas para el YAML Frontmatter:**
- `name`: Opcional, lowercase con guiones, sin espacios ni mayúsculas
- `description`: **REQUERIDA**, debe ser:
  - Clara y concisa
  - En tercera persona ("Genera...", "Crea...", "Ayuda a...")
  - Rica en palabras clave relevantes
  - Descriptiva sobre CUÁNDO usar el skill (contexto de uso)

### 2. Markdown Body (Instrucciones)

Después del frontmatter, escribe las instrucciones detalladas en Markdown:

```markdown
# Título del Skill

Descripción expandida del skill.

## Cuándo Usar Este Skill

- Caso de uso 1
- Caso de uso 2

## Cómo Funciona

1. Paso 1
2. Paso 2
3. Paso 3

## Ejemplos

### Ejemplo 1: [Descripción]
```

### Uso de Scripts Opcionales

Si el skill necesita ejecutar scripts:

1. Crea el directorio `scripts/` dentro del skill
2. Añade tus scripts (Python, Bash, Node.js, Go)
3. Referencia los scripts en el SKILL.md con rutas relativas

Ejemplo en SKILL.md:
```markdown
## Ejecución

Para ejecutar este skill:

1. Ejecuta `python scripts/process.py`
2. Verifica el output en `output/`
```

## Proceso de Creación de un Nuevo Skill

Cuando el usuario solicite un skill, sigue estos pasos:

### Paso 1: Entender el Requisito
- ¿Qué problema quiere resolver el usuario?
- ¿Cuándo se debe activar este skill?
- ¿Qué entradas necesita?
- ¿Qué salidas debe producir?

### Paso 2: Definir el Nombre y Descripción
- **Nombre**: Crea un nombre descriptivo en lowercase-with-hyphens
- **Descripción**: Escribe una descripción rica en keywords que permita al agente matchear semánticamente

### Paso 3: Crear la Estructura

```bash
# Para workspace-scoped skill
mkdir -p .agent/skills/nombre-del-skill

# Para global skill
mkdir -p ~/.gemini/antigravity/skills/nombre-del-skill
```

### Paso 4: Escribir SKILL.md

Crea el archivo con:
1. YAML frontmatter con `description` obligatoria
2. Markdown body con:
   - Descripción expandida
   - Sección "Cuándo Usar Este Skill"
   - Sección "Cómo Funciona" o "Instrucciones"
   - Ejemplos si son relevantes

### Paso 5: Añadir Recursos Opcionales

Si es necesario:
- `scripts/`: Para scripts ejecutables
- `examples/`: Para código de ejemplo
- `resources/`: Para plantillas o configs
- `assets/`: Para imágenes o assets estáticos

### Paso 6: Validar

Verifica que:
- ✅ El frontmatter YAML está correctamente formateado
- ✅ La `description` es clara, concisa y rica en keywords
- ✅ Las instrucciones son claras y ejecutables
- ✅ El nombre del skill es descriptivo y usa lowercase-with-hyphens

## Mejores Prácticas

1. **Descripción Clara**: La descripción es LO MÁS IMPORTANTE. El agente la usa para decidir si usar el skill.

2. **Keywords Relevantes**: Incluye en la descripción las palabras que un usuario usaría al pedir este skill.

3. **Tercera Persona**: Escribe la descripción como "Genera...", "Crea...", "Ayuda a...", no como "Yo genero..."

4. **Instrucciones Paso a Paso**: En el body, sé específico y claro en cada paso.

5. **Ejemplos Concretos**: Si es posible, incluye ejemplos de uso.

6. **Scripts Simples**: Si usas scripts, mantenlos simples y bien documentados.

## Ejemplo Completo de Skill

### Estructura de Directorios:
```
.agent/skills/deploy-vercel/
├── SKILL.md
├── scripts/
│   └── deploy.sh
└── examples/
    └── next-app-deploy.md
```

### Contenido de SKILL.md:
```markdown
---
name: deploy-vercel
description: Despliega una aplicación Next.js a Vercel cuando el usuario solicita hacer deployment a producción o staging. Ejecuta los comandos de build y deployment necesarios y valida que el proceso sea exitoso.
---

# Deploy a Vercel

Este skill automatiza el proceso de deployment de aplicaciones a Vercel.

## Cuándo Usar Este Skill

- Cuando el usuario diga "despliega a Vercel" o "sube a producción"
- Cuando se necesite hacer deployment a staging o preview
- Cuando se requiera validar el deployment

## Cómo Funciona

1. Valida que exista un proyecto Vercel configurado
2. Ejecuta el build de la aplicación
3. Ejecuta el comando de deployment (`vercel --prod` o `vercel`)
4. Verifica que el deployment sea exitoso
5. Retorna la URL del deployment

## Ejecución

Para ejecutar el deployment:

```bash
bash scripts/deploy.sh [production|preview]
```

## Notas

- Requiere Vercel CLI instalado
- Necesita autenticación previa con `vercel login`
```

## Síntesis

Cuando el usuario pida un skill:

1. **Pregunta** si no está claro qué hace o cuándo se debe usar
2. **Crea** la estructura del directorio
3. **Escribe** el SKILL.md con frontmatter YAML apropiado
4. **Añade** scripts u otros recursos si son necesarios
5. **Valida** que todo esté correcto
6. **Informa** al usuario de la creación exitosa

**Recuerda**: La descripción en el YAML frontmatter es CRÍTICA. Es lo que el agente usa para decidir si usar tu skill.
