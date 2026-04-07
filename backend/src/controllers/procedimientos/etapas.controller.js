'use strict';

const { Procedimiento } = require('../../models/procedimiento.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok } = require('../../utils/respuesta');
const auditLog = require('../../services/auditLog.service');
const { esMiProcedimiento } = require('../../services/procedimiento.service');
const { notificarCambioFecha } = require('../../services/notificaciones.service');
const path = require('path');

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

async function obtenerProcedimientoYEtapa(procedimientoId, etapaId, seccion) {
  const procedimiento = await Procedimiento.findById(procedimientoId);
  if (!procedimiento) {
    throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
  }

  const lista = seccion === 'cronograma' ? procedimiento.cronograma : procedimiento.hojaDeTrabajoEtapas;
  const etapa = lista.id(etapaId);
  if (!etapa) {
    throw crearError(404, 'ETAPA_NO_ENCONTRADA', 'Etapa no encontrada en el procedimiento');
  }

  return { procedimiento, etapa, lista };
}

/**
 * Determina en que seccion (cronograma / hoja_de_trabajo) vive la etapa.
 * Busca en ambas y retorna la primera coincidencia.
 */
async function resolverSeccion(procedimientoId, etapaId) {
  const procedimiento = await Procedimiento.findById(procedimientoId);
  if (!procedimiento) {
    throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
  }

  let etapa = procedimiento.cronograma.id(etapaId);
  if (etapa) return { procedimiento, etapa, lista: procedimiento.cronograma, seccion: 'cronograma' };

  etapa = procedimiento.hojaDeTrabajoEtapas.id(etapaId);
  if (etapa) return { procedimiento, etapa, lista: procedimiento.hojaDeTrabajoEtapas, seccion: 'hoja_de_trabajo' };

  throw crearError(404, 'ETAPA_NO_ENCONTRADA', 'Etapa no encontrada en el procedimiento');
}

/**
 * Regla de flujo secuencial: la etapa obligatoria anterior (por orden) debe estar
 * completada o marcada como noAplica.
 */
function verificarSecuencia(lista, etapa) {
  const anterior = lista
    .filter((e) => e.orden < etapa.orden && e.obligatoria && !e.noAplica)
    .sort((a, b) => b.orden - a.orden)[0];

  if (anterior && anterior.estado !== 'completado') {
    throw crearError(
      409,
      'ETAPA_BLOQUEADA',
      `No se puede completar esta etapa sin completar primero "${anterior.nombre}"`
    );
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/completar  — solo AT
// -------------------------------------------------------
async function completar(req, res, next) {
  try {
    const { procedimiento, etapa, lista, seccion } = await resolverSeccion(
      req.params.id,
      req.params.etapaId
    );

    if (req.usuario.rol !== 'superadmin' && !esMiProcedimiento(procedimiento, req.usuario.id)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Solo el asesor tecnico asignado puede completar etapas');
    }

    if (etapa.estado === 'completado') {
      throw crearError(409, 'ETAPA_YA_COMPLETADA', 'La etapa ya fue completada');
    }

    verificarSecuencia(lista, etapa);

    etapa.estado = 'completado';
    etapa.fechaReal = new Date();
    etapa.completadoPor = req.usuario.id;
    etapa.completadoEn = new Date();

    await procedimiento.save();

    // Si se completó la última etapa del cronograma, avanzar a hoja de trabajo
    if (seccion === 'cronograma' && procedimiento.etapaActual === 'cronograma') {
      const todasTerminadas = procedimiento.cronograma.every(
        (e) => e.estado === 'completado' || e.noAplica
      );
      if (todasTerminadas) {
        procedimiento.etapaActual = 'hoja_de_trabajo';
        await procedimiento.save();
      }
    }

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'COMPLETAR_ETAPA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, nombreEtapa: etapa.nombre },
      req,
    });

    return ok(res, etapa, `Etapa "${etapa.nombre}" completada`);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/proponer-fecha  — AC
// -------------------------------------------------------
async function proponerFecha(req, res, next) {
  try {
    const { fechaPropuesta, motivo } = req.body;
    if (!fechaPropuesta) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'La fecha propuesta es requerida');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    if (etapa.estado === 'completado') {
      throw crearError(409, 'ETAPA_COMPLETADA', 'No se puede proponer fecha en una etapa ya completada');
    }

    const fechaAnterior = etapa.fechaPlaneada;
    etapa.fechaPlaneada = new Date(fechaPropuesta);
    etapa.fechaPropuesta = new Date(fechaPropuesta);
    etapa.estado = 'fecha_propuesta';
    etapa.motivoRechazo = undefined;

    etapa.historialFechas.push({
      fechaAnterior,
      fechaNueva: new Date(fechaPropuesta),
      accion: 'propuesta',
      realizadoPor: req.usuario.id,
      motivo,
    });

    await procedimiento.save();

    // Notificar al AT titular y suplente (sin await para no bloquear la respuesta)
    notificarCambioFecha(procedimiento, etapa, fechaPropuesta, motivo).catch((err) =>
      console.error('[Notificaciones] proponerFecha:', err.message)
    );

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'PROPUESTA_FECHA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, fechaAnterior, fechaNueva: fechaPropuesta },
      req,
    });

    return ok(res, etapa, 'Cambio de fecha propuesto. En espera de respuesta del asesor tecnico.');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/responder-fecha  — AT
// Acepta o rechaza la propuesta de fecha del AC.
// -------------------------------------------------------
async function responderFecha(req, res, next) {
  try {
    const { respuesta, motivoRechazo } = req.body;
    if (!['aceptar', 'rechazar'].includes(respuesta)) {
      throw crearError(400, 'RESPUESTA_INVALIDA', 'La respuesta debe ser "aceptar" o "rechazar"');
    }
    if (respuesta === 'rechazar' && !motivoRechazo) {
      throw crearError(400, 'MOTIVO_REQUERIDO', 'El motivo de rechazo es obligatorio');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    if (req.usuario.rol !== 'superadmin' && !esMiProcedimiento(procedimiento, req.usuario.id)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Solo el asesor tecnico asignado puede responder cambios de fecha');
    }

    if (etapa.estado !== 'fecha_propuesta') {
      throw crearError(409, 'SIN_PROPUESTA_PENDIENTE', 'No hay propuesta de fecha pendiente en esta etapa');
    }

    if (respuesta === 'aceptar') {
      etapa.estado = 'activo';
      etapa.motivoRechazo = undefined;
      etapa.historialFechas.push({
        fechaAnterior: null,
        fechaNueva: etapa.fechaPlaneada,
        accion: 'aceptada',
        realizadoPor: req.usuario.id,
      });
    } else {
      etapa.estado = 'fecha_rechazada';
      etapa.motivoRechazo = motivoRechazo;
      etapa.historialFechas.push({
        fechaAnterior: null,
        fechaNueva: etapa.fechaPlaneada,
        accion: 'rechazada',
        realizadoPor: req.usuario.id,
        motivo: motivoRechazo,
      });
    }

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: respuesta === 'aceptar' ? 'ACEPTAR_FECHA' : 'RECHAZAR_FECHA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, motivoRechazo },
      req,
    });

    const mensaje = respuesta === 'aceptar'
      ? 'Fecha aceptada correctamente'
      : 'Fecha rechazada. El area contratante fue notificada.';

    return ok(res, etapa, mensaje);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/sobreescribir-fecha  — AC
// Sobreescribe tras un rechazo del AT.
// -------------------------------------------------------
async function sobreescribirFecha(req, res, next) {
  try {
    const { fechaNueva, motivo } = req.body;
    if (!fechaNueva) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'La fecha nueva es requerida');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    if (etapa.estado !== 'fecha_rechazada') {
      throw crearError(409, 'ESTADO_INVALIDO', 'Solo se puede sobreescribir cuando la fecha fue rechazada');
    }

    const fechaAnterior = etapa.fechaPlaneada;
    etapa.fechaPlaneada = new Date(fechaNueva);
    etapa.fechaPropuesta = undefined;
    etapa.motivoRechazo = undefined;
    etapa.estado = 'activo';

    etapa.historialFechas.push({
      fechaAnterior,
      fechaNueva: new Date(fechaNueva),
      accion: 'sobreescrita',
      realizadoPor: req.usuario.id,
      motivo,
    });

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'SOBREESCRITURA_FECHA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, fechaAnterior, fechaNueva },
      req,
    });

    return ok(res, etapa, 'Fecha sobreescrita. La etapa quedo en estado activo.');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /:id/etapas/:etapaId/observacion  — AT, DGT
// -------------------------------------------------------
async function agregarObservacion(req, res, next) {
  try {
    const { texto } = req.body;
    if (!texto) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'El texto de la observacion es requerido');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    // Verificar acceso segun rol
    const { rol, id: usuarioId, dgId } = req.usuario;
    if (rol === 'asesor_tecnico' && !esMiProcedimiento(procedimiento, usuarioId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
    }
    if (rol === 'dgt' && !procedimiento.direccionGeneral.equals(dgId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Este procedimiento pertenece a otra Direccion General');
    }

    const archivos = req.files
      ? req.files.map((f) => ({ nombre: f.originalname, ruta: f.path }))
      : [];

    etapa.observaciones.push({
      texto,
      archivos,
      creadoPor: req.usuario.id,
    });

    await procedimiento.save();

    const observacionNueva = etapa.observaciones[etapa.observaciones.length - 1];
    return ok(res, observacionNueva, 'Observacion agregada');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /:id/etapas/:etapaId/archivo  — AT, DGT
// -------------------------------------------------------
async function subirArchivo(req, res, next) {
  try {
    if (!req.file) {
      throw crearError(400, 'ARCHIVO_REQUERIDO', 'Se requiere un archivo PDF');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    const { rol, id: usuarioId, dgId } = req.usuario;
    if (rol === 'asesor_tecnico' && !esMiProcedimiento(procedimiento, usuarioId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
    }
    if (rol === 'dgt' && !procedimiento.direccionGeneral.equals(dgId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Este procedimiento pertenece a otra Direccion General');
    }

    // Agregar como observacion con solo archivo adjunto
    etapa.observaciones.push({
      texto: req.body.descripcion || path.basename(req.file.originalname),
      archivos: [{ nombre: req.file.originalname, ruta: req.file.path }],
      creadoPor: req.usuario.id,
    });

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'CARGA_ARCHIVO',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, archivo: req.file.filename },
      req,
    });

    return ok(res, etapa.observaciones[etapa.observaciones.length - 1], 'Archivo subido correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/no-aplica  — AC / superadmin
// Marca o desmarca una etapa como "No aplica".
// -------------------------------------------------------
async function marcarNoAplica(req, res, next) {
  try {
    const { noAplica } = req.body;
    if (noAplica === undefined) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'El campo noAplica es requerido');
    }

    const { procedimiento, etapa, seccion } = await resolverSeccion(req.params.id, req.params.etapaId);

    if (etapa.estado === 'completado') {
      throw crearError(409, 'ETAPA_COMPLETADA', 'No se puede modificar una etapa ya completada');
    }

    etapa.noAplica = Boolean(noAplica);
    // Si se marca como no aplica, limpiar fecha planeada y estado asociado
    if (etapa.noAplica) {
      etapa.fechaPlaneada = undefined;
      etapa.fechaPropuesta = undefined;
      etapa.estado = 'pendiente';
    }

    await procedimiento.save();

    // Si todas las etapas del cronograma ya están terminadas o no aplican, avanzar
    if (seccion === 'cronograma' && procedimiento.etapaActual === 'cronograma') {
      const todasTerminadas = procedimiento.cronograma.every(
        (e) => e.estado === 'completado' || e.noAplica
      );
      if (todasTerminadas) {
        procedimiento.etapaActual = 'hoja_de_trabajo';
        await procedimiento.save();
      }
    }

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: noAplica ? 'ETAPA_NO_APLICA' : 'ETAPA_REACTIVAR',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, nombreEtapa: etapa.nombre },
      req,
    });

    return ok(res, etapa, noAplica ? `Etapa marcada como "No aplica"` : 'Etapa reactivada');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  completar,
  proponerFecha,
  responderFecha,
  sobreescribirFecha,
  agregarObservacion,
  subirArchivo,
  marcarNoAplica,
};
