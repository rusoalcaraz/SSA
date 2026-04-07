'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Usuario } = require('../models/usuario.model');

// Mapa en memoria para limitar escrituras a BD: userId -> timestamp de ultima actualizacion
const _actividadCache = new Map();
const THROTTLE_MS = 60_000; // escribe en BD como maximo una vez por minuto por usuario

const ROLES_VALIDOS = [
  'superadmin',
  'gerencial',
  'area_contratante',
  'asesor_tecnico',
  'dgt',
  'inspeccion',
];

/**
 * Extrae y verifica el access token JWT del encabezado Authorization.
 * Si el token es valido, agrega req.usuario con los datos del payload.
 */
function verifyToken(req, res, next) {
  const encabezado = req.headers['authorization'];

  if (!encabezado || !encabezado.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_REQUERIDO',
        message: 'Se requiere token de autenticacion',
      },
    });
  }

  const token = encabezado.slice(7);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRADO',
          message: 'El token de acceso ha expirado',
        },
      });
    }

    return res.status(401).json({
      success: false,
      error: {
        code: 'TOKEN_INVALIDO',
        message: 'Token de autenticacion invalido',
      },
    });
  }
}

/**
 * Verifica que el usuario autenticado tenga uno de los roles permitidos.
 * Debe usarse despues de verifyToken.
 *
 * @param {string[]} rolesPermitidos - Array de slugs de roles con acceso a la ruta.
 */
function checkRole(rolesPermitidos) {
  return function (req, res, next) {
    if (!req.usuario || !req.usuario.rol) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'SIN_ROL',
          message: 'No se pudo determinar el rol del usuario',
        },
      });
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCESO_DENEGADO',
          message: 'No tiene permisos para realizar esta accion',
        },
      });
    }

    next();
  };
}

/**
 * Actualiza el campo ultimaActividad del usuario autenticado en BD.
 * Usa un throttle en memoria para no escribir en cada solicitud.
 * Debe aplicarse despues de verifyToken en las rutas protegidas.
 */
function actualizarActividad(req, res, next) {
  const userId = req.usuario?.id;
  if (!userId) return next();

  const ahora = Date.now();
  const ultimaEscritura = _actividadCache.get(userId) || 0;

  if (ahora - ultimaEscritura > THROTTLE_MS) {
    _actividadCache.set(userId, ahora);
    // Fire and forget: no bloquea la respuesta
    Usuario.findByIdAndUpdate(userId, { ultimaActividad: new Date(ahora) })
      .catch(() => {}); // ignorar errores para no afectar el flujo
  }

  next();
}

module.exports = { verifyToken, checkRole, actualizarActividad, ROLES_VALIDOS };
