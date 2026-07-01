'use strict';

const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Procedimiento } = require('../models/procedimiento.model');

// ── Labels ────────────────────────────────────────────────────────────────────

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

const ESTADO_LABEL_PDF = {
  completado:           'Completado',
  activo:               'En proceso',
  pendiente:            'Pendiente',
  fecha_propuesta:      'Fecha propuesta',
  fecha_rechazada:      'Fecha rechazada',
  vencido:              'Vencido',
  completado_propuesto: 'Comp. propuesto',
  recibida:             'Recibida',
  rechazada:            'Rechazada',
  recibida_propuesta:   'Rec. propuesta',
};

// ── Colores PDF ───────────────────────────────────────────────────────────────

const ESTADO_BULLET = {
  completado:           '#16A34A',
  activo:               '#2563EB',
  pendiente:            '#94A3B8',
  fecha_propuesta:      '#D97706',
  fecha_rechazada:      '#DC2626',
  vencido:              '#DC2626',
  completado_propuesto: '#059669',
  recibida:             '#16A34A',
  rechazada:            '#DC2626',
  recibida_propuesta:   '#2563EB',
};

const ESTADO_BADGE = {
  completado:           { bg: '#D1FAE5', text: '#065F46' },
  activo:               { bg: '#DBEAFE', text: '#1E40AF' },
  pendiente:            { bg: '#F1F5F9', text: '#64748B' },
  fecha_propuesta:      { bg: '#FEF3C7', text: '#92400E' },
  fecha_rechazada:      { bg: '#FEE2E2', text: '#9B1C1C' },
  vencido:              { bg: '#FEE2E2', text: '#9B1C1C' },
  completado_propuesto: { bg: '#ECFDF5', text: '#059669' },
  recibida:             { bg: '#D1FAE5', text: '#065F46' },
  rechazada:            { bg: '#FEE2E2', text: '#9B1C1C' },
  recibida_propuesta:   { bg: '#DBEAFE', text: '#1E40AF' },
};

const SECCION_ACCENT = {
  cronograma:      '#2563EB',
  hoja_de_trabajo: '#7C3AED',
  entregas:        '#D97706',
};

const SECCION_BG = {
  cronograma:      '#EFF6FF',
  hoja_de_trabajo: '#F5F3FF',
  entregas:        '#FFFBEB',
};

// Layout constants (LETTER 612x792 pts, margin 50)
const ML  = 50;   // margin left
const MR  = 562;  // margin right (ML + 512)
const CW  = 512;  // content width

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFecha(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-MX');
}

function esVencidaEtapa(estado, fechaPlaneada) {
  const activos = ['pendiente', 'activo', 'fecha_propuesta', 'fecha_rechazada', 'completado_propuesto'];
  if (!activos.includes(estado) || !fechaPlaneada) return false;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return new Date(fechaPlaneada) < hoy;
}

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

async function obtenerProcedimientos(filtro) {
  return Procedimiento.find(filtro)
    .populate('subdireccion', 'nombre')
    .populate('seccion', 'nombre')
    .populate('asesorTitular', 'nombre apellidos')
    .populate('asesorSuplente', 'nombre apellidos')
    .populate('bienServicio', 'clave descripcion')
    .select('-evidenciaJustificacion -contrato')
    .sort({ subdireccion: 1, seccion: 1, createdAt: -1 })
    .lean();
}

function textoFiltros(query) {
  const partes = [];
  if (query.anioFiscal) partes.push(`Anio: ${query.anioFiscal}`);
  if (query.tipoProcedimiento) partes.push(`Tipo: ${ETIQUETA_TIPO[query.tipoProcedimiento] || query.tipoProcedimiento}`);
  if (query.etapaActual) partes.push(`Etapa: ${ETIQUETA_ETAPA[query.etapaActual] || query.etapaActual}`);
  if (query.urgente !== undefined) partes.push(`Urgente: ${query.urgente === 'true' ? 'Si' : 'No'}`);
  return partes.length ? partes.join('   |   ') : 'Sin filtros aplicados';
}

function mapearFila(proc) {
  return {
    numeroProcedimiento: proc.numeroProcedimiento || '',
    anioFiscal: proc.anioFiscal,
    titulo: proc.titulo,
    tipoProcedimiento: ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento,
    subdireccion: proc.subdireccion?.nombre || '',
    seccion: proc.seccion?.nombre || '',
    asesorTitular: proc.asesorTitular ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}` : '',
    asesorSuplente: proc.asesorSuplente ? `${proc.asesorSuplente.nombre} ${proc.asesorSuplente.apellidos}` : '',
    etapaActual: ETIQUETA_ETAPA[proc.etapaActual] || proc.etapaActual,
    urgente: proc.urgente ? 'Si' : 'No',
    bienServicio: proc.bienServicio ? `${proc.bienServicio.clave} - ${proc.bienServicio.descripcion}` : '',
    montoEstimado: proc.montoEstimado ?? '',
    justificacionTipo: proc.justificacionTipo || '',
    createdAt: proc.createdAt ? new Date(proc.createdAt).toLocaleDateString('es-MX') : '',
  };
}

// ── PDF helpers de bajo nivel ─────────────────────────────────────────────────

/** Rectángulo de cabecera azul marino con título y subtítulo */
function pdfHeader(doc, titulo, subtitulo) {
  const y0 = doc.y;
  doc.rect(ML, y0, CW, 52).fill('#0F2D5B');
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14)
    .text(titulo, ML + 14, y0 + 10, { width: CW - 28, lineBreak: false });
  if (subtitulo) {
    doc.font('Helvetica').fontSize(7.5).fillColor('#93C5FD')
      .text(subtitulo, ML + 14, y0 + 30, { width: CW - 28, lineBreak: false });
  }
  doc.fillColor('#000000');
  doc.y = y0 + 60;
}

/** Línea separadora gris */
function pdfSeparator(doc) {
  doc.save().strokeColor('#E5E7EB').lineWidth(0.5)
    .moveTo(ML, doc.y).lineTo(MR, doc.y).stroke().restore();
  doc.y += 8;
}

/** Encabezado de sección de la línea del tiempo (cronograma / hoja / entregas) */
function pdfSeccionTimeline(doc, tipo, label) {
  const accent = SECCION_ACCENT[tipo] || '#374151';
  const bg     = SECCION_BG[tipo]     || '#F9FAFB';
  const y0 = doc.y;
  doc.rect(ML, y0, CW, 22).fill(bg);
  doc.rect(ML, y0, 5, 22).fill(accent);
  doc.fillColor(accent).font('Helvetica-Bold').fontSize(9.5)
    .text(label, ML + 14, y0 + 7, { width: CW - 18, lineBreak: false });
  doc.fillColor('#000000');
  doc.y = y0 + 28;
}

/** Encabezados de columna para la tabla de etapas */
function pdfColHeaders(doc) {
  const y0 = doc.y;
  doc.fillColor('#9CA3AF').font('Helvetica-Bold').fontSize(7);
  doc.text('Etapa / Actividad',  ML + 20, y0, { width: 238, lineBreak: false });
  doc.text('Fecha planeada',     ML + 262, y0, { width: 80,  lineBreak: false });
  doc.text('Fecha real',         ML + 345, y0, { width: 80,  lineBreak: false });
  doc.text('Estado',             ML + 428, y0, { width: 84,  lineBreak: false });
  doc.fillColor('#000000');
  doc.save().strokeColor('#E5E7EB').lineWidth(0.3)
    .moveTo(ML + 20, doc.y + 2).lineTo(MR, doc.y + 2).stroke().restore();
  doc.y += 8;
}

/** Dibuja el badge de estado (pequeño rectángulo coloreado con texto) */
function pdfBadge(doc, x, y, estado) {
  const badge = ESTADO_BADGE[estado] || { bg: '#F1F5F9', text: '#64748B' };
  const label = ESTADO_LABEL_PDF[estado] || estado;
  const badgeW = 82;
  const badgeH = 12;
  doc.save().rect(x, y, badgeW, badgeH).fill(badge.bg).restore();
  doc.fillColor(badge.text).font('Helvetica-Bold').fontSize(6.5)
    .text(label, x + 3, y + 3, { width: badgeW - 6, lineBreak: false });
  doc.fillColor('#000000');
}

/** Dibuja una fila de etapa (cronograma / hoja de trabajo) */
function pdfEtapaRow(doc, etapa) {
  if (etapa.noAplica) {
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(8)
      .text(`   ${etapa.nombre}`, ML + 20, doc.y, { width: 238, lineBreak: false });
    doc.fillColor('#BFDBFE').font('Helvetica').fontSize(6.5)
      .text('No aplica', ML + 428, doc.y - (doc.currentLineHeight() || 10), { lineBreak: false });
    doc.fillColor('#000000');
    doc.y += 4;
    return;
  }

  const vencida = esVencidaEtapa(etapa.estado, etapa.fechaPlaneada);
  const bulletColor = ESTADO_BULLET[etapa.estado] || '#94A3B8';
  const nameColor   = vencida ? '#DC2626' : '#111827';

  const y0 = doc.y;

  // Bullet
  doc.save().circle(ML + 9, y0 + 5, 3.5).fill(bulletColor).restore();

  // Nombre (puede hacer wrap)
  doc.fillColor(nameColor).font('Helvetica').fontSize(8.5)
    .text(etapa.nombre, ML + 20, y0, { width: 238, lineBreak: true });
  const y1 = doc.y;
  const rowH = Math.max(y1 - y0, 13);

  // Fecha planeada
  const fpColor = vencida ? '#DC2626' : '#6B7280';
  doc.fillColor(fpColor).font('Helvetica').fontSize(8)
    .text(formatFecha(etapa.fechaPlaneada), ML + 262, y0, { width: 80, lineBreak: false });

  // Fecha real
  doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
    .text(etapa.fechaReal ? formatFecha(etapa.fechaReal) : '—', ML + 345, y0, { width: 80, lineBreak: false });

  // Badge
  pdfBadge(doc, ML + 428, y0, etapa.estado);

  doc.fillColor('#000000');
  doc.y = y0 + rowH + 5;
}

/** Dibuja una fila de entrega */
function pdfEntregaRow(doc, entrega, index) {
  const vencida = esVencidaEtapa(entrega.estado, entrega.fechaEstimada);
  const bulletColor = ESTADO_BULLET[entrega.estado] || '#94A3B8';
  const nameColor   = vencida ? '#DC2626' : '#111827';

  const y0 = doc.y;

  // Bullet / numero
  doc.save().circle(ML + 9, y0 + 5, 3.5).fill(bulletColor).restore();

  // Descripcion (puede hacer wrap)
  doc.fillColor(nameColor).font('Helvetica').fontSize(8.5)
    .text(`${index + 1}. ${entrega.descripcion}`, ML + 20, y0, { width: 238, lineBreak: true });
  const y1 = doc.y;
  const rowH = Math.max(y1 - y0, 13);

  // Fecha estimada
  const fpColor = vencida ? '#DC2626' : '#6B7280';
  doc.fillColor(fpColor).font('Helvetica').fontSize(8)
    .text(formatFecha(entrega.fechaEstimada), ML + 262, y0, { width: 80, lineBreak: false });

  // Fecha real
  doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
    .text(entrega.fechaReal ? formatFecha(entrega.fechaReal) : '—', ML + 345, y0, { width: 80, lineBreak: false });

  // Badge
  pdfBadge(doc, ML + 428, y0, entrega.estado);

  doc.fillColor('#000000');
  doc.y = y0 + rowH + 5;
}

/** Fila de info clave (label: valor en dos columnas) */
function pdfInfoRow(doc, label1, val1, label2, val2, yBase) {
  const lW = 72; const vW = 168;
  doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
    .text(`${label1}:`, ML, yBase, { width: lW, lineBreak: false });
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8)
    .text(val1 || '—', ML + lW + 2, yBase, { width: vW, lineBreak: false });
  if (label2 !== undefined) {
    doc.fillColor('#6B7280').font('Helvetica').fontSize(8)
      .text(`${label2}:`, ML + 262, yBase, { width: lW, lineBreak: false });
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8)
      .text(val2 || '—', ML + 262 + lW + 2, yBase, { width: vW, lineBreak: false });
  }
  doc.fillColor('#000000');
}

// ── Render procedimiento individual (con línea del tiempo) ────────────────────

function renderizarDetalle(doc, proc) {
  const numStr = proc.numeroProcedimiento || 'Sin numero';
  const fechaGen = new Date().toLocaleString('es-MX');

  // ── Cabecera ──
  pdfHeader(
    doc,
    `${numStr}${proc.urgente ? '   ★ URGENTE' : ''}`,
    `Sistema de Seguimiento de Adquisiciones  ·  Generado: ${fechaGen}`
  );

  // ── Título y tipo ──
  doc.y += 4;
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(13)
    .text(proc.titulo, ML, doc.y, { width: CW });
  doc.y += 4;
  doc.fillColor('#6B7280').font('Helvetica').fontSize(9)
    .text(ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento, ML, doc.y, { width: CW });
  doc.y += 12;

  pdfSeparator(doc);

  // ── Bloque info ──
  const R = 20;
  pdfInfoRow(doc, 'Subdirección', proc.subdireccion?.nombre,      'Sección',        proc.seccion?.nombre,    doc.y);
  doc.y += R;
  pdfInfoRow(doc, 'Asesor Titular',
    proc.asesorTitular ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}` : 'Sin asignar',
    'Asesor Suplente',
    proc.asesorSuplente ? `${proc.asesorSuplente.nombre} ${proc.asesorSuplente.apellidos}` : '—',
    doc.y
  );
  doc.y += R;
  pdfInfoRow(doc, 'Etapa actual',   ETIQUETA_ETAPA[proc.etapaActual] || proc.etapaActual,
             'Año fiscal',   String(proc.anioFiscal || '—'), doc.y);
  doc.y += R;
  const monto = proc.montoEstimado
    ? `$${Number(proc.montoEstimado).toLocaleString('es-MX')} ${proc.moneda || 'MXN'}`
    : 'No especificado';
  pdfInfoRow(doc, 'Monto estimado', monto,
             'Bien / Servicio',
             proc.bienServicio ? `${proc.bienServicio.clave} — ${proc.bienServicio.descripcion}`.substring(0, 36) : '—',
             doc.y);
  doc.y += R + 8;

  pdfSeparator(doc);

  // ── Título sección línea del tiempo ──
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(12)
    .text('Línea del tiempo', ML, doc.y, { width: CW });
  doc.y += 14;

  // ── Cronograma ──
  const cronograma = (proc.cronograma || []).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (cronograma.length > 0) {
    pdfSeccionTimeline(doc, 'cronograma', `Cronograma  (${cronograma.length} etapas)`);
    pdfColHeaders(doc);
    for (const etapa of cronograma) {
      if (doc.y > 700) doc.addPage();
      pdfEtapaRow(doc, etapa);
    }
    doc.y += 8;
  }

  // ── Hoja de trabajo ──
  const hojaEtapas = (proc.hojaDeTrabajoEtapas || []).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (hojaEtapas.length > 0) {
    if (doc.y > 660) doc.addPage();
    pdfSeccionTimeline(doc, 'hoja_de_trabajo', `Hoja de Trabajo  (${hojaEtapas.length} etapas)`);
    pdfColHeaders(doc);
    for (const etapa of hojaEtapas) {
      if (doc.y > 700) doc.addPage();
      pdfEtapaRow(doc, etapa);
    }
    doc.y += 8;
  }

  // ── Entregas ──
  const entregas = proc.entregas || [];
  if (entregas.length > 0) {
    if (doc.y > 660) doc.addPage();
    pdfSeccionTimeline(doc, 'entregas', `Entregas  (${entregas.length})`);
    pdfColHeaders(doc);
    entregas.forEach((entrega, i) => {
      if (doc.y > 700) doc.addPage();
      pdfEntregaRow(doc, entrega, i);
    });
    doc.y += 8;
  }

  if (cronograma.length === 0 && hojaEtapas.length === 0 && entregas.length === 0) {
    doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9)
      .text('Aún no se han registrado etapas en este procedimiento.', ML, doc.y, { width: CW });
    doc.y += 12;
  }

  // ── Pie ──
  if (doc.y > 720) doc.addPage();
  pdfSeparator(doc);
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7)
    .text('Documento generado automáticamente por SSA — No requiere firma.', ML, doc.y, { align: 'center', width: CW });
}

// ── Render lista de procedimientos ───────────────────────────────────────────

function renderizarLista(doc, procedimientos, query) {
  // Encabezado
  doc.fontSize(16).font('Helvetica-Bold')
    .text('Sistema de Seguimiento de Adquisiciones', { align: 'center' })
    .moveDown(0.3)
    .fontSize(13)
    .text('Reporte Ejecutivo de Procedimientos', { align: 'center' })
    .moveDown(0.3)
    .fontSize(9).font('Helvetica')
    .text(`Generado: ${new Date().toLocaleString('es-MX')}`, { align: 'center' })
    .moveDown(0.3)
    .text(`Filtros: ${textoFiltros(query)}`, { align: 'center' })
    .moveDown(1);

  // Resumen
  const totalUrgentes = procedimientos.filter((p) => p.urgente).length;
  const porEtapa = {};
  for (const p of procedimientos) {
    porEtapa[p.etapaActual] = (porEtapa[p.etapaActual] || 0) + 1;
  }

  doc.fontSize(11).font('Helvetica-Bold').text('Resumen', { underline: true })
    .moveDown(0.4).font('Helvetica').fontSize(10)
    .text(`Total de procedimientos: ${procedimientos.length}`)
    .text(`Procedimientos urgentes: ${totalUrgentes}`);

  for (const [etapa, total] of Object.entries(porEtapa)) {
    doc.text(`  ${ETIQUETA_ETAPA[etapa] || etapa}: ${total}`);
  }
  doc.moveDown(1);

  // Detalle
  doc.fontSize(11).font('Helvetica-Bold').text('Detalle de Procedimientos', { underline: true }).moveDown(0.5);

  if (procedimientos.length === 0) {
    doc.font('Helvetica').fontSize(10).text('No se encontraron procedimientos con los filtros aplicados.');
  } else {
    for (const proc of procedimientos) {
      doc.font('Helvetica-Bold').fontSize(10)
        .text(`${proc.numeroProcedimiento || 'S/N'}  ${proc.urgente ? '[URGENTE]' : ''}`)
        .font('Helvetica').fontSize(9)
        .text(`Titulo: ${proc.titulo}`)
        .text(`Tipo: ${ETIQUETA_TIPO[proc.tipoProcedimiento] || proc.tipoProcedimiento}`)
        .text(
          `Subdirección: ${proc.subdireccion?.nombre || 'N/A'}   ` +
          `Sección: ${proc.seccion?.nombre || 'N/A'}`
        )
        .text(`Etapa: ${ETIQUETA_ETAPA[proc.etapaActual] || proc.etapaActual}`)
        .text(`AT Titular: ${proc.asesorTitular ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}` : 'Sin asignar'}`);

      if (proc.montoEstimado) {
        doc.text(`Monto estimado: $${Number(proc.montoEstimado).toLocaleString('es-MX')} ${proc.moneda || 'MXN'}`);
      }

      doc.moveDown(0.4)
        .strokeColor('#CCCCCC').lineWidth(0.5)
        .moveTo(50, doc.y).lineTo(562, doc.y).stroke()
        .moveDown(0.4);

      if (doc.y > 700) doc.addPage();
    }
  }

  doc.moveDown(1).fontSize(8).fillColor('#888888')
    .text('Documento generado automaticamente. No requiere firma.', { align: 'center' });
}

// ── Excel columns ─────────────────────────────────────────────────────────────

const COLUMNAS_EXCEL = [
  { header: 'No. Procedimiento',     key: 'numeroProcedimiento', width: 22 },
  { header: 'Anio Fiscal',           key: 'anioFiscal',          width: 12 },
  { header: 'Titulo',                key: 'titulo',              width: 40 },
  { header: 'Tipo de Procedimiento', key: 'tipoProcedimiento',   width: 30 },
  { header: 'Subdireccion',          key: 'subdireccion',        width: 28 },
  { header: 'Seccion',               key: 'seccion',             width: 28 },
  { header: 'Asesor Tecnico Titular',  key: 'asesorTitular',     width: 28 },
  { header: 'Asesor Tecnico Suplente', key: 'asesorSuplente',    width: 28 },
  { header: 'Etapa Actual',          key: 'etapaActual',         width: 18 },
  { header: 'Urgente',               key: 'urgente',             width: 10 },
  { header: 'Bien / Servicio',       key: 'bienServicio',        width: 30 },
  { header: 'Monto Estimado (MXN)',  key: 'montoEstimado',       width: 22 },
  { header: 'Justificacion Tipo',    key: 'justificacionTipo',   width: 35 },
  { header: 'Fecha Creacion',        key: 'createdAt',           width: 18 },
];

// ── Generadores principales ───────────────────────────────────────────────────

async function generarPDF(query, res) {
  const filtro = construirFiltro(query);
  const procedimientos = await obtenerProcedimientos(filtro);
  const esSoloUno = !!query.procedimientoId && procedimientos.length === 1;

  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="SSA-reporte-${Date.now()}.pdf"`);
  doc.pipe(res);

  if (esSoloUno) {
    renderizarDetalle(doc, procedimientos[0]);
  } else {
    renderizarLista(doc, procedimientos, query);
  }

  doc.end();
}

async function generarExcel(query, res) {
  const filtro = construirFiltro(query);
  const procedimientos = await obtenerProcedimientos(filtro);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SSA';
  workbook.created = new Date();

  const hoja = workbook.addWorksheet('Procedimientos', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });

  // Fila 1: título
  hoja.mergeCells('A1', `N1`);
  const celdaTitulo = hoja.getCell('A1');
  celdaTitulo.value = 'Sistema de Seguimiento de Adquisiciones — Reporte de Procedimientos';
  celdaTitulo.font = { bold: true, size: 13 };
  celdaTitulo.alignment = { horizontal: 'center' };

  // Fila 2: filtros y fecha
  hoja.mergeCells('A2', 'N2');
  const celdaFiltros = hoja.getCell('A2');
  celdaFiltros.value = `Generado: ${new Date().toLocaleString('es-MX')}   |   ${textoFiltros(query)}`;
  celdaFiltros.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
  celdaFiltros.alignment = { horizontal: 'center' };

  // Fila 3: encabezados
  hoja.getRow(3).height = 20;
  hoja.columns = COLUMNAS_EXCEL;

  const filaEncabezado = hoja.getRow(3);
  filaEncabezado.values = COLUMNAS_EXCEL.map((c) => c.header);
  filaEncabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B3A6B' } };
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = { bottom: { style: 'thin', color: { argb: 'FF999999' } } };
  });

  // Filas de datos
  for (const proc of procedimientos) {
    const fila = hoja.addRow(mapearFila(proc));

    if (proc.urgente) {
      fila.eachCell((celda) => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
      });
    }

    fila.getCell('montoEstimado').alignment = { horizontal: 'right' };
    if (proc.montoEstimado) fila.getCell('montoEstimado').numFmt = '"$"#,##0.00';
    fila.getCell('urgente').alignment = { horizontal: 'center' };
    fila.getCell('anioFiscal').alignment = { horizontal: 'center' };
  }

  // Auto-filtro
  hoja.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: COLUMNAS_EXCEL.length },
  };

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="SSA-reporte-${Date.now()}.xlsx"`);
  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { generarPDF, generarExcel, construirFiltro };
