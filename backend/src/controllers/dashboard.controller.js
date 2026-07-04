'use strict';

const mongoose = require('mongoose');
const { Procedimiento } = require('../models/procedimiento.model');
const { DireccionGeneral } = require('../models/direccionGeneral.model');
const { Usuario } = require('../models/usuario.model');
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

function escaparRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toObjectId(value) {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (typeof value === 'string' && mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
}

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
// agrupacion: 'dg' | 'seccion' | 'asesor'
// -------------------------------------------------------
async function construirResumen(filtroProcedimientos, { agrupacion = 'dg' } = {}) {
  const agregarPorGrupo = agrupacion === 'subdireccion'
    ? Procedimiento.aggregate([
        { $match: filtroProcedimientos },
        { $group: { _id: '$subdireccion', total: { $sum: 1 }, urgentes: { $sum: { $cond: ['$urgente', 1, 0] } } } },
        { $lookup: { from: 'subdireccions', localField: '_id', foreignField: '_id', as: 'sub' } },
        { $unwind: { path: '$sub', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, nombre: '$sub.nombre', total: 1, urgentes: 1 } },
        { $sort: { total: -1 } },
      ])
    : agrupacion === 'seccion'
    ? Procedimiento.aggregate([
        { $match: filtroProcedimientos },
        { $group: { _id: '$seccion', total: { $sum: 1 }, urgentes: { $sum: { $cond: ['$urgente', 1, 0] } } } },
        { $lookup: { from: 'seccions', localField: '_id', foreignField: '_id', as: 'sec' } },
        { $unwind: { path: '$sec', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, nombre: '$sec.nombre', total: 1, urgentes: 1 } },
        { $sort: { total: -1 } },
      ])
    : agrupacion === 'asesor'
    ? Procedimiento.aggregate([
        { $match: filtroProcedimientos },
        { $group: { _id: '$asesorTitular', total: { $sum: 1 }, urgentes: { $sum: { $cond: ['$urgente', 1, 0] } } } },
        { $lookup: { from: 'usuarios', localField: '_id', foreignField: '_id', as: 'usr' } },
        { $unwind: { path: '$usr', preserveNullAndEmptyArrays: true } },
        { $project: { _id: 1, nombre: { $ifNull: [{ $concat: ['$usr.nombre', ' ', '$usr.apellidos'] }, 'Sin asignar'] }, total: 1, urgentes: 1 } },
        { $sort: { total: -1 } },
      ])
    : [];

  const [porGrupo, totalUrgentes, porTipoProcedimiento, procedimientosConEtapas] = await Promise.all([
    agregarPorGrupo,
    Procedimiento.countDocuments({ ...filtroProcedimientos, urgente: true }),
    Procedimiento.aggregate([
      { $match: filtroProcedimientos },
      { $group: { _id: '$tipoProcedimiento', total: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    Procedimiento.find(filtroProcedimientos)
      .select('etapaActual cronograma.estado cronograma.noAplica cronograma.fechaPlaneada hojaDeTrabajoEtapas.estado hojaDeTrabajoEtapas.fechaPlaneada')
      .lean(),
  ]);

  const conteoEtapas = {};
  for (const proc of procedimientosConEtapas) {
    let etapa = proc.etapaActual || 'cronograma';
    if (etapa === 'cronograma') {
      const cron = proc.cronograma || [];
      const completo = cron.length > 0 && cron.every((e) => e.noAplica === true || e.estado === 'completado');
      if (completo) etapa = 'hoja_de_trabajo';
    }
    conteoEtapas[etapa] = (conteoEtapas[etapa] || 0) + 1;
  }

  const totalProcedimientos = procedimientosConEtapas.length;
  const { etapasVencidas, etapasProximasAVencer } = calcularAlertasEtapas(procedimientosConEtapas);

  return {
    totalProcedimientos,
    totalUrgentes,
    porEtapaActual: conteoEtapas,
    porTipoProcedimiento: Object.fromEntries(porTipoProcedimiento.map((e) => [e._id, e.total])),
    porSubdireccion: agrupacion === 'subdireccion' ? porGrupo : [],
    porSeccion: agrupacion === 'seccion' ? porGrupo : [],
    porAsesor: agrupacion === 'asesor' ? porGrupo : [],
    alertas: { etapasVencidas, etapasProximasAVencer },
  };
}

function construirFiltroDashboard(usuario, anioFiscal) {
  const filtro = {};

  if (anioFiscal) filtro.anioFiscal = Number(anioFiscal);

  if (usuario?.rol === 'subdirector') {
    const subId = toObjectId(usuario.subdireccionId);
    if (!subId) throw crearError(400, 'SUBDIRECCION_NO_ASIGNADA', 'El usuario no tiene subdireccion asignada');
    filtro.subdireccion = subId;
  }

  if (usuario?.rol === 'jefe_seccion') {
    const secId = toObjectId(usuario.seccionId);
    if (!secId) throw crearError(400, 'SECCION_NO_ASIGNADA', 'El usuario no tiene seccion asignada');
    filtro.seccion = secId;
  }

  return filtro;
}

// -------------------------------------------------------
// GET /api/v1/dashboard/resumen
// Roles: oficialia_mayor, dir_gral_admon, administrador
// -------------------------------------------------------
async function resumen(req, res, next) {
  try {
    const { anioFiscal } = req.query;
    const filtro = construirFiltroDashboard(req.usuario, anioFiscal);
    const rol = req.usuario?.rol;
    const agrupacion = rol === 'subdirector' ? 'seccion' : rol === 'jefe_seccion' ? 'asesor' : 'subdireccion';
    const datos = await construirResumen(filtro, { agrupacion });
    return ok(res, datos, 'Resumen general obtenido');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /api/v1/dashboard/por-dg/:dgId
// Roles: oficialia_mayor, dir_gral_admon, administrador
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
// Roles: asesor_tecnico, integrante_adquisiciones, administrador
// -------------------------------------------------------
async function misProcedimientos(req, res, next) {
  try {
    const { rol, id: usuarioId, subdireccionId, seccionId } = req.usuario;
    const { etapaActual, urgente, anioFiscal, q, tipoProcedimiento, dgId: dgIdQuery, subdireccionId: subIdQuery, seccionId: secIdQuery } = req.query;

    // Filtro base segun rol
    let filtroBase = {};
    if (rol === 'asesor_tecnico') {
      filtroBase = { $or: [{ asesorTitular: usuarioId }, { asesorSuplente: usuarioId }] };
    } else if (rol === 'subdirector') {
      const subId = toObjectId(subdireccionId);
      if (!subId) throw crearError(400, 'SUBDIRECCION_NO_ASIGNADA', 'El usuario no tiene subdireccion asignada');
      filtroBase = { subdireccion: subId };
    } else if (rol === 'jefe_seccion') {
      const secId = toObjectId(seccionId);
      if (!secId) throw crearError(400, 'SECCION_NO_ASIGNADA', 'El usuario no tiene seccion asignada');
      filtroBase = { seccion: secId };
    }
    // administrador ve todos — filtroBase vacio

    if (dgIdQuery) {
      if (!['administrador', 'adquisiciones'].includes(rol)) throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permiso para filtrar por organismo');
      const dgObjectId = toObjectId(dgIdQuery);
      if (!dgObjectId) throw crearError(400, 'DG_NO_VALIDA', 'Organismo no valido');
      filtroBase.direccionGeneral = dgObjectId;
    }

    if (subIdQuery) {
      if (!['administrador', 'adquisiciones'].includes(rol)) throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permiso para filtrar por subdireccion');
      const subObjectId = toObjectId(subIdQuery);
      if (!subObjectId) throw crearError(400, 'SUBDIRECCION_NO_VALIDA', 'Subdireccion no valida');
      filtroBase.subdireccion = subObjectId;
    }

    if (secIdQuery) {
      if (!['administrador', 'adquisiciones'].includes(rol)) throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permiso para filtrar por seccion');
      const secObjectId = toObjectId(secIdQuery);
      if (!secObjectId) throw crearError(400, 'SECCION_NO_VALIDA', 'Seccion no valida');
      filtroBase.seccion = secObjectId;
    }

    if (etapaActual) filtroBase.etapaActual = etapaActual;
    if (urgente !== undefined) filtroBase.urgente = urgente === 'true';
    if (anioFiscal) filtroBase.anioFiscal = Number(anioFiscal);
    if (tipoProcedimiento) filtroBase.tipoProcedimiento = tipoProcedimiento;
    if (q) {
      const qEscapado = escaparRegex(String(q).slice(0, 100));
      const qOr = [
        { numeroProcedimiento: { $regex: qEscapado, $options: 'i' } },
        { titulo: { $regex: qEscapado, $options: 'i' } },
      ];
      if (filtroBase.$or) {
        const orExistente = filtroBase.$or;
        delete filtroBase.$or;
        filtroBase.$and = [...(filtroBase.$and || []), { $or: orExistente }, { $or: qOr }];
      } else {
        filtroBase.$or = qOr;
      }
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const hoy = HOY();
    const enTresDias = EN_TRES_DIAS();

    const [procedimientos, total] = await Promise.all([
      Procedimiento.find(filtroBase)
        .populate('bienServicio', 'clave descripcion')
        .populate('direccionGeneral', 'nombre siglas')
        .populate('subdireccion', 'nombre')
        .populate('seccion', 'nombre subdireccion')
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

// -------------------------------------------------------
// GET /api/v1/dashboard/kpi-detalle?tipo=urgentes|vencidas|proximas|total&anioFiscal=
// Roles: oficialia_mayor, dir_gral_admon, administrador
// -------------------------------------------------------
async function kpiDetalle(req, res, next) {
  try {
    const { tipo, anioFiscal } = req.query;
    const filtroBase = construirFiltroDashboard(req.usuario, anioFiscal);

    const CAMPOS_BASE = 'numeroProcedimiento titulo tipoProcedimiento etapaActual urgente direccionGeneral asesorTitular';
    const POPULATE_OPTIONS = [
      { path: 'direccionGeneral', select: 'nombre siglas' },
      { path: 'asesorTitular', select: 'nombre apellidos' },
    ];

    let resultado = [];

    if (tipo === 'total') {
      resultado = await Procedimiento.find(filtroBase)
        .populate(POPULATE_OPTIONS)
        .select(CAMPOS_BASE)
        .sort({ urgente: -1, createdAt: -1 })
        .limit(100)
        .lean();

    } else if (tipo === 'urgentes') {
      resultado = await Procedimiento.find({ ...filtroBase, urgente: true })
        .populate(POPULATE_OPTIONS)
        .select(CAMPOS_BASE)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    } else if (tipo === 'vencidas' || tipo === 'proximas') {
      const hoy = HOY();
      const enTresDias = EN_TRES_DIAS();

      const todosProcs = await Procedimiento.find({
        ...filtroBase,
        etapaActual: { $nin: ['concluido', 'cancelado'] },
      })
        .populate(POPULATE_OPTIONS)
        .select(`${CAMPOS_BASE} cronograma.estado cronograma.fechaPlaneada cronograma.nombre hojaDeTrabajoEtapas.estado hojaDeTrabajoEtapas.fechaPlaneada hojaDeTrabajoEtapas.nombre`)
        .lean();

      resultado = todosProcs
        .map((proc) => {
          const todasEtapas = [...(proc.cronograma || []), ...(proc.hojaDeTrabajoEtapas || [])];
          const etapasRelevantes = todasEtapas
            .filter((e) => ESTADOS_ACTIVOS.includes(e.estado) && e.fechaPlaneada)
            .filter((e) => {
              const fecha = new Date(e.fechaPlaneada);
              return tipo === 'vencidas' ? fecha < hoy : (fecha >= hoy && fecha <= enTresDias);
            })
            .map((e) => ({ nombre: e.nombre, fechaPlaneada: e.fechaPlaneada }));

          if (etapasRelevantes.length === 0) return null;

          const { cronograma, hojaDeTrabajoEtapas, ...resto } = proc;
          return { ...resto, etapasRelevantes };
        })
        .filter(Boolean);

    } else {
      throw crearError(400, 'TIPO_INVALIDO', 'Tipo de KPI no reconocido. Use: total, urgentes, vencidas, proximas');
    }

    return ok(res, resultado, 'Detalle KPI obtenido');
  } catch (error) {
    next(error);
  }
}

module.exports = { resumen, porDG, misProcedimientos, kpiDetalle };
