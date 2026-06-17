'use strict';

const { Procedimiento } = require('../../models/procedimiento.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');
const auditLog = require('../../services/auditLog.service');
const {
  esMiProcedimiento,
  puedeGestionarProcedimiento,
  perteneceAlMismoOrganismo,
} = require('../../services/procedimiento.service');

// -------------------------------------------------------
// GET /api/v1/procedimientos/:id/entregas
// Roles: administrador, oficialia_mayor, dir_gral_admon, integrante_adquisiciones, asesor_tecnico
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
    if (rol === 'integrante_adquisiciones' && !perteneceAlMismoOrganismo(procedimiento, dgId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Este procedimiento pertenece a otro organismo');
    }

    return ok(res, procedimiento.entregas, 'Entregas obtenidas');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /api/v1/procedimientos/:id/entregas
// Roles: integrante_adquisiciones, administrador
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

    if (!puedeGestionarProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para modificar este procedimiento');
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
// Roles: integrante_adquisiciones, administrador
// -------------------------------------------------------
async function actualizar(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    if (!puedeGestionarProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para modificar este procedimiento');
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
// Roles: integrante_adquisiciones, administrador
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

    if (!puedeGestionarProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para modificar este procedimiento');
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

// -------------------------------------------------------
// PATCH /api/v1/procedimientos/:id/entregas/:entregaId/proponer-recibida
// Roles: asesor_tecnico
// El AT propone que la entrega fue recibida; queda en recibida_propuesta.
// -------------------------------------------------------
async function proponerRecibida(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    if (!esMiProcedimiento(procedimiento, req.usuario.id) && req.usuario.rol !== 'administrador') {
      throw crearError(403, 'ACCESO_DENEGADO', 'Solo el asesor tecnico asignado puede proponer entregas');
    }

    const entrega = procedimiento.entregas.id(req.params.entregaId);
    if (!entrega) {
      throw crearError(404, 'ENTREGA_NO_ENCONTRADA', 'Entrega no encontrada');
    }

    if (entrega.estado === 'recibida') {
      throw crearError(409, 'ENTREGA_YA_RECIBIDA', 'La entrega ya fue marcada como recibida');
    }

    if (entrega.estado === 'recibida_propuesta') {
      throw crearError(409, 'ENTREGA_PENDIENTE_VALIDACION', 'Ya se propuso la recepcion de esta entrega; espere la validacion');
    }

    entrega.estado = 'recibida_propuesta';
    entrega.propuestoPor = req.usuario.id;
    entrega.propuestoEn = new Date();

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'PROPONER_RECIBIDA_ENTREGA',
      recurso: 'entrega',
      recursoId: entrega._id,
      detalle: { procedimientoId: procedimiento._id },
      req,
    });

    return ok(res, entrega, 'Se propuso la recepcion de la entrega. Pendiente de validacion.');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /api/v1/procedimientos/:id/entregas/:entregaId/validar
// Roles: integrante_adquisiciones, administrador
// IA confirma o rechaza la propuesta del AT.
// -------------------------------------------------------
async function validarEntrega(req, res, next) {
  try {
    const { respuesta } = req.body;
    if (!['si', 'no'].includes(respuesta)) {
      throw crearError(400, 'RESPUESTA_INVALIDA', 'La respuesta debe ser "si" o "no"');
    }

    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    if (!puedeGestionarProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para validar entregas');
    }

    const entrega = procedimiento.entregas.id(req.params.entregaId);
    if (!entrega) {
      throw crearError(404, 'ENTREGA_NO_ENCONTRADA', 'Entrega no encontrada');
    }

    if (entrega.estado !== 'recibida_propuesta') {
      throw crearError(409, 'SIN_PROPUESTA_PENDIENTE', 'Esta entrega no tiene una propuesta de recepcion pendiente');
    }

    if (respuesta === 'si') {
      entrega.estado = 'recibida';
      entrega.fechaReal = new Date();
    } else {
      entrega.estado = 'pendiente';
    }

    entrega.propuestoPor = undefined;
    entrega.propuestoEn = undefined;

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: respuesta === 'si' ? 'VALIDAR_ENTREGA_SI' : 'VALIDAR_ENTREGA_NO',
      recurso: 'entrega',
      recursoId: entrega._id,
      detalle: { procedimientoId: procedimiento._id },
      req,
    });

    const mensaje = respuesta === 'si'
      ? 'Entrega validada y marcada como recibida'
      : 'Propuesta de recepcion rechazada';

    return ok(res, entrega, mensaje);
  } catch (error) {
    next(error);
  }
}

module.exports = { listar, crear, actualizar, subirDocumento, proponerRecibida, validarEntrega };
