'use strict';

const { Procedimiento } = require('../../models/procedimiento.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok } = require('../../utils/respuesta');
const auditLog = require('../../services/auditLog.service');
const {
  esMiProcedimiento,
  puedeVerProcedimiento,
  puedeGestionarProcedimiento,
} = require('../../services/procedimiento.service');
const { notificarCambioFecha } = require('../../services/notificaciones.service');
const path = require('path');
const PDFDocument = require('pdfkit');

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

function crearRegistroEvidencia(file, usuarioId) {
  return {
    nombre: file.originalname,
    ruta: file.path,
    mimeType: file.mimetype,
    cargadoPor: usuarioId,
    validacionEstado: 'pendiente',
  };
}

function nombreUsuario(usuario) {
  if (!usuario) return 'Sin dato';
  return [usuario.nombre, usuario.apellidos].filter(Boolean).join(' ');
}

function fechaHora(valor) {
  if (!valor) return 'Sin fecha';
  return new Date(valor).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function colorActividad(accion) {
  if (accion.startsWith('Validación')) return '#15803d';
  if (accion.startsWith('Rechazo')) return '#b91c1c';
  if (
    accion.startsWith('Carga') ||
    accion.startsWith('Reemplazo') ||
    accion.startsWith('Propuesta')
  ) {
    return '#1d4ed8';
  }
  return '#334155';
}

function estiloActividad(accion) {
  if (accion.startsWith('Validación')) {
    return { color: '#15803d', fill: '#ecfdf5', stroke: '#86efac', badge: 'Validación' };
  }
  if (accion.startsWith('Rechazo')) {
    return { color: '#b91c1c', fill: '#fff1f2', stroke: '#fda4af', badge: 'Rechazo' };
  }
  if (
    accion.startsWith('Carga') ||
    accion.startsWith('Reemplazo') ||
    accion.startsWith('Propuesta')
  ) {
    return { color: '#1d4ed8', fill: '#eff6ff', stroke: '#93c5fd', badge: 'Seguimiento' };
  }
  return { color: '#334155', fill: '#f8fafc', stroke: '#cbd5e1', badge: 'Registro' };
}

function asegurarEspacio(doc, altoNecesario) {
  const limite = doc.page.height - doc.page.margins.bottom;
  if (doc.y + altoNecesario > limite) {
    doc.addPage();
  }
}

function dibujarTarjeta(doc, x, y, width, height, { fill, stroke, radius = 14 }) {
  doc
    .save()
    .lineWidth(1)
    .roundedRect(x, y, width, height, radius)
    .fillAndStroke(fill, stroke)
    .restore();
}

function dibujarKpi(doc, x, y, width, height, { label, value, accent, fill }) {
  dibujarTarjeta(doc, x, y, width, height, { fill, stroke: fill });
  doc
    .save()
    .roundedRect(x, y, 6, height, 6)
    .fill(accent)
    .restore();

  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label.toUpperCase(), x + 16, y + 12, { width: width - 28 });

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(String(value), x + 16, y + 28, { width: width - 28 });
}

function dibujarDato(doc, x, y, width, height, { label, value, fill = '#ffffff', stroke = '#e2e8f0' }) {
  dibujarTarjeta(doc, x, y, width, height, { fill, stroke, radius: 12 });

  doc
    .fillColor('#94a3b8')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label.toUpperCase(), x + 14, y + 12, { width: width - 28 });

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(value || '—', x + 14, y + 28, { width: width - 28 });
}

function calcularAlturaDato(doc, width, value) {
  doc.font('Helvetica-Bold').fontSize(13);
  const valueH = doc.heightOfString(value || '—', { width: width - 28 });
  return Math.max(64, 28 + valueH + 14);
}

function tieneEvidenciaBloqueante(etapa) {
  if (!Array.isArray(etapa.evidencias) || etapa.evidencias.length === 0) return false;
  return etapa.evidencias.some((evidencia) => {
    const fueReemplazada = etapa.evidencias.some(
      (candidata) => String(candidata.reemplazaEvidenciaId || '') === String(evidencia._id)
    );
    return !fueReemplazada && evidencia.validacionEstado !== 'validada';
  });
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/completar  — solo AT
// Propone la conclusion; queda en "completado_propuesto" hasta que IA valide.
// -------------------------------------------------------
async function completar(req, res, next) {
  try {
    const { procedimiento, etapa, lista } = await resolverSeccion(
      req.params.id,
      req.params.etapaId
    );

    if (req.usuario.rol !== 'administrador' && !esMiProcedimiento(procedimiento, req.usuario.id)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Solo el asesor tecnico asignado puede completar etapas');
    }

    if (etapa.estado === 'completado') {
      throw crearError(409, 'ETAPA_YA_COMPLETADA', 'La etapa ya fue completada');
    }

    if (etapa.estado === 'completado_propuesto') {
      throw crearError(409, 'ETAPA_PENDIENTE_VALIDACION', 'Ya se propuso la conclusion de esta etapa; espere la validacion del integrante de adquisiciones');
    }

    if (req.file) {
      throw crearError(409, 'EVIDENCIA_EN_FLUJO_INCORRECTO', 'La evidencia debe cargarse y validarse antes de proponer la conclusion de la etapa');
    }

    if (tieneEvidenciaBloqueante(etapa)) {
      throw crearError(409, 'EVIDENCIA_PENDIENTE_VALIDACION', 'No puede proponer la conclusion mientras exista evidencia pendiente o rechazada');
    }

    verificarSecuencia(lista, etapa);

    etapa.estadoAnteriorPropuesta = etapa.estado;
    etapa.estado = 'completado_propuesto';
    etapa.propuestoPor = req.usuario.id;
    etapa.propuestoEn = new Date();
    etapa.resultadoValidacionConclusion = undefined;
    etapa.validadoPorConclusion = undefined;
    etapa.validadaEnConclusion = undefined;
    etapa.motivoRechazoConclusion = undefined;
    etapa.historialConclusiones.push({
      accion: 'propuesta',
      realizadoPor: req.usuario.id,
    });

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'PROPONER_COMPLETAR_ETAPA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, nombreEtapa: etapa.nombre },
      req,
    });

    return ok(res, etapa, `Se propuso la conclusion de "${etapa.nombre}". Pendiente de validacion.`);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/validar-completado  — solo IA / admin
// Confirma o rechaza la propuesta de conclusion del AT.
// -------------------------------------------------------
async function validarCompletado(req, res, next) {
  try {
    const { respuesta, motivoRechazo } = req.body;
    if (!['si', 'no'].includes(respuesta)) {
      throw crearError(400, 'RESPUESTA_INVALIDA', 'La respuesta debe ser "si" o "no"');
    }
    if (respuesta === 'no' && !String(motivoRechazo || '').trim()) {
      throw crearError(400, 'MOTIVO_REQUERIDO', 'El motivo de rechazo es obligatorio');
    }

    const { procedimiento, etapa, seccion } = await resolverSeccion(
      req.params.id,
      req.params.etapaId
    );

    if (etapa.estado !== 'completado_propuesto') {
      throw crearError(409, 'SIN_PROPUESTA_PENDIENTE', 'Esta etapa no tiene una propuesta de conclusion pendiente');
    }

    if (respuesta === 'si') {
      etapa.estado = 'completado';
      etapa.fechaReal = new Date();
      etapa.completadoPor = etapa.propuestoPor;
      etapa.completadoEn = new Date();
      etapa.resultadoValidacionConclusion = 'aceptada';
      etapa.validadoPorConclusion = req.usuario.id;
      etapa.validadaEnConclusion = new Date();
      etapa.motivoRechazoConclusion = undefined;
      etapa.historialConclusiones.push({
        accion: 'aceptada',
        realizadoPor: req.usuario.id,
      });
    } else {
      etapa.estado = etapa.estadoAnteriorPropuesta || 'activo';
      etapa.resultadoValidacionConclusion = 'rechazada';
      etapa.validadoPorConclusion = req.usuario.id;
      etapa.validadaEnConclusion = new Date();
      etapa.motivoRechazoConclusion = String(motivoRechazo).trim();
      etapa.historialConclusiones.push({
        accion: 'rechazada',
        realizadoPor: req.usuario.id,
        motivo: String(motivoRechazo).trim(),
      });
    }

    etapa.propuestoPor = undefined;
    etapa.propuestoEn = undefined;
    etapa.estadoAnteriorPropuesta = undefined;

    await procedimiento.save();

    if (respuesta === 'si') {
      if (seccion === 'cronograma' && procedimiento.etapaActual === 'cronograma') {
        const todasTerminadas = procedimiento.cronograma.every(
          (e) => e.estado === 'completado' || e.noAplica
        );
        if (todasTerminadas) {
          procedimiento.etapaActual = 'hoja_de_trabajo';
          await procedimiento.save();
        }
      }
    }

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: respuesta === 'si' ? 'VALIDAR_ETAPA_SI' : 'VALIDAR_ETAPA_NO',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, nombreEtapa: etapa.nombre, motivoRechazo },
      req,
    });

    const mensaje = respuesta === 'si'
      ? `Etapa "${etapa.nombre}" validada y marcada como completada`
      : `Propuesta de conclusion de "${etapa.nombre}" rechazada`;

    return ok(res, etapa, mensaje);
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

    if (req.usuario.rol !== 'administrador' && !esMiProcedimiento(procedimiento, req.usuario.id)) {
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

    const { rol, id: usuarioId } = req.usuario;
    if (rol === 'asesor_tecnico') {
      if (!esMiProcedimiento(procedimiento, usuarioId)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
      }
    } else if (!puedeGestionarProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
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

    const { rol, id: usuarioId } = req.usuario;
    if (rol === 'asesor_tecnico') {
      if (!esMiProcedimiento(procedimiento, usuarioId)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
      }
    } else if (!puedeGestionarProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
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
// POST /:id/etapas/:etapaId/evidencia  — AT
// -------------------------------------------------------
async function subirEvidencia(req, res, next) {
  try {
    if (!req.file) {
      throw crearError(400, 'ARCHIVO_REQUERIDO', 'Se requiere una imagen o un archivo PDF');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);
    const { reemplazaEvidenciaId } = req.body;

    if (req.usuario.rol !== 'administrador' && !esMiProcedimiento(procedimiento, req.usuario.id)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Solo el asesor tecnico asignado puede cargar evidencias');
    }

    if (etapa.noAplica) {
      throw crearError(409, 'ETAPA_NO_APLICA', 'No se puede cargar evidencia en una etapa marcada como no aplica');
    }

    let reemplazaArchivoId;
    if (reemplazaEvidenciaId) {
      const evidenciaAnterior = etapa.evidencias.id(reemplazaEvidenciaId);
      if (!evidenciaAnterior) {
        throw crearError(404, 'EVIDENCIA_NO_ENCONTRADA', 'La evidencia a reemplazar no existe');
      }
      if (evidenciaAnterior.validacionEstado !== 'rechazada') {
        throw crearError(409, 'EVIDENCIA_NO_RECHAZADA', 'Solo se puede reemplazar una evidencia rechazada');
      }
      reemplazaArchivoId = evidenciaAnterior._id;
    }

    etapa.evidencias.push({
      ...crearRegistroEvidencia(req.file, req.usuario.id),
      ...(reemplazaArchivoId ? { reemplazaEvidenciaId: reemplazaArchivoId } : {}),
    });
    await procedimiento.save();

    const evidencia = etapa.evidencias[etapa.evidencias.length - 1];

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'CARGA_EVIDENCIA_ETAPA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, archivo: req.file.filename },
      req,
    });

    return ok(res, evidencia, 'Evidencia cargada correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /:id/etapas/:etapaId/evidencia/:archivoId/validar
// -------------------------------------------------------
async function validarEvidencia(req, res, next) {
  try {
    const { respuesta, comentario } = req.body;
    if (!['aceptar', 'rechazar'].includes(respuesta)) {
      throw crearError(400, 'RESPUESTA_INVALIDA', 'La respuesta debe ser "aceptar" o "rechazar"');
    }
    if (respuesta === 'rechazar' && !String(comentario || '').trim()) {
      throw crearError(400, 'MOTIVO_REQUERIDO', 'El motivo de rechazo es obligatorio');
    }

    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    if (!['administrador', 'adquisiciones'].includes(req.usuario.rol)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Solo administrador o adquisiciones pueden validar evidencias');
    }

    const evidencia = etapa.evidencias.id(req.params.archivoId);
    if (!evidencia) {
      throw crearError(404, 'ARCHIVO_NO_ENCONTRADO', 'Archivo de evidencia no encontrado');
    }

    evidencia.validacionEstado = respuesta === 'aceptar' ? 'validada' : 'rechazada';
    evidencia.validadoPor = req.usuario.id;
    evidencia.validadaEn = new Date();
    evidencia.comentarioValidacion = comentario || undefined;

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: respuesta === 'aceptar' ? 'VALIDAR_EVIDENCIA_ETAPA' : 'RECHAZAR_EVIDENCIA_ETAPA',
      recurso: 'etapa',
      recursoId: etapa._id,
      detalle: { procedimientoId: procedimiento._id, archivoId: evidencia._id, comentario },
      req,
    });

    return ok(res, evidencia, respuesta === 'aceptar' ? 'Evidencia validada' : 'Evidencia rechazada');
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

// -------------------------------------------------------
// GET /:id/etapas/:etapaId/evidencia/:archivoId
// Sirve el archivo de evidencia PDF a cualquier usuario con acceso al procedimiento.
// -------------------------------------------------------
async function obtenerEvidencia(req, res, next) {
  try {
    const { procedimiento, etapa } = await resolverSeccion(req.params.id, req.params.etapaId);

    const { rol, id: usuarioId } = req.usuario;
    if (rol === 'asesor_tecnico') {
      if (!esMiProcedimiento(procedimiento, usuarioId)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
      }
    } else if (!puedeVerProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
    }

    const evidencia = etapa.evidencias.id(req.params.archivoId);
    if (!evidencia) {
      throw crearError(404, 'ARCHIVO_NO_ENCONTRADO', 'Archivo de evidencia no encontrado');
    }

    return res.sendFile(path.resolve(evidencia.ruta));
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /:id/etapas/:etapaId/reporte
// -------------------------------------------------------
async function descargarReporteActividad(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id)
      .populate('cronograma.observaciones.creadoPor', 'nombre apellidos')
      .populate('cronograma.evidencias.cargadoPor', 'nombre apellidos')
      .populate('cronograma.evidencias.validadoPor', 'nombre apellidos')
      .populate('cronograma.historialConclusiones.realizadoPor', 'nombre apellidos')
      .populate('hojaDeTrabajoEtapas.observaciones.creadoPor', 'nombre apellidos')
      .populate('hojaDeTrabajoEtapas.evidencias.cargadoPor', 'nombre apellidos')
      .populate('hojaDeTrabajoEtapas.evidencias.validadoPor', 'nombre apellidos')
      .populate('hojaDeTrabajoEtapas.historialConclusiones.realizadoPor', 'nombre apellidos')
      .populate('asesorTitular', 'nombre apellidos')
      .populate('asesorSuplente', 'nombre apellidos');

    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    const { rol, id: usuarioId } = req.usuario;
    if (rol === 'asesor_tecnico') {
      if (!esMiProcedimiento(procedimiento, usuarioId)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
      }
    } else if (!puedeVerProcedimiento(procedimiento, req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
    }

    const etapa =
      procedimiento.cronograma.id(req.params.etapaId) ||
      procedimiento.hojaDeTrabajoEtapas.id(req.params.etapaId);

    if (!etapa) {
      throw crearError(404, 'ETAPA_NO_ENCONTRADA', 'Etapa no encontrada en el procedimiento');
    }

    const actividades = [];

    for (const evidencia of etapa.evidencias || []) {
      actividades.push({
        fecha: evidencia.cargadaEn,
        actor: nombreUsuario(evidencia.cargadoPor),
        accion: evidencia.reemplazaEvidenciaId ? 'Reemplazo de evidencia' : 'Carga de evidencia',
        detalle: evidencia.nombre,
      });

      if (evidencia.validadoPor && evidencia.validadaEn) {
        actividades.push({
          fecha: evidencia.validadaEn,
          actor: nombreUsuario(evidencia.validadoPor),
          accion: evidencia.validacionEstado === 'rechazada' ? 'Rechazo de evidencia' : 'Validación de evidencia',
          detalle: evidencia.comentarioValidacion || evidencia.nombre,
        });
      }
    }

    for (const registro of etapa.historialConclusiones || []) {
      actividades.push({
        fecha: registro.timestamp,
        actor: nombreUsuario(registro.realizadoPor),
        accion:
          registro.accion === 'propuesta'
            ? 'Propuesta de conclusión'
            : registro.accion === 'aceptada'
            ? 'Validación de conclusión'
            : 'Rechazo de conclusión',
        detalle: registro.motivo || '',
      });
    }

    for (const observacion of etapa.observaciones || []) {
      actividades.push({
        fecha: observacion.timestamp,
        actor: nombreUsuario(observacion.creadoPor),
        accion: 'Observación registrada',
        detalle: observacion.texto,
      });
    }

    actividades.sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const totalValidaciones = actividades.filter((a) => a.accion.startsWith('Validación')).length;
    const totalRechazos = actividades.filter((a) => a.accion.startsWith('Rechazo')).length;
    const totalSeguimiento = actividades.filter(
      (a) =>
        a.accion.startsWith('Carga') ||
        a.accion.startsWith('Reemplazo') ||
        a.accion.startsWith('Propuesta')
    ).length;
    const ultimaRevision = [...actividades].reverse().find(
      (a) => a.accion.startsWith('Validación') || a.accion.startsWith('Rechazo')
    );
    const ultimaActividad = actividades[actividades.length - 1];

    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const slug = `${procedimiento.numeroProcedimiento || procedimiento._id}-${etapa.nombre}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="SSA-etapa-${slug || Date.now()}.pdf"`);
    doc.pipe(res);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;
    const cardGap = 12;

    // --- ENCABEZADO (altura dinámica según largo del título) ---
    const headerY = doc.y;
    doc.font('Helvetica').fontSize(10);
    const tituloH = doc.heightOfString(procedimiento.titulo, { width: pageWidth - 36, lineGap: 1 });
    const headerHeight = Math.max(96, 68 + tituloH);

    dibujarTarjeta(doc, startX, headerY, pageWidth, headerHeight, {
      fill: '#0f172a',
      stroke: '#0f172a',
      radius: 18,
    });

    doc
      .fillColor('#bfdbfe')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('BITÁCORA DE REVISIÓN DE ETAPA', startX + 18, headerY + 14, { width: pageWidth - 200 });

    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(18)
      .text(procedimiento.numeroProcedimiento || 'Procedimiento sin número', startX + 18, headerY + 30, {
        width: pageWidth - 220,
      });

    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#e2e8f0')
      .text(procedimiento.titulo, startX + 18, headerY + 56, { width: pageWidth - 36, lineGap: 1 });

    // Badge de nombre de etapa (altura dinámica)
    doc.font('Helvetica-Bold').fontSize(9);
    const etapaBadgeNameH = doc.heightOfString(etapa.nombre, { width: 134 });
    const etapaBadgeH = Math.max(24, etapaBadgeNameH + 10);
    doc
      .save()
      .roundedRect(startX + pageWidth - 168, headerY + 14, 150, etapaBadgeH, 12)
      .fill('#1e293b')
      .restore();
    doc
      .fillColor('#f8fafc')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(etapa.nombre, startX + pageWidth - 160, headerY + 14 + Math.floor((etapaBadgeH - etapaBadgeNameH) / 2), {
        width: 134,
        align: 'center',
      });

    doc.y = headerY + headerHeight + 16;

    // --- KPIs ---
    const kpiWidth = (pageWidth - cardGap * 3) / 4;
    const kpiHeight = 66;
    const kpiY = doc.y;
    dibujarKpi(doc, startX, kpiY, kpiWidth, kpiHeight, {
      label: 'Actividades',
      value: actividades.length,
      accent: '#334155',
      fill: '#f8fafc',
    });
    dibujarKpi(doc, startX + kpiWidth + cardGap, kpiY, kpiWidth, kpiHeight, {
      label: 'Validaciones',
      value: totalValidaciones,
      accent: '#15803d',
      fill: '#ecfdf5',
    });
    dibujarKpi(doc, startX + (kpiWidth + cardGap) * 2, kpiY, kpiWidth, kpiHeight, {
      label: 'Rechazos',
      value: totalRechazos,
      accent: '#b91c1c',
      fill: '#fff1f2',
    });
    dibujarKpi(doc, startX + (kpiWidth + cardGap) * 3, kpiY, kpiWidth, kpiHeight, {
      label: 'Cargas / propuestas',
      value: totalSeguimiento,
      accent: '#1d4ed8',
      fill: '#eff6ff',
    });

    doc.y = kpiY + kpiHeight + 16;

    // --- TARJETAS DE DATOS (alturas dinámicas) ---
    const dataWidth = (pageWidth - cardGap) / 2;

    const dataRow1Y = doc.y;
    const h1a = calcularAlturaDato(doc, dataWidth, fechaHora(new Date()));
    const h1b = calcularAlturaDato(doc, dataWidth, etapa.nombre);
    const dataRow1H = Math.max(h1a, h1b);
    dibujarDato(doc, startX, dataRow1Y, dataWidth, dataRow1H, {
      label: 'Generado',
      value: fechaHora(new Date()),
      fill: '#ffffff',
      stroke: '#e2e8f0',
    });
    dibujarDato(doc, startX + dataWidth + cardGap, dataRow1Y, dataWidth, dataRow1H, {
      label: 'Etapa',
      value: etapa.nombre,
      fill: '#ffffff',
      stroke: '#e2e8f0',
    });

    doc.y = dataRow1Y + dataRow1H + cardGap;

    const dataRow2Y = doc.y;
    const asesorTitularNombre = nombreUsuario(procedimiento.asesorTitular);
    const asesorSuplenteNombre = nombreUsuario(procedimiento.asesorSuplente);
    const h2a = calcularAlturaDato(doc, dataWidth, asesorTitularNombre);
    const h2b = calcularAlturaDato(doc, dataWidth, asesorSuplenteNombre);
    const dataRow2H = Math.max(h2a, h2b);
    dibujarDato(doc, startX, dataRow2Y, dataWidth, dataRow2H, {
      label: 'Asesor titular',
      value: asesorTitularNombre,
      fill: '#ffffff',
      stroke: '#e2e8f0',
    });
    dibujarDato(doc, startX + dataWidth + cardGap, dataRow2Y, dataWidth, dataRow2H, {
      label: 'Asesor suplente',
      value: asesorSuplenteNombre,
      fill: '#ffffff',
      stroke: '#e2e8f0',
    });

    doc.y = dataRow2Y + dataRow2H + 16;

    // --- TARJETA DE ÚLTIMA REVISIÓN (altura dinámica) ---
    const tarjetaRevision = ultimaRevision
      ? estiloActividad(ultimaRevision.accion)
      : { color: '#92400e', fill: '#fffbeb', stroke: '#fcd34d', badge: 'Pendiente' };

    const accionRevTexto = ultimaRevision
      ? ultimaRevision.accion
      : 'Aún no existe una validación o rechazo registrado';
    const actorRevTexto = ultimaRevision
      ? `${ultimaRevision.actor} · ${fechaHora(ultimaRevision.fecha)}`
      : 'La etapa sigue en preparación y todavía no ha sido revisada por adquisiciones.';

    doc.font('Helvetica-Bold').fontSize(16);
    const accionRevH = doc.heightOfString(accionRevTexto, { width: pageWidth - 190 });
    doc.font('Helvetica').fontSize(10);
    const actorRevH = doc.heightOfString(actorRevTexto, { width: pageWidth - 32 });

    const Y_REV_ACCION = 28;
    const Y_REV_ACTOR = Y_REV_ACCION + accionRevH + 8;
    const reviewHeight = Math.max(78, Y_REV_ACTOR + actorRevH + 14);

    const reviewY = doc.y;
    dibujarTarjeta(doc, startX, reviewY, pageWidth, reviewHeight, {
      fill: tarjetaRevision.fill,
      stroke: tarjetaRevision.stroke,
      radius: 16,
    });
    doc
      .fillColor('#64748b')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text('ÚLTIMA REVISIÓN REGISTRADA', startX + 16, reviewY + 12, { width: pageWidth - 160 });
    doc
      .fillColor(tarjetaRevision.color)
      .font('Helvetica-Bold')
      .fontSize(16)
      .text(accionRevTexto, startX + 16, reviewY + Y_REV_ACCION, { width: pageWidth - 190 });
    doc
      .fillColor('#0f172a')
      .font('Helvetica')
      .fontSize(10)
      .text(actorRevTexto, startX + 16, reviewY + Y_REV_ACTOR, { width: pageWidth - 32 });

    // Badge centrado verticalmente en el lado derecho
    const badgeRevCentroY = reviewY + Math.floor(reviewHeight / 2) - 14;
    doc
      .save()
      .roundedRect(startX + pageWidth - 144, badgeRevCentroY, 124, 28, 14)
      .fill(tarjetaRevision.color)
      .restore();
    doc
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(ultimaRevision ? 'REVISADO' : 'PENDIENTE', startX + pageWidth - 136, badgeRevCentroY + 9, {
        width: 108,
        align: 'center',
      });

    doc.y = reviewY + reviewHeight + 16;

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor('#15803d')
      .text('Verde: validaciones', { continued: true })
      .fillColor('#111827')
      .text('   |   ', { continued: true })
      .fillColor('#b91c1c')
      .text('Rojo: rechazos', { continued: true })
      .fillColor('#111827')
      .text('   |   ', { continued: true })
      .fillColor('#1d4ed8')
      .text('Azul: cargas y propuestas')
      .fillColor('#334155')
      .moveDown(0.9);

    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#0f172a')
      .text('Línea de actividades');
    doc.moveDown(0.4);

    if (actividades.length === 0) {
      doc.fontSize(10).text('No hay actividades registradas para esta etapa.');
    } else {
      actividades.forEach((actividad, index) => {
        const estilo = estiloActividad(actividad.accion);
        const esUltimaActividad = ultimaActividad === actividad;
        const detalleTexto = actividad.detalle || 'Sin detalle adicional';

        // Medir textos para calcular posiciones dinámicas
        doc.font('Helvetica-Bold').fontSize(13);
        const accionH = doc.heightOfString(actividad.accion, { width: pageWidth - 170 });

        doc.font('Helvetica-Bold').fontSize(10);
        const actorH = doc.heightOfString(actividad.actor, { width: 150 });
        const fechaValH = doc.heightOfString(fechaHora(actividad.fecha), { width: 150 });
        const valoresH = Math.max(actorH, fechaValH);

        doc.font('Helvetica').fontSize(9);
        const detalleH = doc.heightOfString(detalleTexto, { width: pageWidth - 40, lineGap: 2 });

        // Posiciones Y relativas al inicio de la tarjeta
        const Y_NUM       = 12;
        const Y_BADGE_CAT = 12;                        // badge de categoría (derecha)
        const Y_ACCION    = 28;                        // texto de acción
        const Y_LABELS    = Y_ACCION + accionH + 12;  // etiquetas "Usuario" / "Fecha y hora"
        const Y_VALUES    = Y_LABELS + 13;             // valores actor / fecha
        const Y_DET_LBL   = Y_VALUES + valoresH + 10; // etiqueta "Detalle"
        const Y_DET       = Y_DET_LBL + 13;           // texto de detalle

        // Badge "ÚLTIMA ACTIVIDAD" va justo abajo del badge de categoría si aplica
        const Y_ULTI_BADGE = Y_BADGE_CAT + 26;

        const minPorBadgeUlti = esUltimaActividad ? Y_ULTI_BADGE + 32 : 0;
        const cardHeight = Math.max(Y_DET + detalleH + 14, minPorBadgeUlti);

        asegurarEspacio(doc, cardHeight + 10);

        const activityY = doc.y;
        dibujarTarjeta(doc, startX, activityY, pageWidth, cardHeight, {
          fill: esUltimaActividad ? '#fff7ed' : estilo.fill,
          stroke: esUltimaActividad ? '#fb923c' : estilo.stroke,
          radius: 16,
        });

        // Barra de acento lateral izquierda
        doc
          .save()
          .roundedRect(startX, activityY, 8, cardHeight, 8)
          .fill(esUltimaActividad ? '#f97316' : estilo.color)
          .restore();

        // Badge de categoría (arriba a la derecha)
        doc
          .save()
          .roundedRect(startX + pageWidth - 108, activityY + Y_BADGE_CAT, 88, 20, 10)
          .fill(estilo.color)
          .restore();
        doc
          .fillColor('#ffffff')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(estilo.badge.toUpperCase(), startX + pageWidth - 100, activityY + Y_BADGE_CAT + 6, {
            width: 72,
            align: 'center',
          });

        // Badge "ÚLTIMA ACTIVIDAD" debajo del badge de categoría
        if (esUltimaActividad) {
          doc
            .save()
            .roundedRect(startX + pageWidth - 112, activityY + Y_ULTI_BADGE, 92, 22, 11)
            .fill('#f97316')
            .restore();
          doc
            .fillColor('#ffffff')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text('ÚLTIMA ACTIVIDAD', startX + pageWidth - 104, activityY + Y_ULTI_BADGE + 7, {
              width: 76,
              align: 'center',
            });
        }

        // Número de movimiento
        doc
          .fillColor('#94a3b8')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(`MOVIMIENTO ${index + 1}`, startX + 20, activityY + Y_NUM);

        // Texto de la acción
        doc
          .fillColor(estilo.color)
          .font('Helvetica-Bold')
          .fontSize(13)
          .text(actividad.accion, startX + 20, activityY + Y_ACCION, { width: pageWidth - 170 });

        // Etiquetas "Usuario" y "Fecha y hora"
        doc
          .fillColor('#64748b')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text('Usuario', startX + 20, activityY + Y_LABELS)
          .text('Fecha y hora', startX + 210, activityY + Y_LABELS);

        // Valores actor y fecha
        doc
          .fillColor('#0f172a')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(actividad.actor, startX + 20, activityY + Y_VALUES, { width: 160 })
          .text(fechaHora(actividad.fecha), startX + 210, activityY + Y_VALUES, { width: 160 });

        // Etiqueta "Detalle"
        doc
          .fillColor('#94a3b8')
          .font('Helvetica-Bold')
          .fontSize(8)
          .text('Detalle', startX + 20, activityY + Y_DET_LBL);

        // Texto de detalle
        doc
          .fillColor('#334155')
          .font('Helvetica')
          .fontSize(9)
          .text(detalleTexto, startX + 20, activityY + Y_DET, { width: pageWidth - 40, lineGap: 2 });

        doc.y = activityY + cardHeight + 10;
      });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  completar,
  validarCompletado,
  proponerFecha,
  responderFecha,
  sobreescribirFecha,
  agregarObservacion,
  subirArchivo,
  subirEvidencia,
  validarEvidencia,
  marcarNoAplica,
  obtenerEvidencia,
  descargarReporteActividad,
};
