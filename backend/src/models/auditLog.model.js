'use strict';

const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
    },
    accion: {
      type: String,
      required: true,
      // Ejemplos: 'LOGIN', 'LOGOUT', 'CAMBIO_PASSWORD', 'SOBREESCRITURA_FECHA',
      //           'CARGA_ARCHIVO', 'CAMBIO_ESTADO', 'PROPUESTA_FECHA', 'RECHAZO_FECHA'
    },
    recurso: {
      type: String,
      // Ejemplos: 'procedimiento', 'etapa', 'entrega', 'usuario'
    },
    recursoId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    detalle: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ip: String,
    userAgent: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Sin timestamps de Mongoose — el campo timestamp es propio
    timestamps: false,
    versionKey: false,
  }
);

// Coleccion inmutable: no se actualiza ni se borra, solo se inserta
auditLogSchema.index({ usuario: 1, timestamp: -1 });
auditLogSchema.index({ recursoId: 1 });
auditLogSchema.index({ accion: 1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };
