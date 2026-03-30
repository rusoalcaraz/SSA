# ROLES_AND_PERMISSIONS.md — Matriz de permisos por rol

## Resumen de roles

| Rol | Puede crear | Puede modificar | Puede ver | Restriccion de alcance |
|---|---|---|---|---|
| `superadmin` | Todo | Todo | Todo | Sin restriccion |
| `gerencial` | Nada | Nada | Todo | Sin restriccion |
| `area_contratante` | Procedimientos, entregas | Fechas, datos del procedimiento | Todo excepto solo-inspeccion | Sin restriccion |
| `asesor_tecnico` | Observaciones, archivos | Responde cambios de fecha, completa etapas | Solo sus procedimientos | Por asignacion |
| `dgt` | Observaciones, archivos, solicitudes de info | Nada estructural | Su propia DG | Por DG |
| `inspeccion` | Documentos de entrega | Nada estructural | Solo etapa Entregas | Sin restriccion de DG |

---

## Matriz detallada por funcionalidad

### Gestion de usuarios y catalogos

| Accion | superadmin | gerencial | area_contratante | asesor_tecnico | dgt | inspeccion |
|---|---|---|---|---|---|---|
| Crear/editar usuarios | SI | NO | NO | NO | NO | NO |
| Crear/editar DGs | SI | NO | NO | NO | NO | NO |
| Crear/editar catalogo bienes/servicios | SI | NO | NO | NO | NO | NO |
| Crear/editar catalogo de etapas | SI | NO | NO | NO | NO | NO |
| Ver catalogo de etapas | SI | NO | SI | SI | SI | NO |

### Procedimientos

| Accion | superadmin | gerencial | area_contratante | asesor_tecnico | dgt | inspeccion |
|---|---|---|---|---|---|---|
| Crear procedimiento | SI | NO | SI | NO | NO | NO |
| Ver listado de procedimientos | SI | Todos | Todos | Solo los suyos | Solo su DG | NO |
| Ver detalle de procedimiento | SI | SI | SI | Solo los suyos | Solo su DG | NO |
| Editar datos generales del procedimiento | SI | NO | SI | NO | NO | NO |
| Marcar como urgente | SI | NO | SI | NO | NO | NO |
| Cargar evidencia de justificacion | SI | NO | SI | NO | NO | NO |
| Ver justificacion y evidencia | SI | SI | SI | Solo los suyos | Solo su DG | NO |

### Cronograma y hoja de trabajo — etapas

| Accion | superadmin | gerencial | area_contratante | asesor_tecnico | dgt | inspeccion |
|---|---|---|---|---|---|---|
| Ver cronograma | SI | SI | SI | Solo los suyos | Solo su DG | NO |
| Ver hoja de trabajo | SI | SI | SI | Solo los suyos | Solo su DG | NO |
| Proponer cambio de fecha | SI | NO | SI | NO | NO | NO |
| Aceptar cambio de fecha | SI | NO | NO | SI (los suyos) | NO | NO |
| Rechazar cambio de fecha | SI | NO | NO | SI (los suyos) | NO | NO |
| Sobreescribir fecha (tras rechazo AT) | SI | NO | SI | NO | NO | NO |
| Completar etapa | SI | NO | NO | SI (los suyos) | NO | NO |
| Agregar observacion con texto y PDF | SI | NO | NO | SI (los suyos) | SI (su DG) | NO |
| Validar etapa | SI | NO | NO | NO | SI (su DG) | NO |
| Solicitar informacion al AT | SI | NO | NO | NO | SI (su DG) | NO |
| Ver observaciones | SI | SI | SI | SI (los suyos) | SI (su DG) | NO |
| Ver archivos adjuntos en etapas | SI | SI | SI | SI (los suyos) | SI (su DG) | NO |

### Entregas

| Accion | superadmin | gerencial | area_contratante | asesor_tecnico | dgt | inspeccion |
|---|---|---|---|---|---|---|
| Ver entregas | SI | SI | SI | Solo los suyos | Solo su DG | SI (todas) |
| Crear/editar entrega | SI | NO | SI | NO | NO | NO |
| Cargar documentos (constancias, hojas de aceptacion) | SI | NO | NO | NO | NO | SI |
| Ver documentos de entrega | SI | SI | SI | Solo los suyos | Solo su DG | SI |

### Dashboard y reportes

| Accion | superadmin | gerencial | area_contratante | asesor_tecnico | dgt | inspeccion |
|---|---|---|---|---|---|---|
| Dashboard gerencial total | SI | SI | NO | NO | NO | NO |
| Filtrar dashboard por DG | SI | SI | NO | NO | NO | NO |
| Ver datos del AT en dashboard | SI | SI | NO | NO | NO | NO |
| Dashboard propio (mis procedimientos) | SI | NO | SI | SI | SI | NO |
| Exportar reporte PDF | SI | SI | SI | NO | NO | NO |
| Exportar reporte Excel | SI | SI | SI | NO | NO | NO |

---

## Reglas especiales

### Asesor tecnico titular vs suplente

El AT suplente tiene exactamente los mismos permisos que el AT titular sobre el procedimiento al que esta asignado. La diferencia es conceptual (cobertura en ausencias) y no tecnica. Ambos reciben notificaciones.

En el middleware de autorizacion para recursos del AT:

```javascript
// Verifica si el usuario es AT titular o suplente del procedimiento
const esMiProcedimiento = (procedimiento, usuarioId) =>
  procedimiento.asesorTitular.equals(usuarioId) ||
  (procedimiento.asesorSuplente && procedimiento.asesorSuplente.equals(usuarioId));
```

### Flujo de sobreescritura de fecha

Cuando el AT rechaza una fecha propuesta por el AC:
1. El AC ve en la interfaz el rechazo y el motivo.
2. El AC puede proponer una nueva fecha (vuelve a `fecha_propuesta`) o sobreescribir la fecha original.
3. La sobreescritura queda registrada en `historialFechas` con accion `'sobreescrita'`.
4. No existe limite de veces que el AC puede sobreescribir.

### Restriccion del perfil DGT

El campo `direccionGeneral` en el documento de usuario es obligatorio para el rol `dgt`. El middleware de autorizacion verifica que el `procedimiento.direccionGeneral` sea igual al `usuario.direccionGeneral`.

```javascript
// En el middleware de autorizacion para DGT
if (usuario.rol === 'dgt') {
  if (!procedimiento.direccionGeneral.equals(usuario.direccionGeneral)) {
    return res.status(403).json({ success: false, error: { code: 'ACCESO_DENEGADO' } });
  }
}
```

### Perfil inspeccion

El perfil `inspeccion` solo tiene acceso a la sub-ruta `/api/v1/procedimientos/:id/entregas`. Cualquier intento de acceder a cronograma, hoja de trabajo o datos generales del procedimiento retorna 403.

La restriccion se implementa en el middleware de la ruta, no en el controller.
