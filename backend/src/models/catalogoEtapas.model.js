'use strict';

const mongoose = require('mongoose');

const TIPOS_PROCEDIMIENTO = [
  'licitacion_publica_nacional',
  'licitacion_publica_internacional_libre',
  'licitacion_publica_internacional_tratados',
  'invitacion_tres_personas',
  'adjudicacion_directa',
];

const catalogoEtapasSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
    },
    tipo: {
      type: String,
      enum: {
        values: ['cronograma', 'hoja_de_trabajo'],
        message: 'Tipo no valido: {VALUE}',
      },
      required: [true, 'El tipo de etapa es requerido'],
    },
    obligatoria: {
      type: Boolean,
      default: true,
    },
    // Tipos de procedimiento a los que aplica esta etapa
    aplicaA: [
      {
        type: String,
        enum: {
          values: TIPOS_PROCEDIMIENTO,
          message: 'Tipo de procedimiento no valido: {VALUE}',
        },
      },
    ],
    orden: {
      type: Number,
      required: [true, 'El orden es requerido'],
    },
    // Dias de anticipacion para alerta en procedimientos urgentes
    diasAlertaUrgente: {
      type: Number,
      min: [1, 'diasAlertaUrgente debe ser mayor a 0'],
    },
    activa: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Orden unico dentro de cada tipo de etapa
catalogoEtapasSchema.index({ tipo: 1, orden: 1 }, { unique: true });

const CatalogoEtapas = mongoose.model('CatalogoEtapas', catalogoEtapasSchema);

module.exports = { CatalogoEtapas, TIPOS_PROCEDIMIENTO };
