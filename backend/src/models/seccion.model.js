'use strict';

const mongoose = require('mongoose');

const seccionSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    subdireccion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subdireccion',
      required: [true, 'La subdireccion es requerida'],
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

seccionSchema.index({ subdireccion: 1, nombre: 1 }, { unique: true });
seccionSchema.index({ activa: 1, subdireccion: 1 });

const Seccion = mongoose.model('Seccion', seccionSchema);

module.exports = { Seccion };
