'use strict';

const { Procedimiento } = require('../../models/procedimiento.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');
const auditLog = require('../../services/auditLog.service');
const { esMiProcedimiento } = require('../../services/procedimiento.service');

// -------------------------------------------------------
// GET /api/v1/procedimientos/:id/entregas
// Roles: area_contratante, inspeccion, gerencial, dgt, superadmin
// -------------------------------------------------------
async function listar(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id)
      .select('entregas direccionGeneral asesorTitular asesorSuplente etapaActual')
      .populate('entregas.registradoPor', 'nombre apellidos')
      .populate('entregas.documentos.cargadoPor', 'nombre apellidos');

    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    const { rol, id: usuarioId, dgId } = req.usuario;

    if (rol === 'asesor_tecnico' && !esMiProcedimiento(procedimiento, usuarioId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
    }
    if (rol === 'dgt' && !procedimiento.direccionGeneral.equals(dgId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Este procedimiento pertenece a otra Direccion General');
    }

    return ok(res, procedimiento.entregas, 'Entregas obtenidas');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /api/v1/procedimientos/:id/entregas
// Roles: area_contratante, superadmin
// -------------------------------------------------------
async function crear(req, res, next) {
  try {
    const { descripcion, tipo, fechaEstimada, observaciones } = req.body;

    if (!descripcion || !tipo) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'Descripcion y tipo de entrega son requeridos');
    }

    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    if (['concluido', 'cancelado'].includes(procedimiento.etapaActual)) {
      throw crearError(409, 'PROCEDIMIENTO_CERRADO', 'No se puede agregar entregas a un procedimiento cerrado');
    }

    procedimiento.entregas.push({
      descripcion,
      tipo,
      fechaEstimada: fechaEstimada ? new Date(fechaEstimada) : undefined,
      observaciones,
      registradoPor: req.usuario.id,
    });

    await procedimiento.save();

    const entregaNueva = procedimiento.entregas[procedimiento.entregas.length - 1];

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'CREAR_ENTREGA',
      recurso: 'entrega',
      recursoId: entregaNueva._id,
      detalle: { procedimientoId: procedimiento._id, tipo },
      req,
    });

    return creado(res, entregaNueva, 'Entrega registrada correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/procedimientos/:id/entregas/:entregaId
// Roles: area_contratante, superadmin
// -------------------------------------------------------
async function actualizar(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    const entrega = procedimiento.entregas.id(req.params.entregaId);
    if (!entrega) {
      throw crearError(404, 'ENTREGA_NO_ENCONTRADA', 'Entrega no encontrada');
    }

    const { descripcion, tipo, fechaEstimada, fechaReal, estado, observaciones } = req.body;
    if (descripcion !== undefined) entrega.descripcion = descripcion;
    if (tipo !== undefined) entrega.tipo = tipo;
    if (fechaEstimada !== undefined) entrega.fechaEstimada = new Date(fechaEstimada);
    if (fechaReal !== undefined) entrega.fechaReal = new Date(fechaReal);
    if (estado !== undefined) entrega.estado = estado;
    if (observaciones !== undefined) entrega.observaciones = observaciones;

    await procedimiento.save();

    return ok(res, entrega, 'Entrega actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /api/v1/procedimientos/:id/entregas/:entregaId/documento
// Roles: inspeccion, superadmin
// -------------------------------------------------------
async function subirDocumento(req, res, next) {
  try {
    if (!req.file) {
      throw crearError(400, 'ARCHIVO_REQUERIDO', 'Se requiere un archivo PDF');
    }

    const { tipo } = req.body;
    if (!tipo) {
      throw crearError(400, 'TIPO_REQUERIDO', 'El tipo de documento es requerido (constancia_recepcion, hoja_aceptacion, otro)');
    }

    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    const entrega = procedimiento.entregas.id(req.params.entregaId);
    if (!entrega) {
      throw crearError(404, 'ENTREGA_NO_ENCONTRADA', 'Entrega no encontrada');
    }

    entrega.documentos.push({
      tipo,
      nombre: req.file.originalname,
      ruta: req.file.path,
      cargadoPor: req.usuario.id,
    });

    await procedimiento.save();

    const docNuevo = entrega.documentos[entrega.documentos.length - 1];

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'CARGA_ARCHIVO',
      recurso: 'entrega',
      recursoId: entrega._id,
      detalle: { procedimientoId: procedimiento._id, tipo, archivo: req.file.filename },
      req,
    });

    return ok(res, docNuevo, 'Documento de entrega subido correctamente');
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, crear, actualizar, subirDocumento };
