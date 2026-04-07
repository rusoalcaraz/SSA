'use strict';

const { Procedimiento } = require('../../models/procedimiento.model');
const { crearError } = require('../../middleware/errorHandler');
const { ok, creado } = require('../../utils/respuesta');
const auditLog = require('../../services/auditLog.service');
const {
  generarNumeroProcedimiento,
  filtroByRol,
  esMiProcedimiento,
  inicializarEtapas,
} = require('../../services/procedimiento.service');
const { notificarProcedimientoUrgente } = require('../../services/notificaciones.service');
const { Usuario } = require('../../models/usuario.model');

const POPULATE_BASICO = [
  { path: 'bienServicio', select: 'clave descripcion tipo' },
  { path: 'direccionGeneral', select: 'nombre siglas' },
  { path: 'asesorTitular', select: 'nombre apellidos correo' },
  { path: 'asesorSuplente', select: 'nombre apellidos correo' },
  { path: 'creadoPor', select: 'nombre apellidos' },
];

// -------------------------------------------------------
// GET /api/v1/procedimientos
// -------------------------------------------------------
async function listar(req, res, next) {
  try {
    const filtroRol = filtroByRol(req.usuario);
    if (filtroRol === null) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Su rol no tiene acceso al listado de procedimientos');
    }

    // Filtros opcionales de query
    const { anioFiscal, urgente, etapaActual, tipoProcedimiento, dgId } = req.query;
    const filtro = { ...filtroRol };
    if (anioFiscal) filtro.anioFiscal = Number(anioFiscal);
    if (urgente !== undefined) filtro.urgente = urgente === 'true';
    if (etapaActual) {
      if (etapaActual === 'hoja_de_trabajo') {
        filtro.$or = [
          { etapaActual: 'hoja_de_trabajo' },
          {
            etapaActual: 'cronograma',
            // Cronograma totalmente concluido: no existe etapa pendiente que no sea 'noAplica'
            cronograma: {
              $not: {
                $elemMatch: {
                  noAplica: { $ne: true },
                  estado: { $ne: 'completado' },
                },
              },
            },
          },
        ];
      } else if (etapaActual === 'cronograma') {
        // Cronograma activo: existe al menos una etapa no completada y que aplica
        Object.assign(filtro, {
          etapaActual: 'cronograma',
          cronograma: {
            $elemMatch: {
              noAplica: { $ne: true },
              estado: { $ne: 'completado' },
            },
          },
        });
      } else {
        filtro.etapaActual = etapaActual;
      }
    }
    if (tipoProcedimiento) filtro.tipoProcedimiento = tipoProcedimiento;
    if (dgId && ['superadmin', 'gerencial'].includes(req.usuario.rol)) {
      filtro.direccionGeneral = dgId;
    }

    // Paginacion
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [procedimientos, total] = await Promise.all([
      Procedimiento.find(filtro)
        .populate(POPULATE_BASICO)
        .select('-cronograma -hojaDeTrabajoEtapas -entregas -evidenciaJustificacion -contrato')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Procedimiento.countDocuments(filtro),
    ]);

    return ok(res, procedimientos, 'Procedimientos obtenidos', 200, {
      page,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /api/v1/procedimientos/:id
// -------------------------------------------------------
async function obtener(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id)
      .populate(POPULATE_BASICO)
      .populate('cronograma.completadoPor', 'nombre apellidos')
      .populate('cronograma.observaciones.creadoPor', 'nombre apellidos')
      .populate('hojaDeTrabajoEtapas.completadoPor', 'nombre apellidos')
      .populate('hojaDeTrabajoEtapas.observaciones.creadoPor', 'nombre apellidos')
      .populate('entregas.registradoPor', 'nombre apellidos')
      .populate('entregas.documentos.cargadoPor', 'nombre apellidos')
      .populate('evidenciaJustificacion.cargadoPor', 'nombre apellidos');

    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    // Verificar acceso por rol
    const { rol, id: usuarioId, dgId } = req.usuario;
    if (rol === 'asesor_tecnico' && !esMiProcedimiento(procedimiento, usuarioId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No tiene acceso a este procedimiento');
    }
    if (rol === 'dgt' && !procedimiento.direccionGeneral._id.equals(dgId)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'Este procedimiento pertenece a otra Direccion General');
    }
    if (rol === 'inspeccion') {
      throw crearError(403, 'ACCESO_DENEGADO', 'Su rol solo tiene acceso a la seccion de Entregas');
    }

    return ok(res, procedimiento);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /api/v1/procedimientos
// -------------------------------------------------------
async function crear(req, res, next) {
  try {
    const {
      titulo,
      descripcion,
      anioFiscal,
      bienServicio,
      descripcionEspecifica,
      montoEstimado,
      moneda,
      direccionGeneral,
      asesorTitular,
      asesorSuplente,
      tipoProcedimiento,
      supuestoExcepcion,
      tipoConsultoria,
      justificacionTipo,
      urgente,
      justificacionUrgencia,
    } = req.body;

    const numeroProcedimiento = await generarNumeroProcedimiento(
      direccionGeneral,
      anioFiscal || new Date().getFullYear()
    );

    const { cronograma, hojaDeTrabajoEtapas } = await inicializarEtapas(tipoProcedimiento);

    const procedimiento = await Procedimiento.create({
      numeroProcedimiento,
      anioFiscal: anioFiscal || new Date().getFullYear(),
      titulo,
      descripcion,
      bienServicio,
      descripcionEspecifica,
      montoEstimado,
      moneda,
      direccionGeneral,
      asesorTitular,
      asesorSuplente: asesorSuplente || null,
      tipoProcedimiento,
      supuestoExcepcion: supuestoExcepcion || null,
      tipoConsultoria: tipoConsultoria || null,
      justificacionTipo,
      urgente: urgente || false,
      justificacionUrgencia: urgente ? justificacionUrgencia : undefined,
      // Permitir capturar datos generales del cronograma en la creacion
      infoCronograma: req.body.infoCronograma || {},
      cronograma,
      hojaDeTrabajoEtapas,
      creadoPor: req.usuario.id,
    });

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'CREAR_PROCEDIMIENTO',
      recurso: 'procedimiento',
      recursoId: procedimiento._id,
      detalle: { numeroProcedimiento, tipoProcedimiento, urgente },
      req,
    });

    // Notificar procedimiento urgente a gerencial y DGT de la DG
    if (urgente) {
      Promise.all([
        Usuario.find({ rol: 'gerencial', activo: true }).select('correo'),
        Usuario.find({ rol: 'dgt', direccionGeneral: direccionGeneral, activo: true }).select('correo'),
      ])
        .then(([gerenciales, dgts]) => {
          const correosGerencial = gerenciales.map((u) => u.correo);
          const correosDGT = dgts.map((u) => u.correo);
          return notificarProcedimientoUrgente(procedimiento, correosGerencial, correosDGT);
        })
        .catch((err) => console.error('[Notificaciones] crear urgente:', err.message));
    }

    return creado(res, procedimiento, `Procedimiento ${numeroProcedimiento} creado correctamente`);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/procedimientos/:id
// -------------------------------------------------------
async function actualizar(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    if (['concluido', 'cancelado'].includes(procedimiento.etapaActual)) {
      throw crearError(409, 'PROCEDIMIENTO_CERRADO', 'No se puede modificar un procedimiento concluido o cancelado');
    }

    const camposPermitidos = [
      'titulo', 'descripcion', 'bienServicio', 'descripcionEspecifica',
      'montoEstimado', 'moneda', 'asesorTitular', 'asesorSuplente',
      'justificacionTipo',
    ];

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        procedimiento[campo] = req.body[campo];
      }
    }

    await procedimiento.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'ACTUALIZAR_PROCEDIMIENTO',
      recurso: 'procedimiento',
      recursoId: procedimiento._id,
      req,
    });

    return ok(res, procedimiento, 'Procedimiento actualizado correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PATCH /api/v1/procedimientos/:id/urgente
// -------------------------------------------------------
async function marcarUrgente(req, res, next) {
  try {
    const { urgente, justificacionUrgencia } = req.body;

    if (urgente === undefined) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'El campo urgente es requerido');
    }
    if (urgente && !justificacionUrgencia) {
      throw crearError(400, 'JUSTIFICACION_REQUERIDA', 'La justificacion de urgencia es obligatoria');
    }

    const procedimiento = await Procedimiento.findByIdAndUpdate(
      req.params.id,
      {
        urgente,
        justificacionUrgencia: urgente ? justificacionUrgencia : undefined,
      },
      { new: true, runValidators: true }
    );

    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: urgente ? 'MARCAR_URGENTE' : 'QUITAR_URGENTE',
      recurso: 'procedimiento',
      recursoId: procedimiento._id,
      detalle: { justificacionUrgencia },
      req,
    });

    return ok(res, procedimiento, `Procedimiento marcado como ${urgente ? 'urgente' : 'no urgente'}`);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/procedimientos/:id/justificacion
// -------------------------------------------------------
async function actualizarJustificacion(req, res, next) {
  try {
    const { supuestoExcepcion, tipoConsultoria, justificacionTipo } = req.body;

    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    if (supuestoExcepcion !== undefined) procedimiento.supuestoExcepcion = supuestoExcepcion;
    if (tipoConsultoria !== undefined) procedimiento.tipoConsultoria = tipoConsultoria;
    if (justificacionTipo !== undefined) procedimiento.justificacionTipo = justificacionTipo;

    // Archivos de evidencia: se agregan en la ruta POST /:id/justificacion/archivo
    await procedimiento.save();

    return ok(res, procedimiento, 'Justificacion actualizada correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/procedimientos/:id/cronograma-info
// -------------------------------------------------------
async function actualizarInfoCronograma(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    const campos = [
      'organismo', 'fecha', 'asesorTecnico', 'fuenteFinanciamiento',
      'telefonoCelular', 'extensionSatelital', 'nombreProcedimientoContratacion',
      'numeroPartidas', 'numeroArticulos', 'capituloGasto', 'requiereAnualidad',
      'numeroOficioPlurianualidad', 'claveCartera', 'numeroClaveCartera',
    ];

    if (!procedimiento.infoCronograma) {
      procedimiento.infoCronograma = {};
    }
    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        procedimiento.infoCronograma[campo] = req.body[campo];
      }
    }
    procedimiento.markModified('infoCronograma');

    await procedimiento.save();
    return ok(res, procedimiento.infoCronograma, 'Informacion del cronograma actualizada');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/procedimientos/:id/hoja-trabajo-info
// -------------------------------------------------------
async function actualizarInfoHojaDeTrabajo(req, res, next) {
  try {
    const procedimiento = await Procedimiento.findById(req.params.id);
    if (!procedimiento) {
      throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
    }

    const campos = [
      'organismo', 'fecha', 'nombreResponsable', 'telefonoCelular',
      'extensionSatelital', 'nombreProcedimientoContratacion', 'techoPresupuestal',
      'claveCartera', 'origenRecursos', 'tipoProcedimientoContratacion',
      'areaContratante', 'extensionSatelitalAreaContratante',
    ];

    if (!procedimiento.infoHojaDeTrabajo) {
      procedimiento.infoHojaDeTrabajo = {};
    }
    for (const campo of campos) {
      if (req.body[campo] !== undefined) {
        procedimiento.infoHojaDeTrabajo[campo] = req.body[campo];
      }
    }
    procedimiento.markModified('infoHojaDeTrabajo');

    await procedimiento.save();
    return ok(res, procedimiento.infoHojaDeTrabajo, 'Informacion de la hoja de trabajo actualizada');
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  marcarUrgente,
  actualizarJustificacion,
  actualizarInfoCronograma,
  actualizarInfoHojaDeTrabajo,
};
