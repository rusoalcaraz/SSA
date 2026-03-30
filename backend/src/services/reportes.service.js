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
  const { anioFiscal, dgId, tipoProcedimiento, etapaActual, urgente } = query;
  const filtro = {};
  if (anioFiscal) filtro.anioFiscal = Number(anioFiscal);
  if (dgId) filtro.direccionGeneral = dgId;
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
    .populate('asesorTitular', 'nombre apellidos')
    .populate('asesorSuplente', 'nombre apellidos')
    .populate('bienServicio', 'clave descripcion')
    .select('-cronograma -hojaDeTrabajoEtapas -entregas -evidenciaJustificacion -contrato')
    .sort({ direccionGeneral: 1, createdAt: -1 })
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

// -------------------------------------------------------
// GENERADOR PDF — resumen ejecutivo
// -------------------------------------------------------
async function generarPDF(query, res) {
  const filtro = construirFiltro(query);
  const procedimientos = await obtenerProcedimientos(filtro);

  const doc = new PDFDocument({ margin: 50, size: 'LETTER' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="SSA-reporte-${Date.now()}.pdf"`
  );
  doc.pipe(res);

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
