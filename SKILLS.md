# SKILLS.md — Skills recomendados para Claude Code en este proyecto

Este archivo describe los skills `.md` recomendados para configurar Claude Code
y maximizar la calidad del codigo generado para el SSA.

---

## Skills de dominio del proyecto (ya en este repositorio)

Claude Code debe leer estos archivos antes de cualquier tarea:

| Archivo | Cuando leerlo |
|---|---|
| `AGENTS.md` | Siempre, antes de cualquier tarea |
| `ARCHITECTURE.md` | Al crear nuevas rutas, modulos o servicios |
| `DATA_MODEL.md` | Al crear o modificar esquemas Mongoose o queries |
| `ROLES_AND_PERMISSIONS.md` | Al implementar cualquier ruta protegida o logica de acceso |
| `WORKFLOWS.md` | Al implementar logica de negocio de procedimientos o etapas |
| `LEGAL_REFERENCE.md` | Al implementar validaciones relacionadas con plazos o tipos de procedimiento |

---

## Skills de extension recomendados para Claude Code

### 1. express-rest-skill.md

**Proposito:** Guiar la generacion consistente de rutas Express y controladores REST.

**Contenido sugerido:**

```markdown
# Express REST skill

## Estructura de un controlador
- Importa el modelo Mongoose desde `models/`
- Usa try/catch en todos los metodos async
- Llama `next(error)` en el catch para el error handler global
- Nunca retorna datos sensibles (passwordHash, refreshTokens)

## Estructura de una ruta
- Usa express.Router()
- Aplica middleware en este orden: verifyToken -> checkRole -> validateRequest -> controller
- Agrupa por recurso en archivos separados

## Convencion de nombres
- Rutas en kebab-case: /mis-procedimientos
- Metodos del controller en camelCase: getMisProcedimientos
- Archivos en camelCase: procedimientos.controller.js
```

### 2. mongoose-skill.md

**Proposito:** Estandarizar el uso de Mongoose en el proyecto.

**Contenido sugerido:**

```markdown
# Mongoose skill

## Queries
- Siempre usar .lean() en consultas de solo lectura para mayor rendimiento
- Usar .select('-passwordHash -refreshTokens') al poblar usuarios
- Usar .populate() con paths especificos, nunca populate sin campo
- Paginacion: usar .skip((page-1)*limit).limit(limit)

## Updates
- Usar findByIdAndUpdate con { new: true, runValidators: true }
- Para actualizaciones parciales usar $set explicito
- No usar save() en loops; usar bulkWrite para operaciones masivas

## Indices
- Verificar que el indice existe antes de confiar en el rendimiento de una query
- Ver DATA_MODEL.md para los indices definidos
```

### 3. auth-middleware-skill.md

**Proposito:** Asegurar implementacion consistente de autenticacion y autorizacion.

**Contenido sugerido:**

```markdown
# Auth middleware skill

## verifyToken
- Extrae el Bearer token del header Authorization
- Verifica con JWT_SECRET
- Adjunta usuario decodificado a req.user
- Si el token expiro: 401 con code TOKEN_EXPIRADO
- Si el token es invalido: 401 con code TOKEN_INVALIDO

## checkRole
- Recibe array de roles permitidos
- Verifica req.user.rol contra el array
- Si no tiene permiso: 403 con code ACCESO_DENEGADO

## checkProcedimientoAccess
- Middleware especifico para procedimientos
- Verifica que el usuario tenga acceso al procedimiento segun su rol
- Ver ROLES_AND_PERMISSIONS.md para las reglas
```

### 4. notification-skill.md

**Proposito:** Estandarizar el envio de notificaciones por correo.

**Contenido sugerido:**

```markdown
# Notification skill

## Servicio
- Usar nodemailer con configuracion SMTP de variables de entorno
- Siempre envolver en try/catch; un fallo de notificacion NO debe fallar la operacion principal
- Loguear errores de notificacion en consola pero no relanzarlos

## Plantillas
- Usar plantillas HTML simples en espanol
- Incluir: nombre del AT, titulo del procedimiento, numero de procedimiento, etapa afectada
- Incluir enlace al sistema (variable de entorno FRONTEND_URL)

## Eventos
- Ver WORKFLOWS.md seccion 8 para la lista completa de eventos y destinatarios
```

### 5. file-upload-skill.md

**Proposito:** Asegurar manejo seguro y consistente de archivos.

**Contenido sugerido:**

```markdown
# File upload skill

## Configuracion Multer
- Solo acepta application/pdf
- Maximo 10 MB por archivo (MAX_FILE_SIZE_MB del .env)
- Almacenamiento en disco, nombre reemplazado por UUID + extension
- Ruta: {UPLOAD_DIR}/{tipo}/{procedimientoId}/{entregaId_si_aplica}/

## Validacion
- Validar mimetype en el filtro de Multer
- Validar extension del nombre original
- Si el archivo no es PDF: retornar 400 con code ARCHIVO_INVALIDO

## Acceso
- Los archivos se sirven exclusivamente por /api/v1/archivos/:archivoId
- Esta ruta verifica autenticacion y permisos antes de enviar el buffer
- Nunca exponer la ruta real del disco al cliente
```

---

## Instruccion general para Claude Code

Al iniciar cualquier tarea en este proyecto, Claude Code debe:

1. Leer `AGENTS.md` para entender el contexto global.
2. Leer el skill especifico relevante para la tarea (ver tabla de arriba).
3. Verificar en `ROLES_AND_PERMISSIONS.md` que los permisos implementados son correctos.
4. Si la tarea involucra logica de negocio de procedimientos: leer `WORKFLOWS.md`.
5. Si la tarea involucra validaciones legales o tipos de procedimiento: leer `LEGAL_REFERENCE.md`.
6. Nunca usar emojis en codigo, comentarios ni mensajes del sistema.
7. Mantener nombres de variables y comentarios en espanol.
