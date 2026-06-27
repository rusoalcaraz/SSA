'use strict';

const mongoose = require('mongoose');

const subdireccionSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      unique: true,
      trim: true,
    },
    activa: {
      type: Boolean,
      default: true,
    },
    esAdquisiciones: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

subdireccionSchema.index({ activa: 1, nombre: 1 });

const Subdireccion = mongoose.model('Subdireccion', subdireccionSchema);

module.exports = { Subdireccion };
