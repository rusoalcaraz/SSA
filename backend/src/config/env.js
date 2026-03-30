'use strict';

require('dotenv').config();

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 4000,

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ssa',

  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@institucion.gob.mx',

  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10,

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
};

// Verificar variables criticas al arranque
const requeridas = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const clave of requeridas) {
  if (!env[clave]) {
    throw new Error(`Variable de entorno requerida no definida: ${clave}`);
  }
}

module.exports = env;
