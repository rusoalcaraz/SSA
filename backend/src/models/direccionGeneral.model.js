'use strict';

const mongoose = require('mongoose');

const direccionGeneralSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      unique: true,
      trim: true,
    },
    siglas: {
      type: String,
      required: [true, 'Las siglas son requeridas'],
      uppercase: true,
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
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

const DireccionGeneral = mongoose.model('DireccionGeneral', direccionGeneralSchema);

module.exports = { DireccionGeneral };
