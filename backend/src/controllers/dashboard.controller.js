'use strict';

const { Procedimiento } = require('../models/procedimiento.model');
const { DireccionGeneral } = require('../models/direccionGeneral.model');
const { crearError } = require('../middleware/errorHandler');
const { ok } = require('../utils/respuesta');

const HOY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const EN_TRES_DIAS = () => {
  const d = HOY();
  d.setDate(d.getDate() + 3);
  return d;
};

// Estados de etapa que se consideran "activos" (no terminados)
const ESTADOS_ACTIVOS = ['pendiente', 'activo', 'fecha_propuesta', 'fecha_rechazada'];

// -------------------------------------------------------
// Helper: agrega metricas de etapas sobre un array de procedimientos
// -------------------------------------------------------
function calcularAlertasEtapas(procedimientos) {
  let etapasVencidas = 0;
  let etapasProximasAVencer = 0;
  const hoy = HOY();
  const enTresDias = EN_TRES_DIAS();

  for (const proc of procedimientos) {
    const todasEtapas = [...(proc.cronograma || []), ...(proc.hojaDeTrabajoEtapas || [])];
    for (const etapa of todasEtapas) {
      if (!ESTADOS_ACTIVOS.includes(etapa.estado) || !etapa.fechaPlaneada) continue;
      const fecha = new Date(etapa.fechaPlaneada);
      if (fecha < hoy) etapasVencidas++;
      else if (fecha <= enTresDias) etapasProximasAVencer++;
    }
  }

  return { etapasVencidas, etapasProximasAVencer };
}

// -------------------------------------------------------
// Helper: construye el resumen agregado desde un conjunto de procedimientos
// -------------------------------------------------------
async function construirResumen(filtroProcedimientos) {
  const [
    porEtapaActual,
    porTipoProcedimiento,
    totalUrgentes,
    porDG,
    procedimientosConEtapas,
  ] = await Promise.all([
    // Conteo por etapaActual
    Procedimiento.aggregate([
      { $match: filtroProcedimientos },
      { $group: { _id: '$etapaActual', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),

    // Conteo por tipo de procedimiento
    Procedimiento.aggregate([
      { $match: filtroProcedimientos },
      { $group: { _id: '$tipoProcedimiento', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),

    // Total urgentes
    Procedimiento.countDocuments({ ...filtroProcedimientos, urgente: true }),

    // Conteo por DG (con nombre de DG)
    Procedimiento.aggregate([
      { $match: filtroProcedimientos },
      {
        $group: {
          _id: '$direccionGeneral',
          total: { $sum: 1 },
          urgentes: { $sum: { $cond: ['$urgente', 1, 0] } },
        },
      },
      {
        $lookup: {
          from: 'direcciongenerals',
          localField: '_id',
          foreignField: '_id',
          as: 'dg',
        },
      },
      { $unwind: { path: '$dg', preserveNullAndEmpty: true } },
      {
        $project: {
          _id: 1,
          nombre: '$dg.nombre',
          siglas: '$dg.siglas',
          total: 1,
          urgentes: 1,
        },
      },
      { $sort: { total: -1 } },
    ]),

    // Traer etapas para calcular alertas de vencimiento
    Procedimiento.find(filtroProcedimientos)
      .select('cronograma.estado cronograma.fechaPlaneada hojaDeTrabajoEtapas.estado hojaDeTrabajoEtapas.fechaPlaneada')
      .lean(),
  ]);

  const totalProcedimientos = porEtapaActual.reduce((acc, e) => acc + e.total, 0);
  const { etapasVencidas, etapasProximasAVencer } = calcularAlertasEtapas(procedimientosConEtapas);

  return {
    totalProcedimientos,
    totalUrgentes,
    porEtapaActual: Object.fromEntries(porEtapaActual.map((e) => [e._id, e.total])),
    porTipoProcedimiento: Object.fromEntries(porTipoProcedimiento.map((e) => [e._id, e.total])),
    porDireccionGeneral: porDG,
    alertas: { etapasVencidas, etapasProximasAVencer },
  };
}

// -------------------------------------------------------
// GET /api/v1/dashboard/resumen
// Roles: gerencial, superadmin
// -------------------------------------------------------
async function resumen(req, res, next) {
  try {
    const { anioFiscal } = req.query;
    const filtro = {};
    if (anioFiscal) filtro.anioFiscal = Number(anioFiscal);

    const datos = await construirResumen(filtro);
    return ok(res, datos, 'Resumen general obtenido');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /api/v1/dashboard/por-dg/:dgId
// Roles: gerencial, superadmin
// -------------------------------------------------------
async function porDG(req, res, next) {
  try {
    const { dgId } = req.params;
    const { anioFiscal } = req.query;

    const dg = await DireccionGeneral.findById(dgId).select('nombre siglas activa');
    if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');

    const filtro = { direccionGeneral: dg._id };
    if (anioFiscal) filtro.anioFiscal = Number(anioFiscal);

    const [resumenDG, procedimientos] = await Promise.all([
      construirResumen(filtro),
      Procedimiento.find(filtro)
        .select('numeroProcedimiento titulo tipoProcedimiento etapaActual urgente asesorTitular asesorSuplente createdAt')
        .populate('asesorTitular', 'nombre apellidos correo')
        .populate('asesorSuplente', 'nombre apellidos correo')
        .sort({ createdAt: -1 })
        .limit(50),
    ]);

    return ok(res, {
      direccionGeneral: dg,
      ...resumenDG,
      procedimientosRecientes: procedimientos,
    }, `Resumen de ${dg.siglas} obtenido`);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /api/v1/dashboard/mis-procedimientos
// Roles: asesor_tecnico, dgt, area_contratante
// -------------------------------------------------------
async function misProcedimientos(req, res, next) {
  try {
    const { rol, id: usuarioId, dgId } = req.usuario;
    const { etapaActual, urgente, anioFiscal } = req.query;

    // Filtro base segun rol
    let filtroBase = {};
    if (rol === 'asesor_tecnico') {
      filtroBase = { $or: [{ asesorTitular: usuarioId }, { asesorSuplente: usuarioId }] };
    } else if (rol === 'dgt') {
      if (!dgId) throw crearError(400, 'DG_NO_ASIGNADA', 'El usuario DGT no tiene Direccion General asignada');
      filtroBase = { direccionGeneral: dgId };
    }
    // area_contratante ve todos — filtroBase vacio

    if (etapaActual) filtroBase.etapaActual = etapaActual;
    if (urgente !== undefined) filtroBase.urgente = urgente === 'true';
    if (anioFiscal) filtroBase.anioFiscal = Number(anioFiscal);

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const hoy = HOY();
    const enTresDias = EN_TRES_DIAS();

    const [procedimientos, total] = await Promise.all([
      Procedimiento.find(filtroBase)
        .populate('bienServicio', 'clave descripcion')
        .populate('direccionGeneral', 'nombre siglas')
        .populate('asesorTitular', 'nombre apellidos')
        .populate('asesorSuplente', 'nombre apellidos')
        .select('-evidenciaJustificacion -contrato')
        .sort({ urgente: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Procedimiento.countDocuments(filtroBase),
    ]);

    // Anotar cada procedimiento con alertas de etapas proximas o vencidas
    const procedimientosAnotados = procedimientos.map((proc) => {
      const todasEtapas = [...(proc.cronograma || []), ...(proc.hojaDeTrabajoEtapas || [])];

      const etapasConAlerta = todasEtapas
        .filter((e) => ESTADOS_ACTIVOS.includes(e.estado) && e.fechaPlaneada)
        .map((e) => {
          const fecha = new Date(e.fechaPlaneada);
          return {
            etapaId: e._id,
            nombre: e.nombre,
            estado: e.estado,
            fechaPlaneada: e.fechaPlaneada,
            vencida: fecha < hoy,
            proximaAVencer: fecha >= hoy && fecha <= enTresDias,
          };
        })
        .filter((e) => e.vencida || e.proximaAVencer);

      return { ...proc, etapasConAlerta };
    });

    return ok(res, procedimientosAnotados, 'Mis procedimientos obtenidos', 200, {
      page,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { resumen, porDG, misProcedimientos };
