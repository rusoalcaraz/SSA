# WORKFLOWS.md — Flujos de negocio

## 1. Creacion de un procedimiento de adquisicion

**Actor:** `area_contratante`

```
1. AC selecciona "Nuevo procedimiento"
2. Captura:
   - Titulo y descripcion
   - Anio fiscal
   - Direccion General responsable
   - Bien o servicio del catalogo (con descripcion especifica y monto estimado)
   - Tipo de procedimiento (LP nacional / LP int. libre / LP int. bajo tratados / invitacion 3 / adjudicacion directa)
   - Si es excepcion a licitacion: selecciona el supuesto del Art. 54 LAASSP
   - Justificacion legal del tipo (texto)
   - Evidencia grafica (PDF adjunto, opcional en creacion, obligatorio antes de iniciar HT)
   - AT titular (busqueda de usuario con rol asesor_tecnico)
   - AT suplente (opcional)
   - Marcar como urgente (si aplica, con justificacion obligatoria)

3. Sistema genera:
   - Numero de procedimiento (SSA-{ANIO}-{SIGLAS_DG}-{SEQ})
   - Etapas de cronograma segun tipo de procedimiento (del catalogo de etapas)
   - Estado inicial: etapaActual = 'cronograma'

4. Notificacion automatica al AT titular (y suplente si existe)
   confirmando asignacion al procedimiento.
```

---

## 2. Gestion del cronograma

**Actores principales:** `asesor_tecnico`, `area_contratante`, `dgt`

El cronograma es la etapa de integracion documental previa al procedimiento formal. Las etapas son secuenciales estrictas.

```
Estado inicial: todas las etapas en estado 'pendiente'

FLUJO NORMAL:
  AT marca la primera etapa como activa (o el sistema la activa automaticamente)
  AT completa los trabajos de la etapa
  AT marca la etapa como 'completado' -> sistema activa la siguiente etapa
  ... repite hasta completar todas las etapas del cronograma

FLUJO CON CAMBIO DE FECHA:
  AC propone nueva fecha en cualquier etapa activa o pendiente
    -> etapa.estado = 'fecha_propuesta'
    -> notificacion automatica al AT (titular y suplente)
  AT acepta:
    -> etapa.fechaPlaneada = fechaPropuesta
    -> etapa.estado = estado previo (activo/pendiente)
    -> registro en historialFechas con accion 'aceptada'
  AT rechaza (con motivo obligatorio):
    -> etapa.estado = 'fecha_rechazada'
    -> etapa.motivoRechazo = texto del AT
    -> AC puede proponer nueva fecha (ciclo se repite) o sobreescribir
  AC sobreescribe:
    -> etapa.fechaPlaneada = fechaPropuesta
    -> etapa.estado = estado previo
    -> registro en historialFechas con accion 'sobreescrita'

OBSERVACIONES (AT o DGT):
  Cualquiera de los dos puede agregar observaciones en cualquier etapa
  en cualquier momento, con texto libre y adjunto PDF opcional.

VALIDACION DE DGT:
  DGT puede marcar una etapa como validada (campo booleano adicional)
  y puede enviar solicitudes de informacion al AT (observacion de tipo especial).

VENCIMIENTO:
  El cron job diario detecta etapas con fechaPlaneada < hoy y estado != 'completado'
  -> etapa.estado = 'vencido' (si no estaba ya en ese estado)
  -> notificacion a AT y DGT
```

---

## 3. Transicion de cronograma a hoja de trabajo

**Actor:** `area_contratante`

```
Condicion: todas las etapas obligatorias del cronograma tienen estado 'completado'
           y existe al menos un archivo de evidencia de justificacion cargado.

AC inicia la hoja de trabajo:
  -> sistema verifica condicion de completitud del cronograma
  -> si se cumple: procedimiento.etapaActual = 'hoja_de_trabajo'
  -> sistema genera las etapas de la hoja de trabajo
     segun el tipo de procedimiento (del catalogo de etapas)
  -> notificacion al AT, DGT y gerencial
```

---

## 4. Gestion de la hoja de trabajo

El flujo es identico al del cronograma (mismo schema, mismas reglas).

La diferencia semantica es que la hoja de trabajo corresponde al procedimiento formal de adquisicion (publicacion de convocatoria, juntas de aclaraciones, apertura de propuestas, fallo, firma de contrato, etc., segun el tipo de procedimiento y los plazos de la LAASSP).

```
Plazos de referencia LAASSP (Art. 42):
  - Licitacion internacional: minimo 20 dias naturales para apertura de propuestas
  - Licitacion nacional: minimo 15 dias naturales
  - Reduccion justificada: no menos de 10 dias naturales
  - Invitacion a 3 personas: no menos de 5 dias naturales (Art. 56, frac. IV)

El sistema no valida automaticamente estos plazos legales,
pero las etapas del catalogo pueden configurarse con duraciones minimas sugeridas.
```

---

## 5. Registro de adjudicacion y contrato

**Actor:** `area_contratante`

```
Una vez emitido el fallo y firmado el contrato:
  AC captura en el procedimiento:
    - Numero de contrato / convenio
    - Fecha de firma
    - Nombre del proveedor adjudicado
    - Monto contratado final
    - Archivos del contrato (PDF)

  AC crea las entregas previstas:
    - Una o varias entregas (parciales o total)
    - Cada entrega tiene: descripcion, tipo (parcial/total), fecha estimada

  Sistema cambia: procedimiento.etapaActual = 'entregas'
```

---

## 6. Gestion de entregas

**Actores:** `area_contratante` (crea y edita entregas), `inspeccion` (carga documentos)

```
Para cada entrega:
  Inspeccion recibe el bien o servicio fisicamente
  Inspeccion carga en el sistema:
    - Constancia de recepcion (PDF)
    - Hoja de aceptacion (PDF)
    - Documentacion adicional comprobatoria (PDF)
  Inspeccion actualiza el estado de la entrega:
    - 'recibida': bien/servicio recibido a satisfaccion
    - 'rechazada': no cumple especificaciones (con observacion obligatoria)

  AC puede ver el estado de todas las entregas y actualizar fechas.

Cuando todas las entregas tienen estado 'recibida':
  AC puede marcar el procedimiento como 'concluido'
  -> procedimiento.etapaActual = 'concluido'
```

---

## 7. Dashboard gerencial

**Actor:** `gerencial`, `superadmin`

```
Vista por defecto: todos los procedimientos del anio fiscal en curso
  Tarjetas de resumen:
    - Total de procedimientos
    - En cronograma / en hoja de trabajo / en entregas / concluidos / cancelados
    - Procedimientos urgentes activos
    - Etapas vencidas en total

Filtros disponibles:
  - Anio fiscal
  - Etapa actual (cronograma / hoja de trabajo / entregas)
  - Direccion General
  - Tipo de procedimiento
  - Urgente (si/no)

Por cada procedimiento en el listado se muestra:
  - Numero de procedimiento
  - Titulo
  - DG responsable
  - Tipo de procedimiento
  - Etapa actual y porcentaje de avance
  - AT titular (nombre completo, correo)
  - AT suplente (si existe)
  - Indicador de urgencia
  - Indicador de etapas vencidas

Al hacer clic en un procedimiento:
  - Vista de solo lectura completa del procedimiento
  - Cronograma, hoja de trabajo y entregas
  - Todas las observaciones y archivos adjuntos
```

---

## 8. Notificaciones — resumen de eventos

| Evento | Quien notifica | A quien |
|---|---|---|
| Asignacion de procedimiento al AT | Sistema | AT titular + suplente |
| AC propone cambio de fecha | Sistema | AT titular + suplente |
| AT acepta/rechaza cambio | Sistema | AC |
| AC sobreescribe fecha | Sistema | AT titular + suplente |
| Etapa proxima a vencer (3 dias) | Cron 08:00 | AT titular + suplente |
| Etapa vencida | Cron 08:00 | AT titular + suplente + DGT |
| Cronograma completado / inicio HT | Sistema | AT titular + suplente + DGT + gerencial |
| Procedimiento concluido | Sistema | DGT + gerencial |
| Procedimiento marcado urgente | Sistema | DGT + gerencial |
