'use strict';

const { CatalogoEtapas } = require('../../models/catalogoEtapas.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');

async function listar(req, res, next) {
  try {
    const { tipo, activa, aplicaA } = req.query;
    const filtro = {};
    if (tipo) filtro.tipo = tipo;
    if (activa !== undefined) filtro.activa = activa === 'true';
    if (aplicaA) filtro.aplicaA = aplicaA;

    const etapas = await CatalogoEtapas.find(filtro).sort({ tipo: 1, orden: 1 });
    return ok(res, etapas, 'Catalogo de etapas obtenido');
  } catch (error) {
    next(error);
  }
}

async function obtener(req, res, next) {
  try {
    const etapa = await CatalogoEtapas.findById(req.params.id);
    if (!etapa) throw crearError(404, 'ETAPA_NO_ENCONTRADA', 'Etapa no encontrada');
    return ok(res, etapa);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, descripcion, tipo, obligatoria, aplicaA, orden, diasAlertaUrgente } = req.body;
    const etapa = await CatalogoEtapas.create({
      nombre,
      descripcion,
      tipo,
      obligatoria,
      aplicaA,
      orden,
      diasAlertaUrgente,
    });
    return creado(res, etapa, 'Etapa creada correctamente');
  } catch (error) {
    next(error);
  }
}

async function actualizar(req, res, next) {
  try {
    const { nombre, descripcion, tipo, obligatoria, aplicaA, orden, diasAlertaUrgente, activa } =
      req.body;
    const etapa = await CatalogoEtapas.findByIdAndUpdate(
      req.params.id,
      { nombre, descripcion, tipo, obligatoria, aplicaA, orden, diasAlertaUrgente, activa },
      { new: true, runValidators: true }
    );
    if (!etapa) throw crearError(404, 'ETAPA_NO_ENCONTRADA', 'Etapa no encontrada');
    return ok(res, etapa, 'Etapa actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

async function desactivar(req, res, next) {
  try {
    const etapa = await CatalogoEtapas.findByIdAndUpdate(
      req.params.id,
      { activa: false },
      { new: true }
    );
    if (!etapa) throw crearError(404, 'ETAPA_NO_ENCONTRADA', 'Etapa no encontrada');
    return ok(res, etapa, 'Etapa desactivada');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, obtener, crear, actualizar, desactivar };
