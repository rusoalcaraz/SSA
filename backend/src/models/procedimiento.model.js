'use strict';

const mongoose = require('mongoose');
const { TIPOS_PROCEDIMIENTO } = require('./catalogoEtapas.model');

// -------------------------------------------------------
// Sub-schema: entrada del historial de fechas
// -------------------------------------------------------
const historialFechaSchema = new mongoose.Schema(
  {
    fechaAnterior: Date,
    fechaNueva: Date,
    accion: {
      type: String,
      enum: ['propuesta', 'aceptada', 'rechazada', 'sobreescrita'],
      required: true,
    },
    realizadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    timestamp: { type: Date, default: Date.now },
    motivo: String,
  },
  { _id: false }
);

// -------------------------------------------------------
// Sub-schema: archivo adjunto generico
// -------------------------------------------------------
const archivoAdjuntoSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    ruta: { type: String, required: true },
    fechaCarga: { type: Date, default: Date.now },
    cargadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { _id: true }
);

// -------------------------------------------------------
// Sub-schema: observacion dentro de una etapa
// -------------------------------------------------------
const observacionSchema = new mongoose.Schema(
  {
    texto: { type: String, required: [true, 'El texto de la observacion es requerido'] },
    archivos: [
      {
        nombre: String,
        ruta: String,
        _id: false,
      },
    ],
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

// -------------------------------------------------------
// Sub-schema: etapa dentro de cronograma o hoja de trabajo
// -------------------------------------------------------
const etapaProcedimientoSchema = new mongoose.Schema(
  {
    catalogoEtapa: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogoEtapas',
      required: true,
    },
    nombre: { type: String, required: true },
    orden: { type: Number, required: true },
    obligatoria: { type: Boolean, default: true },

    fechaPlaneada: Date,
    fechaReal: Date,

    estado: {
      type: String,
      enum: ['pendiente', 'activo', 'completado', 'vencido', 'fecha_propuesta', 'fecha_rechazada'],
      default: 'pendiente',
    },

    fechaPropuesta: Date,
    motivoRechazo: String,

    historialFechas: [historialFechaSchema],
    observaciones: [observacionSchema],

    alertaEnviada: { type: Boolean, default: false },
    completadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    completadoEn: Date,
  },
  { _id: true }
);

// -------------------------------------------------------
// Sub-schema: documento de comprobacion en entregas
// -------------------------------------------------------
const documentoEntregaSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: ['constancia_recepcion', 'hoja_aceptacion', 'otro'],
      required: true,
    },
    nombre: { type: String, required: true },
    ruta: { type: String, required: true },
    fechaCarga: { type: Date, default: Date.now },
    cargadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { _id: true }
);

// -------------------------------------------------------
// Sub-schema: entrega
// -------------------------------------------------------
const entregaSchema = new mongoose.Schema(
  {
    descripcion: { type: String, required: [true, 'La descripcion de la entrega es requerida'] },
    tipo: {
      type: String,
      enum: ['parcial', 'total'],
      required: [true, 'El tipo de entrega es requerido'],
    },
    fechaEstimada: Date,
    fechaReal: Date,
    estado: {
      type: String,
      enum: ['pendiente', 'recibida', 'rechazada'],
      default: 'pendiente',
    },
    documentos: [documentoEntregaSchema],
    observaciones: String,
    registradoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
  },
  { _id: true }
);

// -------------------------------------------------------
// Schema principal: Procedimiento
// -------------------------------------------------------
const procedimientoSchema = new mongoose.Schema(
  {
    numeroProcedimiento: {
      type: String,
      unique: true,
      // Se asigna en el pre-save via el servicio
    },
    anioFiscal: {
      type: Number,
      required: [true, 'El anio fiscal es requerido'],
    },
    titulo: {
      type: String,
      required: [true, 'El titulo es requerido'],
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
    },

    // Bien o servicio
    bienServicio: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CatalogoBienesServicios',
      required: [true, 'El bien o servicio es requerido'],
    },
    descripcionEspecifica: {
      type: String,
      trim: true,
    },
    montoEstimado: {
      type: Number,
      min: [0, 'El monto no puede ser negativo'],
    },
    moneda: {
      type: String,
      default: 'MXN',
    },

    // Organizacion
    direccionGeneral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DireccionGeneral',
      required: [true, 'La Direccion General es requerida'],
    },

    // Asesores tecnicos
    asesorTitular: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El asesor titular es requerido'],
    },
    asesorSuplente: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      default: null,
    },

    // Tipo de procedimiento y justificacion legal
    tipoProcedimiento: {
      type: String,
      enum: {
        values: TIPOS_PROCEDIMIENTO,
        message: 'Tipo de procedimiento no valido: {VALUE}',
      },
      required: [true, 'El tipo de procedimiento es requerido'],
    },
    // Art. 54 LAASSP — solo para invitacion y adjudicacion directa
    supuestoExcepcion: {
      type: String,
      default: null,
    },
    // Solo cuando supuestoExcepcion = 'fraccion_X' (Art. 109 frac. IX Reglamento)
    tipoConsultoria: {
      type: String,
      enum: {
        values: ['estandarizado', 'personalizado', 'especializado'],
        message: 'Tipo de consultoria no valido: {VALUE}',
      },
      default: null,
    },
    justificacionTipo: {
      type: String,
      trim: true,
    },
    evidenciaJustificacion: [archivoAdjuntoSchema],

    // Urgencia
    urgente: {
      type: Boolean,
      default: false,
    },
    justificacionUrgencia: {
      type: String,
      trim: true,
    },

    // Estado general del procedimiento
    etapaActual: {
      type: String,
      enum: ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido', 'cancelado'],
      default: 'cronograma',
    },

    cronograma: [etapaProcedimientoSchema],
    hojaDeTrabajoEtapas: [etapaProcedimientoSchema],
    entregas: [entregaSchema],

    // Contrato post-adjudicacion
    contrato: {
      numeroContrato: String,
      fechaFirma: Date,
      proveedor: String,
      montoContratado: Number,
      archivos: [archivoAdjuntoSchema],
    },

    creadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// -------------------------------------------------------
// Validacion: justificacionUrgencia obligatoria cuando urgente=true
// -------------------------------------------------------
procedimientoSchema.pre('validate', function (next) {
  if (this.urgente && !this.justificacionUrgencia) {
    this.invalidate(
      'justificacionUrgencia',
      'La justificacion de urgencia es obligatoria cuando el procedimiento es urgente'
    );
  }

  // supuestoExcepcion requerido para invitacion y adjudicacion directa
  const tiposConExcepcion = ['invitacion_tres_personas', 'adjudicacion_directa'];
  if (tiposConExcepcion.includes(this.tipoProcedimiento) && !this.supuestoExcepcion) {
    this.invalidate(
      'supuestoExcepcion',
      'El supuesto de excepcion (Art. 54 LAASSP) es requerido para este tipo de procedimiento'
    );
  }

  next();
});

// -------------------------------------------------------
// Indices
// -------------------------------------------------------
// numeroProcedimiento ya tiene unique:true en la definicion del campo
procedimientoSchema.index({ anioFiscal: 1 });
procedimientoSchema.index({ direccionGeneral: 1 });
procedimientoSchema.index({ asesorTitular: 1 });
procedimientoSchema.index({ asesorSuplente: 1 });
procedimientoSchema.index({ etapaActual: 1 });
procedimientoSchema.index({ urgente: 1 });

const Procedimiento = mongoose.model('Procedimiento', procedimientoSchema);

module.exports = {
  Procedimiento,
  // Exportar sub-schemas por si se necesitan en tests o seeds
  etapaProcedimientoSchema,
  entregaSchema,
};
