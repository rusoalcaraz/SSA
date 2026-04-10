'use strict';

const { DireccionGeneral } = require('../../models/direccionGeneral.model');
const { Usuario } = require('../../models/usuario.model');
const { Procedimiento } = require('../../models/procedimiento.model');
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
    const { nombre, siglas, descripcion, tipo } = req.body;
    const dg = await DireccionGeneral.create({ nombre, siglas, descripcion, tipo });
    return creado(res, dg, 'Direccion General creada correctamente');
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, siglas, descripcion, tipo, activa } = req.body;
    const dg = await DireccionGeneral.findByIdAndUpdate(
      req.params.id,
      { nombre, siglas, descripcion, tipo, activa },
      { new: true, runValidators: true }
    );
    if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');
    return ok(res, dg, 'Direccion General actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const id = req.params.id;
    const hard = String(req.query.hard || '').toLowerCase() === 'true';

    if (hard) {
      const [usuariosCount, procedimientosCount] = await Promise.all([
        Usuario.countDocuments({ direccionGeneral: id }),
        Procedimiento.countDocuments({ direccionGeneral: id }),
      ]);
      if (usuariosCount > 0 || procedimientosCount > 0) {
        throw crearError(
          409,
          'DG_REFERENCIADA',
          'No se puede eliminar definitivamente: hay usuarios o procedimientos asociados'
        );
      }
      const eliminado = await DireccionGeneral.findByIdAndDelete(id);
      if (!eliminado) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');
      return ok(res, eliminado, 'Direccion General eliminada definitivamente');
    } else {
      const dg = await DireccionGeneral.findByIdAndUpdate(
        id,
        { activa: false },
        { new: true }
      );
      if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');
      return ok(res, dg, 'Direccion General desactivada');
    }
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
