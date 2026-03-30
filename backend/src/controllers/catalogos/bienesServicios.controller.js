'use strict';

const { CatalogoBienesServicios } = require('../../models/catalogoBienesServicios.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');

async function listar(req, res, next) {
  try {
    const { tipo, activo, q } = req.query;
    const filtro = {};
    if (tipo) filtro.tipo = tipo;
    if (activo !== undefined) filtro.activo = activo === 'true';
    if (q) filtro.$or = [
      { clave: { $regex: q, $options: 'i' } },
      { descripcion: { $regex: q, $options: 'i' } },
    ];

    const items = await CatalogoBienesServicios.find(filtro).sort({ clave: 1 });
    return ok(res, items, 'Catalogo de bienes y servicios obtenido');
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const item = await CatalogoBienesServicios.findById(req.params.id);
    if (!item) throw crearError(404, 'BIEN_SERVICIO_NO_ENCONTRADO', 'Bien o servicio no encontrado');
    return ok(res, item);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { clave, descripcion, tipo, unidadMedida } = req.body;
    const item = await CatalogoBienesServicios.create({ clave, descripcion, tipo, unidadMedida });
    return creado(res, item, 'Bien o servicio creado correctamente');
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { clave, descripcion, tipo, unidadMedida, activo } = req.body;
    const item = await CatalogoBienesServicios.findByIdAndUpdate(
      req.params.id,
      { clave, descripcion, tipo, unidadMedida, activo },
      { new: true, runValidators: true }
    );
    if (!item) throw crearError(404, 'BIEN_SERVICIO_NO_ENCONTRADO', 'Bien o servicio no encontrado');
    return ok(res, item, 'Bien o servicio actualizado correctamente');
  } catch (error) {
    next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const item = await CatalogoBienesServicios.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );
    if (!item) throw crearError(404, 'BIEN_SERVICIO_NO_ENCONTRADO', 'Bien o servicio no encontrado');
    return ok(res, item, 'Bien o servicio desactivado');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
