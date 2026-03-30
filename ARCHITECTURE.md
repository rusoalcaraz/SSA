# ARCHITECTURE.md — Sistema de Seguimiento de Adquisiciones

## Vision general

El SSA sigue una arquitectura cliente-servidor en tres capas:

```
[React SPA] <-> [Express REST API] <-> [MongoDB]
```

La API es stateless. El estado de sesion se gestiona mediante JWT en el cliente y refresh tokens en cookie HttpOnly. No hay sesiones del lado del servidor.

---

## Modulos del backend

### 1. Autenticacion (`/api/v1/auth`)

| Ruta | Metodo | Descripcion |
|---|---|---|
| `/login` | POST | Emite access token y refresh token |
| `/logout` | POST | Invalida refresh token |
| `/refresh` | POST | Renueva access token |
| `/cambiar-password` | PUT | Requiere token valido |

### 2. Usuarios (`/api/v1/usuarios`)

Gestionado por `superadmin`. Permite CRUD de usuarios, asignacion de rol, asignacion de DG (para rol `dgt`), asignacion de procedimientos (para rol `asesor_tecnico`).

### 3. Catalogos (`/api/v1/catalogos`)

- `/direcciones-generales` — CRUD de DGs (superadmin)
- `/bienes-servicios` — CRUD del catalogo de bienes/servicios (superadmin)
- `/etapas` — CRUD de etapas de cronograma y hoja de trabajo (superadmin)

### 4. Procedimientos (`/api/v1/procedimientos`)

Recurso central del sistema. Ver DATA_MODEL.md para el esquema completo.

| Ruta | Metodo | Roles permitidos |
|---|---|---|
| `/` | GET | todos (filtrado por rol) |
| `/` | POST | `area_contratante` |
| `/:id` | GET | todos (filtrado por rol) |
| `/:id` | PUT | `area_contratante`, `superadmin` |
| `/:id/urgente` | PATCH | `area_contratante` |
| `/:id/justificacion` | PUT | `area_contratante` |

### 5. Etapas de procedimiento (`/api/v1/procedimientos/:id/etapas`)

| Ruta | Metodo | Roles permitidos |
|---|---|---|
| `/:etapaId/completar` | PATCH | `asesor_tecnico` |
| `/:etapaId/proponer-fecha` | PATCH | `area_contratante` |
| `/:etapaId/responder-fecha` | PATCH | `asesor_tecnico` |
| `/:etapaId/sobreescribir-fecha` | PATCH | `area_contratante` |
| `/:etapaId/observacion` | POST | `asesor_tecnico`, `dgt` |
| `/:etapaId/archivo` | POST | `asesor_tecnico`, `dgt` |

### 6. Entregas (`/api/v1/procedimientos/:id/entregas`)

| Ruta | Metodo | Roles permitidos |
|---|---|---|
| `/` | GET | `area_contratante`, `inspeccion`, `gerencial`, `dgt`, `superadmin` |
| `/` | POST | `area_contratante` |
| `/:entregaId` | PUT | `area_contratante` |
| `/:entregaId/documento` | POST | `inspeccion` |

### 7. Dashboard (`/api/v1/dashboard`)

| Ruta | Metodo | Roles permitidos |
|---|---|---|
| `/resumen` | GET | `gerencial`, `superadmin` |
| `/por-dg/:dgId` | GET | `gerencial`, `superadmin` |
| `/mis-procedimientos` | GET | `asesor_tecnico`, `dgt`, `area_contratante` |

### 8. Reportes (`/api/v1/reportes`)

| Ruta | Metodo | Roles permitidos |
|---|---|---|
| `/pdf` | GET | `gerencial`, `area_contratante`, `superadmin` |
| `/excel` | GET | `gerencial`, `area_contratante`, `superadmin` |

---

## Middleware chain

Toda ruta protegida sigue este orden:

```
Request
  -> rateLimiter
  -> helmet
  -> cors
  -> express.json()
  -> verifyToken (extrae usuario del JWT)
  -> checkRole([roles]) (verifica permiso)
  -> validateRequest (joi schema)
  -> controller
  -> errorHandler
```

---

## Manejo de archivos

- Los archivos se suben con Multer al directorio `uploads/` particionado por tipo:
  - `uploads/justificaciones/{procedimientoId}/`
  - `uploads/observaciones/{procedimientoId}/{etapaId}/`
  - `uploads/entregas/{procedimientoId}/{entregaId}/`
- Solo se aceptan PDF.
- Maximo 10 MB por archivo.
- El nombre del archivo se reemplaza por un UUID para evitar colisiones.
- La ruta relativa se guarda en la base de datos, no el archivo en si.

---

## Cron jobs

Gestionados por `node-cron` en `services/cron.service.js`.

```javascript
// Verificacion diaria a las 08:00
cron.schedule('0 8 * * *', verificarVencimientos);
```

La funcion `verificarVencimientos` busca todas las etapas con:
- `estado` en `['pendiente', 'activo', 'fecha_propuesta', 'fecha_rechazada']`
- `fechaPlaneada` <= hoy (vencidas) o `fechaPlaneada` <= hoy + 3 dias (proximas a vencer)

Por cada etapa encontrada emite la notificacion correspondiente y actualiza el campo `alertaEnviada`.

---

## Seguridad de archivos estaticos

Los archivos en `uploads/` no se sirven directamente. Se accede a ellos a traves de la ruta `/api/v1/archivos/:archivoId` que verifica autenticacion y permiso antes de enviar el buffer.

---

## Variables de entorno requeridas

```env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/ssa
JWT_SECRET=
JWT_REFRESH_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@institucion.gob.mx
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10
FRONTEND_URL=http://localhost:3000
```

---

## Frontend: estructura de rutas React

```
/login
/dashboard                          (gerencial, superadmin)
/procedimientos                     (area_contratante, dgt, asesor_tecnico)
/procedimientos/nuevo               (area_contratante)
/procedimientos/:id                 (segun rol)
/procedimientos/:id/cronograma      (area_contratante, asesor_tecnico, dgt)
/procedimientos/:id/hoja-trabajo    (area_contratante, asesor_tecnico, dgt)
/procedimientos/:id/entregas        (area_contratante, inspeccion, dgt)
/admin/usuarios                     (superadmin)
/admin/catalogos                    (superadmin)
/admin/direcciones-generales        (superadmin)
```

El acceso a rutas se controla con un componente `ProtectedRoute` que lee el rol del usuario desde el contexto de autenticacion.

---

## Consideraciones de despliegue

- El backend y el frontend pueden desplegarse en el mismo servidor o separados.
- Se recomienda Nginx como proxy inverso con SSL terminado en Nginx.
- MongoDB puede ser local o Atlas.
- Los logs de auditoria no deben purgarse automaticamente; se archivan mensualmente.
