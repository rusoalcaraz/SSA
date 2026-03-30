# DATA_MODEL.md — Modelo de datos MongoDB

## Colecciones

### usuarios

```javascript
{
  _id: ObjectId,
  nombre: String, // required
  apellidos: String, // required
  correo: String, // required, unique, lowercase
  passwordHash: String, // required
  rol: {
    type: String,
    enum: ['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt', 'inspeccion'],
    required: true
  },
  // Solo para rol 'dgt': DG a la que pertenece
  direccionGeneral: { type: ObjectId, ref: 'DireccionGeneral' },
  activo: { type: Boolean, default: true },
  refreshTokens: [String], // array para soporte multi-dispositivo
  createdAt: Date,
  updatedAt: Date
}
```

### direccionesGenerales

Catalogo configurable desde admin. Puede crecer en cualquier momento.

```javascript
{
  _id: ObjectId,
  nombre: String, // required, unique
  siglas: String, // ej: "DGMG"
  descripcion: String,
  activa: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

### catalogoBienesServicios

Catalogo propio de la institucion, configurable desde superadmin.

```javascript
{
  _id: ObjectId,
  clave: String, // codigo interno unico
  descripcion: String, // required
  tipo: { type: String, enum: ['bien', 'servicio', 'bien_y_servicio'] },
  unidadMedida: String, // ej: 'pieza', 'servicio', 'mes'
  activo: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

### catalogoEtapas

Catalogo de etapas para cronograma y hoja de trabajo, administrado por superadmin.

```javascript
{
  _id: ObjectId,
  nombre: String, // required
  descripcion: String,
  tipo: { type: String, enum: ['cronograma', 'hoja_de_trabajo'], required: true },
  obligatoria: { type: Boolean, default: true },
  aplicaA: [{
    type: String,
    enum: ['licitacion_publica', 'invitacion_tres_personas', 'adjudicacion_directa']
  }],
  orden: { type: Number, required: true },
  diasAlertaUrgente: Number, // dias de anticipacion para alerta en procedimientos urgentes
  activa: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

### procedimientos

Coleccion central del sistema.

```javascript
{
  _id: ObjectId,

  // Identificacion
  numeroProcedimiento: String, // generado automaticamente, unico por anio
  anioFiscal: Number,
  titulo: String, // required
  descripcion: String,

  // Bien o servicio
  bienServicio: { type: ObjectId, ref: 'CatalogoBienesServicios', required: true },
  descripcionEspecifica: String, // descripcion particular de esta adquisicion
  montoEstimado: Number,
  moneda: { type: String, default: 'MXN' },

  // Organizacion
  direccionGeneral: { type: ObjectId, ref: 'DireccionGeneral', required: true },

  // Asesores tecnicos
  asesorTitular: { type: ObjectId, ref: 'Usuario', required: true },
  asesorSuplente: { type: ObjectId, ref: 'Usuario' },

  // Tipo de procedimiento y justificacion legal
  tipoProcedimiento: {
    type: String,
    enum: [
      'licitacion_publica_nacional',
      'licitacion_publica_internacional_libre',
      'licitacion_publica_internacional_tratados',
      'invitacion_tres_personas',
      'adjudicacion_directa'
    ],
    required: true
  },
  supuestoExcepcion: String, // Art. 54 LAASSP, ej: "fraccion_IV" (solo aplica para excepciones)
  tipoConsultoria: {
    // Solo cuando supuestoExcepcion = "fraccion_X" (Art. 109 frac. IX Reglamento)
    type: String,
    enum: ['estandarizado', 'personalizado', 'especializado'],
    default: null
  },
  justificacionTipo: String, // texto libre con fundamentacion legal (estructura segun Art. 108 Reglamento)
  evidenciaJustificacion: [{
    nombre: String,
    ruta: String,
    fechaCarga: Date,
    cargadoPor: { type: ObjectId, ref: 'Usuario' }
  }],

  // Urgencia
  urgente: { type: Boolean, default: false },
  justificacionUrgencia: String, // obligatorio si urgente = true

  // Estado general
  etapaActual: {
    type: String,
    enum: ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido', 'cancelado'],
    default: 'cronograma'
  },

  // Cronograma (etapas pre-procedimiento)
  cronograma: [EtapaProcedimientoSchema],

  // Hoja de trabajo (etapas del procedimiento formal)
  hojaDeTrabajoEtapas: [EtapaProcedimientoSchema],

  // Entregas
  entregas: [EntregaSchema],

  // Contrato / convenio (post-adjudicacion)
  contrato: {
    numeroContrato: String,
    fechaFirma: Date,
    proveedor: String,
    montoContratado: Number,
    archivos: [{
      nombre: String,
      ruta: String,
      fechaCarga: Date,
      cargadoPor: { type: ObjectId, ref: 'Usuario' }
    }]
  },

  // Auditoria
  creadoPor: { type: ObjectId, ref: 'Usuario', required: true },
  createdAt: Date,
  updatedAt: Date
}
```

### Sub-schema: EtapaProcedimientoSchema

Usado tanto en `cronograma` como en `hojaDeTrabajoEtapas`.

```javascript
{
  catalogoEtapa: { type: ObjectId, ref: 'CatalogoEtapas', required: true },
  nombre: String, // copiado del catalogo al crear el procedimiento
  orden: Number,  // copiado del catalogo
  obligatoria: Boolean,

  fechaPlaneada: Date,
  fechaReal: Date, // se llena al completar

  estado: {
    type: String,
    enum: ['pendiente', 'activo', 'completado', 'vencido', 'fecha_propuesta', 'fecha_rechazada'],
    default: 'pendiente'
  },

  // Propuesta de cambio de fecha por area contratante
  fechaPropuesta: Date,
  motivoRechazo: String,

  // Historial de cambios de fecha
  historialFechas: [{
    fechaAnterior: Date,
    fechaNueva: Date,
    accion: { type: String, enum: ['propuesta', 'aceptada', 'rechazada', 'sobreescrita'] },
    realizadoPor: { type: ObjectId, ref: 'Usuario' },
    timestamp: { type: Date, default: Date.now },
    motivo: String
  }],

  // Observaciones
  observaciones: [{
    texto: String, // required
    archivos: [{
      nombre: String,
      ruta: String
    }],
    creadoPor: { type: ObjectId, ref: 'Usuario' },
    timestamp: { type: Date, default: Date.now }
  }],

  alertaEnviada: { type: Boolean, default: false },
  completadoPor: { type: ObjectId, ref: 'Usuario' },
  completadoEn: Date
}
```

### Sub-schema: EntregaSchema

```javascript
{
  descripcion: String, // descripcion de esta entrega
  tipo: { type: String, enum: ['parcial', 'total'] },
  fechaEstimada: Date,
  fechaReal: Date,

  estado: {
    type: String,
    enum: ['pendiente', 'recibida', 'rechazada'],
    default: 'pendiente'
  },

  // Documentos de comprobacion cargados por inspeccion
  documentos: [{
    tipo: {
      type: String,
      enum: ['constancia_recepcion', 'hoja_aceptacion', 'otro']
    },
    nombre: String,
    ruta: String,
    fechaCarga: { type: Date, default: Date.now },
    cargadoPor: { type: ObjectId, ref: 'Usuario' }
  }],

  observaciones: String,
  registradoPor: { type: ObjectId, ref: 'Usuario' }
}
```

### auditLogs

Registro inmutable de acciones sensibles. No se borra, solo se archiva.

```javascript
{
  _id: ObjectId,
  usuario: { type: ObjectId, ref: 'Usuario', required: true },
  accion: String, // ej: 'LOGIN', 'SOBREESCRITURA_FECHA', 'CARGA_ARCHIVO', 'CAMBIO_ESTADO'
  recurso: String, // ej: 'procedimiento', 'etapa', 'entrega'
  recursoId: ObjectId,
  detalle: mongoose.Schema.Types.Mixed, // objeto libre con contexto de la accion
  ip: String,
  userAgent: String,
  timestamp: { type: Date, default: Date.now }
}
```

---

## Indices recomendados

```javascript
// Procedimientos
db.procedimientos.createIndex({ anioFiscal: 1 })
db.procedimientos.createIndex({ direccionGeneral: 1 })
db.procedimientos.createIndex({ asesorTitular: 1 })
db.procedimientos.createIndex({ asesorSuplente: 1 })
db.procedimientos.createIndex({ etapaActual: 1 })
db.procedimientos.createIndex({ urgente: 1 })
db.procedimientos.createIndex({ numeroProcedimiento: 1 }, { unique: true })

// Usuarios
db.usuarios.createIndex({ correo: 1 }, { unique: true })
db.usuarios.createIndex({ rol: 1 })
db.usuarios.createIndex({ direccionGeneral: 1 })

// Audit logs
db.auditLogs.createIndex({ usuario: 1, timestamp: -1 })
db.auditLogs.createIndex({ recursoId: 1 })
```

---

## Generacion del numero de procedimiento

El campo `numeroProcedimiento` se genera automaticamente al crear un procedimiento con el formato:

```
SSA-{ANIO}-{SIGLAS_DG}-{SECUENCIA_PADDED}
```

Ejemplo: `SSA-2025-DGMG-0042`

La secuencia se obtiene contando los procedimientos existentes de la misma DG en el mismo anio fiscal y sumando 1, con padding de 4 digitos.
