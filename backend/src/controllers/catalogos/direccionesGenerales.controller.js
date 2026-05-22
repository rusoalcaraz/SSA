'use strict';

const { DireccionGeneral } = require('../../models/direccionGeneral.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');

async function listar(req, res, next) {
  try {
    const { activa } = req.query;
    const filtro = {};
    if (activa !== undefined) filtro.activa = activa === 'true';

    const dgs = await DireccionGeneral.find(filtro).sort({ nombre: 1 });
    return ok(res, dgs, 'Direcciones generales obtenidas');
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const dg = await DireccionGeneral.findById(req.params.id);
    if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');
    return ok(res, dg);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, siglas, descripcion } = req.body;
    const dg = await DireccionGeneral.create({ nombre, siglas, descripcion });
    return creado(res, dg, 'Direccion General creada correctamente');
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, siglas, descripcion, activa } = req.body;
    const dg = await DireccionGeneral.findByIdAndUpdate(
      req.params.id,
      { nombre, siglas, descripcion, activa },
      { new: true, runValidators: true }
    );
    if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');
    return ok(res, dg, 'Direccion General actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

// Baja logica — no se elimina fisicamente para mantener integridad referencial
async function desactivar(req, res, next) {
  try {
    const dg = await DireccionGeneral.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true }
    );
    if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');
    return ok(res, dg, 'Direccion General desactivada');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
