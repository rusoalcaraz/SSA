'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const ROLES = [
  'superadmin',
  'gerencial',
  'area_contratante',
  'asesor_tecnico',
  'dgt',
  'inspeccion',
];

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es requerido'],
      trim: true,
    },
    apellidos: {
      type: String,
      required: [true, 'Los apellidos son requeridos'],
      trim: true,
    },
    correo: {
      type: String,
      required: [true, 'El correo es requerido'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'La contrasena es requerida'],
      select: false, // no se incluye en queries por defecto
    },
    rol: {
      type: String,
      enum: { values: ROLES, message: 'Rol no valido: {VALUE}' },
      required: [true, 'El rol es requerido'],
    },
    // Solo para rol 'dgt': referencia a la DG a la que pertenece
    direccionGeneral: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DireccionGeneral',
      default: null,
    },
    activo: {
      type: Boolean,
      default: true,
    },
    // Array de refresh tokens para soporte multi-dispositivo
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
    // Seguimiento de actividad para timeout de inactividad (15 min)
    ultimaActividad: {
      type: Date,
      default: null,
    },
    // Control de intentos fallidos de inicio de sesion (bloqueo por fuerza bruta)
    intentosFallidos: {
      type: Number,
      default: 0,
      select: false,
    },
    bloqueadoHasta: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// --- Validacion: direccionGeneral obligatoria para rol 'dgt' ---
usuarioSchema.pre('validate', function (next) {
  if (this.rol === 'dgt' && !this.direccionGeneral) {
    this.invalidate(
      'direccionGeneral',
      'La Direccion General es obligatoria para el rol dgt'
    );
  }
  next();
});

// --- Hash de contrasena antes de guardar ---
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, SALT_ROUNDS);
  next();
});

// --- Metodo de instancia: verificar contrasena ---
usuarioSchema.methods.verificarContrasena = function (contrasenaPlana) {
  return bcrypt.compare(contrasenaPlana, this.passwordHash);
};

// --- Metodo de instancia: nombre completo ---
usuarioSchema.virtual('nombreCompleto').get(function () {
  return `${this.nombre} ${this.apellidos}`;
});

// --- Indices (correo ya tiene unique:true en la definicion del campo) ---
usuarioSchema.index({ rol: 1 });
usuarioSchema.index({ direccionGeneral: 1 });

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = { Usuario, ROLES };
