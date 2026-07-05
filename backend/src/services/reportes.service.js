'use strict';

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Procedimiento } = require('../models/procedimiento.model');

// -------------------------------------------------------
// Etiquetas de display
// -------------------------------------------------------
const ETIQUETA_ETAPA = {
  cronograma: 'Cronograma',
  hoja_de_trabajo: 'Hoja de Trabajo',
  entregas: 'Entregas',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
};

const ETIQUETA_TIPO = {
  licitacion_publica_nacional: 'Licitacion Publica Nacional',
  licitacion_publica_internacional_libre: 'LP Internacional Libre',
  licitacion_publica_internacional_tratados: 'LP Internacional Tratados',
  invitacion_tres_personas: 'Invitacion a Tres Personas',
  adjudicacion_directa: 'Adjudicacion Directa',
};

const COLUMNAS_EXCEL = [
  { header: 'No. Procedimiento', key: 'numeroProcedimiento', width: 22 },
  { header: 'Anio Fiscal', key: 'anioFiscal', width: 12 },
  { header: 'Titulo', key: 'titulo', width: 40 },
  { header: 'Tipo de Procedimiento', key: 'tipoProcedimiento', width: 30 },
  { header: 'Direccion General', key: 'direccionGeneral', width: 25 },
  { header: 'Asesor Tecnico Titular', key: 'asesorTitular', width: 28 },
  { header: 'Asesor Tecnico Suplente', key: 'asesorSuplente', width: 28 },
  { header: 'Etapa Actual', key: 'etapaActual', width: 18 },
  { header: 'Urgente', key: 'urgente', width: 10 },
  { header: 'Bien / Servicio', key: 'bienServicio', width: 30 },
  { header: 'Monto Estimado (MXN)', key: 'montoEstimado', width: 22 },
  { header: 'Justificacion Tipo', key: 'justificacionTipo', width: 35 },
  { header: 'Fecha Creacion', key: 'createdAt', width: 18 },
];

// -------------------------------------------------------
// Construye el filtro Mongoose a partir de los query params
// -------------------------------------------------------
function construirFiltro(query) {
  const { anioFiscal, dgId, tipoProcedimiento, etapaActual, urgente, subdireccionId, seccionId, procedimientoId } = query;
  const filtro = {};
  if (procedimientoId) filtro._id = procedimientoId;
  if (anioFiscal) filtro.anioFiscal = Number(anioFiscal);
  if (dgId) filtro.direccionGeneral = dgId;
  if (subdireccionId) filtro.subdireccion = subdireccionId;
  if (seccionId) filtro.seccion = seccionId;
  if (tipoProcedimiento) filtro.tipoProcedimiento = tipoProcedimiento;
  if (etapaActual) filtro.etapaActual = etapaActual;
  if (urgente !== undefined) filtro.urgente = urgente === 'true';
  return filtro;
}

// -------------------------------------------------------
// Obtiene los procedimientos con populate completo
// -------------------------------------------------------
async function obtenerProcedimientos(filtro) {
  return Procedimiento.find(filtro)
    .populate('direccionGeneral', 'nombre siglas')
    .populate('subdireccion', 'nombre')
    .populate('seccion', 'nombre')
    .populate('asesorTitular', 'nombre apellidos')
    .populate('asesorSuplente', 'nombre apellidos')
    .populate('bienServicio', 'clave descripcion')
    .select('-cronograma -hojaDeTrabajoEtapas -entregas -evidenciaJustificacion -contrato')
    .sort({ direccionGeneral: 1, subdireccion: 1, seccion: 1, createdAt: -1 })
    .lean();
}

// -------------------------------------------------------
// Descripcion textual de los filtros aplicados
// -------------------------------------------------------
function textoFiltros(query) {
  const partes = [];
  if (query.anioFiscal) partes.push(`Anio: ${query.anioFiscal}`);
  if (query.tipoProcedimiento) partes.push(`Tipo: ${ETIQUETA_TIPO[query.tipoProcedimiento] || query.tipoProcedimiento}`);
  if (query.etapaActual) partes.push(`Etapa: ${ETIQUETA_ETAPA[query.etapaActual] || query.etapaActual}`);
  if (query.urgente !== undefined) partes.push(`Urgente: ${query.urgente === 'true' ? 'Si' : 'No'}`);
  return partes.length ? partes.join('   |   ') : 'Sin filtros aplicados';
}

// -------------------------------------------------------
// Mapea un procedimiento a la fila de Excel
// -------------------------------------------------------
function mapearFila(proc) {
  return {
    numeroProcedimiento: proc.numeroProcedimiento || '',
    anioFiscal: proc.anioFiscal,
    titulo: proc.titulo,
    tipoProcedimiento: ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento,
    direccionGeneral: proc.direccionGeneral
      ? `${proc.direccionGeneral.siglas} - ${proc.direccionGeneral.nombre}`
      : '',
    asesorTitular: proc.asesorTitular
      ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}`
      : '',
    asesorSuplente: proc.asesorSuplente
      ? `${proc.asesorSuplente.nombre} ${proc.asesorSuplente.apellidos}`
      : '',
    etapaActual: ETIQUETA_ETAPA[proc.etapaActual] || proc.etapaActual,
    urgente: proc.urgente ? 'Si' : 'No',
    bienServicio: proc.bienServicio
      ? `${proc.bienServicio.clave} - ${proc.bienServicio.descripcion}`
      : '',
    montoEstimado: proc.montoEstimado ?? '',
    justificacionTipo: proc.justificacionTipo || '',
    createdAt: proc.createdAt ? new Date(proc.createdAt).toLocaleDateString('es-MX') : '',
  };
}

function nombreUsuario(usuario) {
  if (!usuario) return 'Sin asignar';
  return [usuario.nombre, usuario.apellidos].filter(Boolean).join(' ') || 'Sin asignar';
}

function truncarTexto(valor, limite = 120) {
  const texto = String(valor || '').trim();
  if (!texto) return 'No capturado';
  return texto.length > limite ? `${texto.slice(0, limite - 1)}…` : texto;
}

function formatoMoneda(valor, moneda = 'MXN') {
  if (valor === null || valor === undefined || valor === '') return 'No capturado';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda || 'MXN',
    maximumFractionDigits: 0,
  }).format(Number(valor));
}

function etapasAplicables(lista = []) {
  return lista.filter((etapa) => !etapa.noAplica);
}

function contarEntregasRecibidas(entregas = []) {
  return entregas.filter((entrega) => entrega.estado === 'recibida').length;
}

function etapasCompletadas(lista = []) {
  const aplicables = etapasAplicables(lista);
  return aplicables.filter((etapa) => etapa.estado === 'completado').length;
}

function obtenerEtapaVisual(proc) {
  if (proc.etapaActual === 'cancelado' || proc.etapaActual === 'concluido') return proc.etapaActual;

  const cronograma = etapasAplicables(proc.cronograma || []);
  const hoja = etapasAplicables(proc.hojaDeTrabajoEtapas || []);
  const entregas = proc.entregas || [];

  let etapaVisual = proc.etapaActual;
  if (etapaVisual === 'cronograma' && cronograma.length > 0 && cronograma.every((etapa) => etapa.estado === 'completado')) {
    etapaVisual = 'hoja_de_trabajo';
  }
  if (etapaVisual === 'hoja_de_trabajo' && hoja.length > 0 && hoja.every((etapa) => etapa.estado === 'completado')) {
    etapaVisual = 'entregas';
  }
  if (etapaVisual === 'entregas' && entregas.length > 0 && entregas.every((entrega) => entrega.estado === 'recibida')) {
    etapaVisual = 'concluido';
  }

  return etapaVisual;
}

function obtenerResumenProcedimiento(proc) {
  const cronograma = etapasAplicables(proc.cronograma || []);
  const hoja = etapasAplicables(proc.hojaDeTrabajoEtapas || []);
  const entregas = proc.entregas || [];

  const cronogramaCompletadas = etapasCompletadas(cronograma);
  const hojaCompletadas = etapasCompletadas(hoja);
  const entregasRecibidas = contarEntregasRecibidas(entregas);
  const totalElementos = cronograma.length + hoja.length + entregas.length;
  const completados = cronogramaCompletadas + hojaCompletadas + entregasRecibidas;
  const etapaVisual = obtenerEtapaVisual(proc);

  return {
    etapaVisual,
    avance: proc.etapaActual === 'concluido' ? 100 : Math.round((completados / Math.max(totalElementos, 1)) * 100),
    cronogramaTotal: cronograma.length,
    cronogramaCompletadas,
    hojaTotal: hoja.length,
    hojaCompletadas,
    entregasTotal: entregas.length,
    entregasRecibidas,
  };
}

async function obtenerProcedimientoDetalle(procedimientoId) {
  return Procedimiento.findById(procedimientoId)
    .populate('direccionGeneral', 'nombre siglas')
    .populate('subdireccion', 'nombre')
    .populate('seccion', 'nombre')
    .populate('asesorTitular', 'nombre apellidos')
    .populate('asesorSuplente', 'nombre apellidos')
    .populate('bienServicio', 'clave descripcion')
    .lean();
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
  const valueText = String(value);
  const valueFontSize = valueText.length > 18 ? 10 : valueText.length > 12 ? 11 : 17;

  dibujarTarjeta(doc, x, y, width, height, { fill, stroke: fill });
  doc
    .save()
    .roundedRect(x, y, 6, height, 6)
    .fill(accent)
    .restore();

  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7)
    .text(label.toUpperCase(), x + 12, y + 10, { width: width - 22 });

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(valueFontSize)
    .text(valueText, x + 12, y + (valueFontSize >= 17 ? 23 : 26), {
      width: width - 22,
      lineGap: 1,
    });
}

function dibujarDato(doc, x, y, width, height, { label, value, fill = '#ffffff', stroke = '#e2e8f0' }) {
  dibujarTarjeta(doc, x, y, width, height, { fill, stroke, radius: 12 });

  doc
    .fillColor('#94a3b8')
    .font('Helvetica-Bold')
    .fontSize(7)
    .text(label.toUpperCase(), x + 12, y + 10, { width: width - 24 });

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(value || '-', x + 12, y + 24, { width: width - 24, lineGap: 1 });
}

function calcularAlturaDato(doc, width, value) {
  doc.font('Helvetica-Bold').fontSize(11);
  const valueH = doc.heightOfString(value || '-', { width: width - 24, lineGap: 1 });
  return Math.max(52, 24 + valueH + 12);
}

function estiloMacro(status) {
  if (status === 'completed') {
    return { fill: '#ecfdf5', stroke: '#86efac', color: '#15803d', line: '#22c55e', badge: 'Completada' };
  }
  if (status === 'current') {
    return { fill: '#eff6ff', stroke: '#93c5fd', color: '#1d4ed8', line: '#60a5fa', badge: 'Actual' };
  }
  return { fill: '#f8fafc', stroke: '#cbd5e1', color: '#64748b', line: '#cbd5e1', badge: 'Pendiente' };
}

function construirLineaTiempo(proc, resumen) {
  const etapaActual = resumen.etapaVisual;
  const etapaIndex = ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido'].indexOf(etapaActual === 'cancelado' ? 'cronograma' : etapaActual);

  const resumenPorEtapa = {
    cronograma: `${resumen.cronogramaCompletadas}/${resumen.cronogramaTotal || 0} etapas`,
    hoja_de_trabajo: `${resumen.hojaCompletadas}/${resumen.hojaTotal || 0} etapas`,
    entregas: `${resumen.entregasRecibidas}/${resumen.entregasTotal || 0} entregas`,
    concluido: proc.etapaActual === 'concluido' ? 'Cierre registrado' : 'Pendiente de cierre',
  };

  return ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido'].map((etapa, index) => {
    let status = 'pending';
    if (proc.etapaActual === 'concluido') {
      status = 'completed';
    } else if (index < etapaIndex) {
      status = 'completed';
    } else if (index === etapaIndex) {
      status = 'current';
    }

    return {
      label: ETIQUETA_ETAPA[etapa],
      resumen: resumenPorEtapa[etapa],
      status,
    };
  });
}

function dibujarLineaTiempo(doc, x, y, width, items) {
  const gap = 8;
  const itemWidth = (width - gap * (items.length - 1)) / items.length;
  const itemHeight = 70;
  const lineY = y + 14;

  items.forEach((item, index) => {
    const estilo = estiloMacro(item.status);
    const itemX = x + index * (itemWidth + gap);

    if (index < items.length - 1) {
      const siguiente = estiloMacro(items[index + 1].status);
      doc
        .save()
        .lineCap('round')
        .lineWidth(3)
        .strokeColor(item.status === 'pending' && items[index + 1].status === 'pending' ? '#e2e8f0' : siguiente.line)
        .moveTo(itemX + itemWidth - 6, lineY)
        .lineTo(itemX + itemWidth + gap + 6, lineY)
        .stroke()
        .restore();
    }

    dibujarTarjeta(doc, itemX, y + 8, itemWidth, itemHeight, {
      fill: estilo.fill,
      stroke: estilo.stroke,
      radius: 12,
    });

    doc.save().circle(itemX + 16, lineY, 6).fill(estilo.color).restore();

    doc
      .fillColor('#0f172a')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text(item.label, itemX + 10, y + 25, { width: itemWidth - 20, align: 'center' });

    doc
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(7)
      .text(item.resumen, itemX + 10, y + 40, { width: itemWidth - 20, align: 'center' });

    doc.save().roundedRect(itemX + 20, y + 57, itemWidth - 40, 11, 6).fill('#ffffff').restore();
    doc
      .fillColor(estilo.color)
      .font('Helvetica-Bold')
      .fontSize(6)
      .text(estilo.badge.toUpperCase(), itemX + 24, y + 60, {
        width: itemWidth - 48,
        align: 'center',
      });
  });

  doc.y = y + itemHeight + 14;
}

function generarPDFProcedimiento(doc, proc, query) {
  const resumen = obtenerResumenProcedimiento(proc);
  const lineaTiempo = construirLineaTiempo(proc, resumen);
  const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const startX = doc.page.margins.left;
  const cardGap = 8;

  const headerY = doc.y;
  doc.font('Helvetica').fontSize(9);
  const tituloH = doc.heightOfString(truncarTexto(proc.titulo || 'Procedimiento sin titulo', 160), { width: pageWidth - 30, lineGap: 1 });
  const headerHeight = Math.max(84, 58 + tituloH);

  dibujarTarjeta(doc, startX, headerY, pageWidth, headerHeight, {
    fill: '#0f172a',
    stroke: '#0f172a',
    radius: 16,
  });

  doc
    .fillColor('#bfdbfe')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('RESUMEN EJECUTIVO DEL PROCEDIMIENTO', startX + 14, headerY + 10, { width: pageWidth - 180 });

  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(15)
    .text(proc.numeroProcedimiento || 'Procedimiento sin numero', startX + 14, headerY + 23, {
      width: pageWidth - 160,
    });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#e2e8f0')
    .text(truncarTexto(proc.titulo || 'Sin titulo', 160), startX + 14, headerY + 42, { width: pageWidth - 28, lineGap: 1 });

  doc
    .fillColor('#93c5fd')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(`Generado: ${new Date().toLocaleString('es-MX')}`, startX + 14, headerY + headerHeight - 16, {
      width: pageWidth - 28,
    });

  doc
    .save()
    .roundedRect(startX + pageWidth - 122, headerY + 10, 108, 24, 12)
    .fill('#1d4ed8')
    .restore();
  doc
    .fillColor('#ffffff')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(ETIQUETA_ETAPA[resumen.etapaVisual] || resumen.etapaVisual, startX + pageWidth - 116, headerY + 18, {
      width: 96,
      align: 'center',
    });

  doc.y = headerY + headerHeight + 10;

  const kpiWidth = (pageWidth - cardGap * 3) / 4;
  const kpiHeight = 50;
  const kpiY = doc.y;

  dibujarKpi(doc, startX, kpiY, kpiWidth, kpiHeight, {
    label: 'Avance general',
    value: `${resumen.avance}%`,
    accent: '#0f766e',
    fill: '#ecfeff',
  });
  dibujarKpi(doc, startX + kpiWidth + cardGap, kpiY, kpiWidth, kpiHeight, {
    label: 'Cronograma',
    value: `${resumen.cronogramaCompletadas}/${resumen.cronogramaTotal || 0}`,
    accent: '#2563eb',
    fill: '#eff6ff',
  });
  dibujarKpi(doc, startX + (kpiWidth + cardGap) * 2, kpiY, kpiWidth, kpiHeight, {
    label: 'Hoja de trabajo',
    value: `${resumen.hojaCompletadas}/${resumen.hojaTotal || 0}`,
    accent: '#7c3aed',
    fill: '#f5f3ff',
  });
  dibujarKpi(doc, startX + (kpiWidth + cardGap) * 3, kpiY, kpiWidth, kpiHeight, {
    label: 'Entregas',
    value: `${resumen.entregasRecibidas}/${resumen.entregasTotal || 0}`,
    accent: '#15803d',
    fill: '#ecfdf5',
  });

  doc.y = kpiY + kpiHeight + 10;

  const dataWidth = (pageWidth - cardGap) / 2;

  const areaResponsable = [
    proc.direccionGeneral ? `${proc.direccionGeneral.siglas || ''} ${proc.direccionGeneral.nombre || ''}`.trim() : '',
    proc.subdireccion?.nombre,
    proc.seccion?.nombre,
  ].filter(Boolean).join(' / ') || 'No capturada';

  const bienServicio = proc.bienServicio
    ? `${proc.bienServicio.clave} - ${proc.bienServicio.descripcion}`
    : 'No capturado';

  const dataRow1Y = doc.y;
  const dataRow1H = Math.max(
    calcularAlturaDato(doc, dataWidth, truncarTexto(ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento, 72)),
    calcularAlturaDato(doc, dataWidth, formatoMoneda(proc.montoEstimado, proc.moneda))
  );
  dibujarDato(doc, startX, dataRow1Y, dataWidth, dataRow1H, {
    label: 'Tipo de procedimiento',
    value: truncarTexto(ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento, 72),
  });
  dibujarDato(doc, startX + dataWidth + cardGap, dataRow1Y, dataWidth, dataRow1H, {
    label: 'Monto estimado',
    value: formatoMoneda(proc.montoEstimado, proc.moneda),
  });

  doc.y = dataRow1Y + dataRow1H + 6;

  const dataRow2Y = doc.y;
  const dataRow2H = Math.max(
    calcularAlturaDato(doc, dataWidth, truncarTexto(areaResponsable, 110)),
    calcularAlturaDato(doc, dataWidth, truncarTexto(bienServicio, 110))
  );
  dibujarDato(doc, startX, dataRow2Y, dataWidth, dataRow2H, {
    label: 'Area responsable',
    value: truncarTexto(areaResponsable, 110),
  });
  dibujarDato(doc, startX + dataWidth + cardGap, dataRow2Y, dataWidth, dataRow2H, {
    label: 'Bien / servicio',
    value: truncarTexto(bienServicio, 110),
  });

  doc.y = dataRow2Y + dataRow2H + 6;

  const dataRow3Y = doc.y;
  const asesorTitular = nombreUsuario(proc.asesorTitular);
  const asesorSuplente = nombreUsuario(proc.asesorSuplente);
  const dataRow3H = Math.max(
    calcularAlturaDato(doc, dataWidth, truncarTexto(asesorTitular, 72)),
    calcularAlturaDato(doc, dataWidth, truncarTexto(asesorSuplente, 72))
  );
  dibujarDato(doc, startX, dataRow3Y, dataWidth, dataRow3H, {
    label: 'Asesor titular',
    value: truncarTexto(asesorTitular, 72),
  });
  dibujarDato(doc, startX + dataWidth + cardGap, dataRow3Y, dataWidth, dataRow3H, {
    label: 'Asesor suplente',
    value: truncarTexto(asesorSuplente, 72),
  });

  doc.y = dataRow3Y + dataRow3H + 8;

  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Linea del tiempo del procedimiento');
  doc.moveDown(0.2);

  dibujarLineaTiempo(doc, startX, doc.y, pageWidth, lineaTiempo);

  const resumenY = doc.y;
  const resumenHeight = 72;
  dibujarTarjeta(doc, startX, resumenY, pageWidth, resumenHeight, {
    fill: '#ffffff',
    stroke: '#e2e8f0',
    radius: 14,
  });

  doc
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7)
    .text('RESUMEN DE ESTADO', startX + 12, resumenY + 10);
  doc
    .fillColor('#0f172a')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text(`${ETIQUETA_ETAPA[resumen.etapaVisual] || resumen.etapaVisual}${proc.urgente ? '  |  URGENTE' : ''}`, startX + 12, resumenY + 22, {
      width: pageWidth - 24,
    });
  doc
    .fillColor('#334155')
    .font('Helvetica')
    .fontSize(9)
    .text(
      `Cronograma ${resumen.cronogramaCompletadas}/${resumen.cronogramaTotal || 0}   |   ` +
      `Hoja de trabajo ${resumen.hojaCompletadas}/${resumen.hojaTotal || 0}   |   ` +
      `Entregas ${resumen.entregasRecibidas}/${resumen.entregasTotal || 0}`,
      startX + 12,
      resumenY + 40,
      { width: pageWidth - 24 }
    )
    .text(
      `Fecha de creacion: ${proc.createdAt ? new Date(proc.createdAt).toLocaleDateString('es-MX') : 'Sin fecha'}`
      + (proc.justificacionTipo ? `   |   Justificacion: ${truncarTexto(proc.justificacionTipo, 70)}` : ''),
      startX + 12,
      resumenY + 54,
      { width: pageWidth - 24 }
    );

  doc.y = resumenY + resumenHeight + 8;
}

// -------------------------------------------------------
// GENERADOR PDF — resumen ejecutivo
// -------------------------------------------------------
async function generarPDF(query, res) {
  const filtro = construirFiltro(query);
  const procedimientos = await obtenerProcedimientos(filtro);
  const procedimientoDetalle = query.procedimientoId && procedimientos.length === 1
    ? await obtenerProcedimientoDetalle(query.procedimientoId)
    : null;

  const doc = new PDFDocument({ margin: procedimientoDetalle ? 34 : 50, size: 'LETTER' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="SSA-reporte-${Date.now()}.pdf"`
  );
  doc.pipe(res);

  if (procedimientoDetalle) {
    generarPDFProcedimiento(doc, procedimientoDetalle, query);
    doc.end();
    return;
  }

  // --- Encabezado ---
  doc
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Sistema de Seguimiento de Adquisiciones', { align: 'center' })
    .moveDown(0.3)
    .fontSize(13)
    .text('Reporte Ejecutivo de Procedimientos', { align: 'center' })
    .moveDown(0.3)
    .fontSize(9)
    .font('Helvetica')
    .text(`Generado: ${new Date().toLocaleString('es-MX')}`, { align: 'center' })
    .moveDown(0.3)
    .text(`Filtros: ${textoFiltros(query)}`, { align: 'center' })
    .moveDown(1);

  // --- Bloque de totales ---
  const totalUrgentes = procedimientos.filter((p) => p.urgente).length;
  const porEtapa = {};
  for (const p of procedimientos) {
    porEtapa[p.etapaActual] = (porEtapa[p.etapaActual] || 0) + 1;
  }

  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Resumen', { underline: true })
    .moveDown(0.4)
    .font('Helvetica')
    .fontSize(10)
    .text(`Total de procedimientos: ${procedimientos.length}`)
    .text(`Procedimientos urgentes: ${totalUrgentes}`);

  for (const [etapa, total] of Object.entries(porEtapa)) {
    doc.text(`  ${ETIQUETA_ETAPA[etapa] || etapa}: ${total}`);
  }

  doc.moveDown(1);

  // --- Tabla de procedimientos ---
  doc.fontSize(11).font('Helvetica-Bold').text('Detalle de Procedimientos', { underline: true }).moveDown(0.5);

  if (procedimientos.length === 0) {
    doc.font('Helvetica').fontSize(10).text('No se encontraron procedimientos con los filtros aplicados.');
  } else {
    for (const proc of procedimientos) {
      // Cabecera de cada registro
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          `${proc.numeroProcedimiento || 'S/N'}  ${proc.urgente ? '[URGENTE]' : ''}`,
          { continued: false }
        )
        .font('Helvetica')
        .fontSize(9)
        .text(`Titulo: ${proc.titulo}`)
        .text(`Tipo: ${ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento}`)
        .text(
          `DG: ${proc.direccionGeneral ? proc.direccionGeneral.siglas : 'N/A'}   ` +
          `Etapa: ${ETIQUETA_ETAPA[proc.etapaActual] || proc.etapaActual}`
        )
        .text(
          `AT Titular: ${proc.asesorTitular ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}` : 'Sin asignar'}`
        );

      if (proc.montoEstimado) {
        doc.text(
          `Monto estimado: $${Number(proc.montoEstimado).toLocaleString('es-MX')} ${proc.moneda || 'MXN'}`
        );
      }

      doc
        .moveDown(0.4)
        .strokeColor('#cccccc')
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(562, doc.y)
        .stroke()
        .moveDown(0.4);

      // Salto de pagina si queda poco espacio
      if (doc.y > 700) doc.addPage();
    }
  }

  // --- Pie de pagina ---
  doc
    .moveDown(1)
    .fontSize(8)
    .fillColor('#888888')
    .text(
      'Documento generado automaticamente. No requiere firma.',
      { align: 'center' }
    );

  doc.end();
}

// -------------------------------------------------------
// GENERADOR EXCEL — tabla completa
// -------------------------------------------------------
async function generarExcel(query, res) {
  const filtro = construirFiltro(query);
  const procedimientos = await obtenerProcedimientos(filtro);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SSA';
  workbook.created = new Date();

  const hoja = workbook.addWorksheet('Procedimientos', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // --- Fila 1: titulo ---
  hoja.mergeCells('A1', `M1`);
  const celdaTitulo = hoja.getCell('A1');
  celdaTitulo.value = 'Sistema de Seguimiento de Adquisiciones — Reporte de Procedimientos';
  celdaTitulo.font = { bold: true, size: 13 };
  celdaTitulo.alignment = { horizontal: 'center' };

  // --- Fila 2: filtros y fecha ---
  hoja.mergeCells('A2', 'M2');
  const celdaFiltros = hoja.getCell('A2');
  celdaFiltros.value = `Generado: ${new Date().toLocaleString('es-MX')}   |   ${textoFiltros(query)}`;
  celdaFiltros.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
  celdaFiltros.alignment = { horizontal: 'center' };

  // --- Fila 3: encabezados de columna ---
  hoja.getRow(3).height = 20;
  hoja.columns = COLUMNAS_EXCEL;

  const filaEncabezado = hoja.getRow(3);
  filaEncabezado.values = COLUMNAS_EXCEL.map((c) => c.header);
  filaEncabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = {
      bottom: { style: 'thin', color: { argb: 'FF999999' } },
    };
  });

  // --- Filas de datos ---
  for (const proc of procedimientos) {
    const fila = hoja.addRow(mapearFila(proc));

    // Resaltar urgentes
    if (proc.urgente) {
      fila.eachCell((celda) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
      });
    }

    // Alineacion de columna monto
    fila.getCell('montoEstimado').alignment = { horizontal: 'right' };
    if (proc.montoEstimado) {
      fila.getCell('montoEstimado').numFmt = '"$"#,##0.00';
    }

    fila.getCell('urgente').alignment = { horizontal: 'center' };
    fila.getCell('anioFiscal').alignment = { horizontal: 'center' };
  }

  // --- Auto-filtro en encabezados ---
  hoja.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: COLUMNAS_EXCEL.length },
  };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="SSA-reporte-${Date.now()}.xlsx"`
  );

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { generarPDF, generarExcel, construirFiltro };
