'use strict';

const rateLimit = require('express-rate-limit');

function mensajeExcedido(codigo, mensaje) {
  return { success: false, error: { code: codigo, message: mensaje } };
}

/**
 * Rate limiter estricto para endpoints de autenticacion.
 * 10 solicitudes por IP cada 15 minutos.
 * Aplica a: POST /auth/login, POST /auth/refresh
 */
const limitarAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: mensajeExcedido(
    'LIMITE_AUTH_EXCEDIDO',
    'Demasiados intentos de autenticacion. Intente de nuevo en 15 minutos.'
  ),
});

/**
 * Rate limiter por usuario autenticado.
 * 300 solicitudes por user ID cada 15 minutos.
 * Aplica despues de verifyToken en todas las rutas protegidas.
 * Si no hay usuario autenticado, usa la IP como clave.
 */
const limitarPorUsuario = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.usuario?.id || req.ip,
  message: mensajeExcedido(
    'LIMITE_USUARIO_EXCEDIDO',
    'Ha excedido el limite de solicitudes permitidas. Intente de nuevo en 15 minutos.'
  ),
});

module.exports = { limitarAuth, limitarPorUsuario };
