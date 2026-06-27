'use strict';

const { Subdireccion } = require('../../models/subdireccion.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');

async function listar(req, res, next) {
  try {
    const { activa } = req.query;
    const filtro = {};
    if (activa !== undefined) filtro.activa = activa === 'true';

    const subdirecciones = await Subdireccion.find(filtro).sort({ nombre: 1 });
    return ok(res, subdirecciones, 'Subdirecciones obtenidas');
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const subdireccion = await Subdireccion.findById(req.params.id);
    if (!subdireccion) throw crearError(404, 'SUBDIRECCION_NO_ENCONTRADA', 'Subdireccion no encontrada');
    return ok(res, subdireccion);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre } = req.body;
    const subdireccion = await Subdireccion.create({ nombre });
    return creado(res, subdireccion, 'Subdireccion creada correctamente');
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, activa } = req.body;
    const subdireccion = await Subdireccion.findByIdAndUpdate(
      req.params.id,
      { nombre, activa },
      { new: true, runValidators: true }
    );
    if (!subdireccion) throw crearError(404, 'SUBDIRECCION_NO_ENCONTRADA', 'Subdireccion no encontrada');
    return ok(res, subdireccion, 'Subdireccion actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const subdireccion = await Subdireccion.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true }
    );
    if (!subdireccion) throw crearError(404, 'SUBDIRECCION_NO_ENCONTRADA', 'Subdireccion no encontrada');
    return ok(res, subdireccion, 'Subdireccion desactivada');
  } catch (error) {
    next(error);
  }
}

async function eliminar(req, res, next) {
  try {
    const subdireccion = await Subdireccion.findByIdAndDelete(req.params.id);
    if (!subdireccion) throw crearError(404, 'SUBDIRECCION_NO_ENCONTRADA', 'Subdireccion no encontrada');
    return ok(res, null, 'Subdireccion eliminada permanentemente');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar, eliminar };
