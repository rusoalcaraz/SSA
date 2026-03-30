'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

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

module.exports = { verifyToken, checkRole, ROLES_VALIDOS };
