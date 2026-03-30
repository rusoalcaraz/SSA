'use strict';

const env = require('../config/env');

/**
 * Middleware global de manejo de errores.
 * Debe registrarse al final de la cadena de middleware en app.js.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Errores de validacion de Mongoose
  if (err.name === 'ValidationError') {
    const mensajes = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDACION_FALLIDA',
        message: mensajes.join('. '),
      },
    });
  }

  // Documento duplicado en MongoDB
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'campo';
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICADO',
        message: `Ya existe un registro con ese valor en el campo: ${campo}`,
      },
    });
  }

  // CastError de Mongoose (ID mal formado)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'ID_INVALIDO',
        message: 'El identificador proporcionado no es valido',
      },
    });
  }

  // Error con codigo HTTP propio (lanzado desde controladores)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'ERROR',
        message: err.message,
      },
    });
  }

  // Error generico — no exponer detalles en produccion
  const esProduccion = env.NODE_ENV === 'production';
  console.error('[ErrorHandler]', err);

  return res.status(500).json({
    success: false,
    error: {
      code: 'ERROR_INTERNO',
      message: esProduccion ? 'Error interno del servidor' : err.message,
    },
  });
}

/**
 * Crea un error HTTP con codigo y statusCode personalizados.
 * Uso: throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
 */
function crearError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

module.exports = { errorHandler, crearError };
