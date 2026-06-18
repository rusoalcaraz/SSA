'use strict';

const { Seccion } = require('../../models/seccion.model');
const { Subdireccion } = require('../../models/subdireccion.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');

function esAdmin(usuario) {
  return usuario?.rol === 'administrador';
}

function esSubdirector(usuario) {
  return usuario?.rol === 'subdirector';
}

function obtenerSubdireccionSolicitante(usuario) {
  if (!usuario?.subdireccionId) {
    throw crearError(400, 'SUBDIRECCION_NO_ASIGNADA', 'El usuario no tiene subdireccion asignada');
  }
  return String(usuario.subdireccionId);
}

async function listar(req, res, next) {
  try {
    const { activa, subdireccionId } = req.query;
    const filtro = {};

    if (activa !== undefined) filtro.activa = activa === 'true';

    if (esSubdirector(req.usuario)) {
      const propia = obtenerSubdireccionSolicitante(req.usuario);
      if (subdireccionId && String(subdireccionId) !== propia) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar secciones de su subdireccion');
      }
      filtro.subdireccion = propia;
    } else if (req.usuario?.rol === 'jefe_seccion' || req.usuario?.rol === 'asesor_tecnico') {
      if (!req.usuario?.seccionId) {
        throw crearError(400, 'SECCION_NO_ASIGNADA', 'El usuario no tiene seccion asignada');
      }
      filtro._id = req.usuario.seccionId;
    } else if (subdireccionId) {
      filtro.subdireccion = subdireccionId;
    }

    const secciones = await Seccion.find(filtro)
      .populate('subdireccion', 'nombre')
      .sort({ nombre: 1 });
    return ok(res, secciones, 'Secciones obtenidas');
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const seccion = await Seccion.findById(req.params.id).populate('subdireccion', 'nombre');
    if (!seccion) throw crearError(404, 'SECCION_NO_ENCONTRADA', 'Seccion no encontrada');

    if (esSubdirector(req.usuario)) {
      const propia = obtenerSubdireccionSolicitante(req.usuario);
      if (String(seccion.subdireccion?._id || seccion.subdireccion) !== propia) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar secciones de su subdireccion');
      }
    } else if (req.usuario?.rol === 'jefe_seccion' || req.usuario?.rol === 'asesor_tecnico') {
      if (!req.usuario?.seccionId || String(req.usuario.seccionId) !== String(seccion._id)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar su propia seccion');
      }
    }

    return ok(res, seccion);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, subdireccion } = req.body;
    if (!nombre || !subdireccion) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'nombre y subdireccion son requeridos');
    }

    if (esSubdirector(req.usuario)) {
      const propia = obtenerSubdireccionSolicitante(req.usuario);
      if (String(subdireccion) !== propia) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede crear secciones dentro de su subdireccion');
      }
    }

    const existeSub = await Subdireccion.exists({ _id: subdireccion, activa: true });
    if (!existeSub) throw crearError(404, 'SUBDIRECCION_NO_ENCONTRADA', 'Subdireccion no encontrada o inactiva');

    const seccionCreada = await Seccion.create({ nombre, subdireccion });
    const seccionPop = await Seccion.findById(seccionCreada._id).populate('subdireccion', 'nombre');

    return creado(res, seccionPop, 'Seccion creada correctamente');
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, activa } = req.body;
    const seccion = await Seccion.findById(req.params.id);
    if (!seccion) throw crearError(404, 'SECCION_NO_ENCONTRADA', 'Seccion no encontrada');

    if (esSubdirector(req.usuario)) {
      const propia = obtenerSubdireccionSolicitante(req.usuario);
      if (String(seccion.subdireccion) !== propia) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede actualizar secciones de su subdireccion');
      }
    } else if (!esAdmin(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para actualizar secciones');
    }

    if (nombre !== undefined) seccion.nombre = nombre;
    if (activa !== undefined) seccion.activa = activa;

    await seccion.save();
    const seccionPop = await Seccion.findById(seccion._id).populate('subdireccion', 'nombre');
    return ok(res, seccionPop, 'Seccion actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const seccion = await Seccion.findById(req.params.id);
    if (!seccion) throw crearError(404, 'SECCION_NO_ENCONTRADA', 'Seccion no encontrada');

    if (esSubdirector(req.usuario)) {
      const propia = obtenerSubdireccionSolicitante(req.usuario);
      if (String(seccion.subdireccion) !== propia) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede desactivar secciones de su subdireccion');
      }
    } else if (!esAdmin(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para desactivar secciones');
    }

    seccion.activa = false;
    await seccion.save();
    return ok(res, seccion, 'Seccion desactivada');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
