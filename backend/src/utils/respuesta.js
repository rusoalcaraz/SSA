'use strict';

/**
 * Respuesta exitosa estandar.
 *
 * @param {object} res - Objeto response de Express.
 * @param {*} data - Datos a retornar.
 * @param {string} [message=''] - Descripcion de la operacion.
 * @param {number} [status=200] - Codigo HTTP.
 * @param {object|null} [pagination=null] - Metadatos de paginacion opcionales.
 */
function ok(res, data, message = '', status = 200, pagination = null) {
  const cuerpo = { success: true, data, message };
  if (pagination) cuerpo.pagination = pagination;
  return res.status(status).json(cuerpo);
}

/**
 * Respuesta de creacion exitosa (201).
 */
function creado(res, data, message = 'Recurso creado correctamente') {
  return ok(res, data, message, 201);
}

/**
 * Respuesta de error estandar.
 *
 * @param {object} res - Objeto response de Express.
 * @param {number} status - Codigo HTTP.
 * @param {string} code - Codigo de error interno (ej: 'PROCEDIMIENTO_NO_ENCONTRADO').
 * @param {string} message - Descripcion del error.
 */
function error(res, status, code, message) {
  return res.status(status).json({
    success: false,
    error: { code, message },
  });
}

module.exports = { ok, creado, error };
