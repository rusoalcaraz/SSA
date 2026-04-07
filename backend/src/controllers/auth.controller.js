'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { Usuario } = require('../models/usuario.model');
const auditLog = require('../services/auditLog.service');
const { crearError } = require('../middleware/errorHandler');
const { ok } = require('../utils/respuesta');

// --- Helpers de tokens ---

function generarAccessToken(usuario) {
  return jwt.sign(
    {
      id: usuario._id,
      rol: usuario.rol,
      dgId: usuario.direccionGeneral || null,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function generarRefreshToken(usuarioId) {
  return jwt.sign(
    { id: usuarioId },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

const OPCIONES_COOKIE = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias en ms
};

// --- Constantes de seguridad ---
const MAX_INTENTOS_LOGIN = 5;          // intentos fallidos antes de bloquear
const BLOQUEO_MS = 15 * 60 * 1000;    // duracion del bloqueo: 15 minutos
const INACTIVIDAD_MS = 15 * 60 * 1000; // timeout de inactividad: 15 minutos

// --- Controladores ---

/**
 * POST /api/v1/auth/login
 */
async function login(req, res, next) {
  try {
    const { correo, contrasena } = req.body;

    if (!correo || !contrasena) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'Correo y contrasena son requeridos');
    }

    // Incluir passwordHash, refreshTokens, intentosFallidos y bloqueadoHasta
    const usuario = await Usuario
      .findOne({ correo: correo.toLowerCase().trim(), activo: true })
      .select('+passwordHash +refreshTokens +intentosFallidos +bloqueadoHasta');

    // Mensaje generico para no revelar si el correo existe
    const errorCredenciales = crearError(
      401,
      'CREDENCIALES_INVALIDAS',
      'Correo o contrasena incorrectos'
    );

    if (!usuario) throw errorCredenciales;

    // Verificar si la cuenta esta temporalmente bloqueada
    if (usuario.bloqueadoHasta && usuario.bloqueadoHasta > new Date()) {
      const minutosRestantes = Math.ceil(
        (usuario.bloqueadoHasta.getTime() - Date.now()) / 60_000
      );
      throw crearError(
        429,
        'CUENTA_BLOQUEADA',
        `Cuenta bloqueada temporalmente por multiples intentos fallidos. Intente en ${minutosRestantes} minuto(s).`
      );
    }

    const contrasenaValida = await usuario.verificarContrasena(contrasena);

    if (!contrasenaValida) {
      // Incrementar contador de intentos fallidos
      usuario.intentosFallidos = (usuario.intentosFallidos || 0) + 1;

      if (usuario.intentosFallidos >= MAX_INTENTOS_LOGIN) {
        usuario.bloqueadoHasta = new Date(Date.now() + BLOQUEO_MS);
        usuario.intentosFallidos = 0;
        await usuario.save();
        throw crearError(
          429,
          'CUENTA_BLOQUEADA',
          `Cuenta bloqueada por ${MAX_INTENTOS_LOGIN} intentos fallidos. Intente en 15 minutos.`
        );
      }

      await usuario.save();
      throw errorCredenciales;
    }

    // Login exitoso: resetear intentos fallidos
    usuario.intentosFallidos = 0;
    usuario.bloqueadoHasta = null;
    usuario.ultimaActividad = new Date();

    const accessToken = generarAccessToken(usuario);
    const refreshToken = generarRefreshToken(usuario._id);

    // Guardar refresh token (soporte multi-dispositivo)
    usuario.refreshTokens.push(refreshToken);
    await usuario.save();

    await auditLog.registrar({
      usuarioId: usuario._id,
      accion: 'LOGIN',
      recurso: 'usuario',
      recursoId: usuario._id,
      req,
    });

    res.cookie('refreshToken', refreshToken, OPCIONES_COOKIE);

    return ok(res, {
      accessToken,
      usuario: {
        id: usuario._id,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        correo: usuario.correo,
        rol: usuario.rol,
        direccionGeneral: usuario.direccionGeneral,
      },
    }, 'Sesion iniciada correctamente');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/logout
 */
async function logout(req, res, next) {
  try {
    const tokenCookie = req.cookies?.refreshToken;

    if (tokenCookie) {
      // Eliminar solo el refresh token de este dispositivo
      const usuario = await Usuario
        .findById(req.usuario.id)
        .select('+refreshTokens');

      if (usuario) {
        usuario.refreshTokens = usuario.refreshTokens.filter(
          (t) => t !== tokenCookie
        );
        await usuario.save();
      }
    }

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'LOGOUT',
      recurso: 'usuario',
      recursoId: req.usuario.id,
      req,
    });

    res.clearCookie('refreshToken');
    return ok(res, null, 'Sesion cerrada correctamente');
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Renueva el access token usando el refresh token de la cookie.
 */
async function refresh(req, res, next) {
  try {
    const tokenCookie = req.cookies?.refreshToken;

    if (!tokenCookie) {
      throw crearError(401, 'REFRESH_REQUERIDO', 'No se encontro el refresh token');
    }

    let payload;
    try {
      payload = jwt.verify(tokenCookie, env.JWT_REFRESH_SECRET);
    } catch {
      throw crearError(401, 'REFRESH_INVALIDO', 'Refresh token invalido o expirado');
    }

    const usuario = await Usuario
      .findById(payload.id)
      .select('+refreshTokens');

    if (!usuario || !usuario.activo) {
      throw crearError(401, 'USUARIO_INACTIVO', 'Usuario no encontrado o inactivo');
    }

    // Verificar que el token pertenezca a este usuario (defensa contra robo)
    if (!usuario.refreshTokens.includes(tokenCookie)) {
      // Token valido pero no registrado: posible robo — invalidar todos
      usuario.refreshTokens = [];
      await usuario.save();
      throw crearError(401, 'REFRESH_REVOCADO', 'Refresh token revocado');
    }

    // Verificar inactividad: si el usuario no ha interactuado en 15 min, cerrar sesion
    if (usuario.ultimaActividad) {
      const inactivo = Date.now() - usuario.ultimaActividad.getTime() > INACTIVIDAD_MS;
      if (inactivo) {
        usuario.refreshTokens = [];
        await usuario.save();
        res.clearCookie('refreshToken');
        throw crearError(
          401,
          'SESION_INACTIVA',
          'La sesion expiro por inactividad. Inicie sesion nuevamente.'
        );
      }
    }

    const nuevoAccessToken = generarAccessToken(usuario);

    return ok(res, { accessToken: nuevoAccessToken }, 'Token renovado correctamente');
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/v1/auth/cambiar-password
 */
async function cambiarPassword(req, res, next) {
  try {
    const { contrasenaActual, contrasenaNueva } = req.body;

    if (!contrasenaActual || !contrasenaNueva) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'Se requieren contrasena actual y nueva');
    }

    if (contrasenaNueva.length < 8) {
      throw crearError(400, 'CONTRASENA_CORTA', 'La contrasena nueva debe tener al menos 8 caracteres');
    }

    if (contrasenaActual === contrasenaNueva) {
      throw crearError(400, 'CONTRASENA_IGUAL', 'La contrasena nueva debe ser diferente a la actual');
    }

    const usuario = await Usuario
      .findById(req.usuario.id)
      .select('+passwordHash +refreshTokens');

    if (!usuario || !usuario.activo) {
      throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');
    }

    const contrasenaValida = await usuario.verificarContrasena(contrasenaActual);
    if (!contrasenaValida) {
      throw crearError(401, 'CONTRASENA_INCORRECTA', 'La contrasena actual es incorrecta');
    }

    // Asignar la nueva contrasena en texto plano — el pre-save la hashea
    usuario.passwordHash = contrasenaNueva;
    // Invalidar todos los refresh tokens (forzar re-login en todos los dispositivos)
    usuario.refreshTokens = [];
    await usuario.save();

    await auditLog.registrar({
      usuarioId: usuario._id,
      accion: 'CAMBIO_PASSWORD',
      recurso: 'usuario',
      recursoId: usuario._id,
      req,
    });

    res.clearCookie('refreshToken');
    return ok(res, null, 'Contrasena actualizada correctamente. Inicie sesion nuevamente.');
  } catch (error) {
    next(error);
  }
}

module.exports = { login, logout, refresh, cambiarPassword };
