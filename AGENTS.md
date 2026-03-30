# AGENTS.md — Sistema de Seguimiento de Adquisiciones (SSA)

## Proposito del sistema

El SSA es una aplicacion web institucional que permite el seguimiento y control de procedimientos de adquisicion de bienes y servicios del sector publico, apegado a la Ley de Adquisiciones, Arrendamientos y Servicios del Sector Publico (LAASSP, DOF 16-04-2025) y su Reglamento.

El sistema cubre tres etapas del ciclo de vida de un procedimiento:

1. **Cronograma** — integracion documental previa al procedimiento formal
2. **Hoja de trabajo** — procedimiento formal de adquisicion
3. **Entregas** — recepcion parcial o total del bien o servicio adjudicado

---

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Backend API | Node.js + Express.js (REST) |
| Base de datos | MongoDB + Mongoose |
| Autenticacion | JWT (access token 15 min, refresh token 7 dias) + OAuth 2.0 |
| Notificaciones | Nodemailer (SMTP) + cron jobs (node-cron) |
| Almacenamiento de archivos | Multer + disco local (ruta configurable) |
| Reportes | PDFKit (PDF) + ExcelJS (Excel) |

No se usa GraphQL en el MVP. REST convencional con versionado `/api/v1/`.

---

## Estructura de carpetas

```
ssa/
  backend/
    src/
      config/           # variables de entorno, conexion DB
      middleware/       # auth, roles, upload, error handler
      models/           # esquemas Mongoose
      routes/           # rutas REST por recurso
      controllers/      # logica de negocio
      services/         # notificaciones, reportes, cron
      utils/            # helpers, constantes
    tests/
  frontend/
    src/
      components/       # componentes reutilizables
      pages/            # vistas por rol
      hooks/            # custom hooks
      context/          # AuthContext, NotificacionContext
      services/         # llamadas a la API
      utils/
  docs/                 # archivos .md de arquitectura
```

---

## Roles del sistema

Existen seis roles. El control de acceso se implementa mediante middleware `checkRole(roles[])` en cada ruta.

| Rol (slug) | Descripcion |
|---|---|
| `superadmin` | Administracion completa: usuarios, roles, catalogo de DGs, catalogo de bienes/servicios |
| `gerencial` | Solo lectura: dashboard total, filtros por DG, datos del AT |
| `area_contratante` | Crea procedimientos, modifica fechas de cronograma/HT, puede sobreescribir si AT rechaza |
| `asesor_tecnico` | Ve y gestiona solo sus procedimientos asignados (titular o suplente). Agrega observaciones, acepta o rechaza cambios de fecha |
| `dgt` | Direccion General Tecnica: lee procedimientos de su propia DG, agrega observaciones, valida etapas, solicita informacion al AT |
| `inspeccion` | Solo ve y carga documentos en la etapa de Entregas |

### Reglas criticas de acceso

- El AT titular y el AT suplente tienen los mismos permisos sobre el procedimiento asignado.
- Un procedimiento pertenece siempre a una sola Direccion General.
- El perfil `dgt` esta ligado a una DG especifica en su registro de usuario; solo puede ver procedimientos de esa DG.
- El perfil `gerencial` no puede modificar ningun dato; es exclusivamente de consulta y monitoreo.
- El perfil `inspeccion` no puede ver cronograma ni hoja de trabajo.

---

## Flujo de cambio de fechas (cronograma / hoja de trabajo)

1. `area_contratante` propone nueva fecha en una etapa → estado de la etapa cambia a `fecha_propuesta`.
2. Notificacion automatica al AT titular (y suplente si existe).
3. AT puede **aceptar** (estado → `activo`) o **rechazar** (estado → `fecha_rechazada`, con campo `motivoRechazo`).
4. Si el AT rechaza, `area_contratante` puede **sobreescribir** → estado → `activo`, quedando registro del rechazo previo en el historial.
5. Toda accion queda registrada en el array `historialFechas` de la etapa con timestamp, usuario y accion.

---

## Procedimientos urgentes

Un procedimiento puede marcarse como urgente al momento de su creacion o en cualquier momento posterior por el `area_contratante`. Los procedimientos urgentes:

- Muestran un indicador visual en el dashboard gerencial y en todas las vistas de listado.
- Tienen plazos reducidos en el cronograma (el numero de dias es configurable por el superadmin).
- El campo en el modelo es `urgente: Boolean` con `justificacionUrgencia: String` obligatorio cuando es `true`.

---

## Justificacion del tipo de procedimiento

Todo procedimiento debe incluir:

- `tipoProcedimiento`: enum con los valores validos (ver DATA_MODEL.md).
- `justificacionTipo`: texto libre con la fundamentacion legal (referencia al articulo aplicable de la LAASSP).
- `evidenciaJustificacion`: array de archivos PDF cargados como evidencia grafica.

La LAASSP vigente (Art. 53 y 54) establece los supuestos de excepcion a la licitacion publica. El sistema debe permitir seleccionar el supuesto aplicable del Art. 54 cuando el tipo sea `invitacion_tres_personas` o `adjudicacion_directa`.

---

## Etapas del cronograma y hoja de trabajo

Las etapas tienen una base comun y etapas opcionales segun el tipo de procedimiento. El catalogo de etapas es administrado por el `superadmin`.

### Estructura de cada etapa

```json
{
  "nombre": "String",
  "descripcion": "String",
  "tipo": "cronograma | hoja_de_trabajo",
  "obligatoria": true,
  "aplicaA": ["licitacion_publica", "invitacion_tres_personas", "adjudicacion_directa"],
  "orden": 1,
  "fechaPlaneada": "Date",
  "fechaReal": "Date",
  "estado": "pendiente | activo | completado | vencido | fecha_propuesta | fecha_rechazada",
  "observaciones": [],
  "historialFechas": [],
  "archivosAdjuntos": []
}
```

### Regla de flujo secuencial estricto

Una etapa no puede marcarse como `completado` si la etapa anterior (por `orden`) no tiene estado `completado`. Esta validacion se implementa en el controller antes de cualquier actualizacion de estado.

---

## Notificaciones automaticas

El servicio de notificaciones (`services/notificaciones.service.js`) se activa en los siguientes eventos:

| Evento | Destinatario |
|---|---|
| Area contratante propone cambio de fecha | AT titular + AT suplente |
| Etapa vence (fecha planeada < hoy y estado != completado) | AT titular + AT suplente + DGT de la DG correspondiente |
| Etapa proxima a vencer (3 dias antes) | AT titular + AT suplente |
| Procedimiento urgente creado | Gerencial + DGT de la DG correspondiente |

El cron job de verificacion de vencimientos corre diariamente a las 08:00 hora de servidor.

---

## Reportes

Los reportes se generan bajo demanda desde el dashboard del perfil `gerencial` y del `area_contratante`.

- **PDF**: resumen ejecutivo de procedimientos (PDFKit).
- **Excel**: tabla completa con todos los campos (ExcelJS).

Filtros disponibles: anio fiscal, DG, tipo de procedimiento, etapa actual, estatus (cronograma / hoja de trabajo / entregas), urgente.

---

## Autenticacion y seguridad

- JWT access token: 15 minutos de vida.
- Refresh token: 7 dias, almacenado en cookie HttpOnly.
- OAuth 2.0: opcional para integracion con proveedor institucional (configurable).
- Todas las contrasenas se hashean con bcrypt (salt rounds: 12).
- Rate limiting: 100 req/15min por IP (express-rate-limit).
- Helmet.js para headers de seguridad.
- CORS configurado explicitamente para el dominio de frontend.
- Logs de auditoria en coleccion `auditLogs` para toda accion sensible (login, cambio de fechas, sobreescritura, carga de archivos).

---

## Convencion de respuestas API

```json
{
  "success": true,
  "data": {},
  "message": "Descripcion de la operacion",
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150
  }
}
```

En caso de error:

```json
{
  "success": false,
  "error": {
    "code": "ETAPA_BLOQUEADA",
    "message": "No se puede completar esta etapa sin completar la anterior"
  }
}
```

---

## Reglas para Claude Code

- Nunca usar emojis en el codigo, comentarios o mensajes del sistema.
- Usar nombres de variables y comentarios en espanol, excepto palabras reservadas del lenguaje.
- Todo acceso a la base de datos va a traves de Mongoose; no se usa MongoDB driver directamente.
- Toda subida de archivos se valida: solo PDF, maximo 10 MB por archivo.
- Implementar siempre el middleware de autenticacion y autorizacion antes del controller.
- Los controladores no tienen logica de negocio compleja; esta va en los servicios.
- Todas las rutas siguen el patron `/api/v1/{recurso}`.
- Leer ARCHITECTURE.md, ROLES_AND_PERMISSIONS.md y DATA_MODEL.md antes de implementar cualquier modulo nuevo.
