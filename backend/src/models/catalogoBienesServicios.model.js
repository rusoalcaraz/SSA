'use strict';

const mongoose = require('mongoose');

const catalogoBienesServiciosSchema = new mongoose.Schema(
  {
    clave: {
      type: String,
      required: [true, 'La clave es requerida'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    descripcion: {
      type: String,
      required: [true, 'La descripcion es requerida'],
      trim: true,
    },
    tipo: {
      type: String,
      enum: {
        values: ['bien', 'servicio', 'bien_y_servicio'],
        message: 'Tipo no valido: {VALUE}',
      },
      required: [true, 'El tipo es requerido'],
    },
    unidadMedida: {
      type: String,
      trim: true,
      // Ejemplos: 'pieza', 'servicio', 'mes', 'litro', 'kilogramo'
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

const CatalogoBienesServicios = mongoose.model(
  'CatalogoBienesServicios',
  catalogoBienesServiciosSchema
);

module.exports = { CatalogoBienesServicios };
