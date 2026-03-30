'use strict';

const { AuditLog } = require('../models/auditLog.model');

/**
 * Registra una accion sensible en la coleccion de auditoria.
 * No lanza error si falla — el fallo de auditoria no debe interrumpir la operacion principal.
 *
 * @param {object} datos
 * @param {string|ObjectId} datos.usuarioId
 * @param {string} datos.accion - Clave de la accion, ej: 'LOGIN', 'CAMBIO_PASSWORD'
 * @param {string} [datos.recurso] - Nombre de la coleccion afectada
 * @param {string|ObjectId} [datos.recursoId]
 * @param {object} [datos.detalle] - Contexto adicional libre
 * @param {object} [datos.req] - Request de Express para extraer ip y userAgent
 */
async function registrar({ usuarioId, accion, recurso, recursoId, detalle = {}, req }) {
  try {
    const entrada = {
      usuario: usuarioId,
      accion,
      recurso,
      recursoId,
      detalle,
    };

    if (req) {
      entrada.ip = req.ip || req.connection?.remoteAddress;
      entrada.userAgent = req.headers?.['user-agent'];
    }

    await AuditLog.create(entrada);
  } catch (err) {
    // El fallo de auditoria se loguea pero no se propaga
    console.error('[AuditLog] Error al registrar accion:', accion, err.message);
  }
}

module.exports = { registrar };
