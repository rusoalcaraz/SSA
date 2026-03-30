'use strict';

const nodemailer = require('nodemailer');
const env = require('../config/env');

// -------------------------------------------------------
// Transporter SMTP — se inicializa una sola vez
// -------------------------------------------------------
let transporter = null;

function obtenerTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transporter;
}

// -------------------------------------------------------
// Envio base — no lanza error para no interrumpir el flujo principal
// -------------------------------------------------------
async function enviar({ destinatarios, asunto, cuerpoHtml }) {
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    console.warn('[Notificaciones] SMTP no configurado. Correo no enviado:', asunto);
    return;
  }

  const correos = destinatarios.filter(Boolean).join(', ');
  if (!correos) return;

  try {
    await obtenerTransporter().sendMail({
      from: `"SSA Adquisiciones" <${env.SMTP_FROM}>`,
      to: correos,
      subject: asunto,
      html: cuerpoHtml,
    });
  } catch (err) {
    console.error('[Notificaciones] Error al enviar correo:', asunto, err.message);
  }
}

// -------------------------------------------------------
// Plantillas HTML
// -------------------------------------------------------
function plantillaBase(titulo, cuerpo) {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; color: #222; margin: 0; padding: 0; }
        .contenedor { max-width: 600px; margin: 30px auto; border: 1px solid #ddd; border-radius: 4px; }
        .encabezado { background: #1B3A6B; color: #fff; padding: 20px 30px; }
        .encabezado h2 { margin: 0; font-size: 16px; }
        .cuerpo { padding: 24px 30px; }
        .dato { margin: 6px 0; }
        .dato strong { display: inline-block; min-width: 160px; }
        .pie { background: #f5f5f5; padding: 14px 30px; font-size: 11px; color: #777; border-top: 1px solid #eee; }
        .alerta { background: #fff3cd; border-left: 4px solid #f0ad4e; padding: 10px 14px; margin: 14px 0; border-radius: 2px; }
        .urgente { background: #f8d7da; border-left: 4px solid #d9534f; padding: 10px 14px; margin: 14px 0; border-radius: 2px; }
      </style>
    </head>
    <body>
      <div class="contenedor">
        <div class="encabezado"><h2>Sistema de Seguimiento de Adquisiciones</h2></div>
        <div class="cuerpo">
          <h3 style="margin-top:0">${titulo}</h3>
          ${cuerpo}
        </div>
        <div class="pie">
          Este mensaje es generado automaticamente. No responda a este correo.<br>
          ${new Date().toLocaleString('es-MX')}
        </div>
      </div>
    </body>
    </html>
  `;
}

function filaProcedimiento(procedimiento, etapa) {
  return `
    <p class="dato"><strong>Procedimiento:</strong> ${procedimiento.numeroProcedimiento || 'S/N'}</p>
    <p class="dato"><strong>Titulo:</strong> ${procedimiento.titulo}</p>
    <p class="dato"><strong>Etapa:</strong> ${etapa.nombre}</p>
    <p class="dato"><strong>Fecha planeada:</strong> ${etapa.fechaPlaneada ? new Date(etapa.fechaPlaneada).toLocaleDateString('es-MX') : 'Sin fecha'}</p>
    <p class="dato"><strong>DG:</strong> ${procedimiento.direccionGeneral?.siglas || ''}</p>
  `;
}

// -------------------------------------------------------
// Extrae correos de los ATs del procedimiento
// -------------------------------------------------------
function correosAT(procedimiento) {
  const correos = [];
  if (procedimiento.asesorTitular?.correo) correos.push(procedimiento.asesorTitular.correo);
  if (procedimiento.asesorSuplente?.correo) correos.push(procedimiento.asesorSuplente.correo);
  return correos;
}

// -------------------------------------------------------
// 1. Notificacion: AC propone cambio de fecha → AT titular + suplente
// -------------------------------------------------------
async function notificarCambioFecha(procedimiento, etapa, fechaNueva, motivo) {
  const destinatarios = correosAT(procedimiento);
  const fechaFormato = new Date(fechaNueva).toLocaleDateString('es-MX');

  await enviar({
    destinatarios,
    asunto: `[SSA] Propuesta de cambio de fecha — ${procedimiento.numeroProcedimiento}`,
    cuerpoHtml: plantillaBase(
      'El Area Contratante propone un cambio de fecha',
      `
      <div class="alerta">El Area Contratante ha propuesto una nueva fecha para la siguiente etapa. Por favor, ingrese al sistema para aceptar o rechazar el cambio.</div>
      ${filaProcedimiento(procedimiento, etapa)}
      <p class="dato"><strong>Fecha propuesta:</strong> ${fechaFormato}</p>
      ${motivo ? `<p class="dato"><strong>Motivo:</strong> ${motivo}</p>` : ''}
      `
    ),
  });
}

// -------------------------------------------------------
// 2. Notificacion: Etapa vencida → AT titular + suplente + DGT de la DG
// -------------------------------------------------------
async function notificarVencimiento(procedimiento, etapa, correosDGT) {
  const destinatarios = [...correosAT(procedimiento), ...correosDGT];

  await enviar({
    destinatarios,
    asunto: `[SSA] ETAPA VENCIDA — ${procedimiento.numeroProcedimiento}`,
    cuerpoHtml: plantillaBase(
      'Etapa vencida sin completar',
      `
      <div class="urgente">La siguiente etapa ha superado su fecha planeada y aun no ha sido completada.</div>
      ${filaProcedimiento(procedimiento, etapa)}
      `
    ),
  });
}

// -------------------------------------------------------
// 3. Notificacion: Etapa proxima a vencer (3 dias) → AT titular + suplente
// -------------------------------------------------------
async function notificarProximoVencimiento(procedimiento, etapa) {
  const destinatarios = correosAT(procedimiento);
  const diasRestantes = Math.ceil(
    (new Date(etapa.fechaPlaneada) - new Date()) / (1000 * 60 * 60 * 24)
  );

  await enviar({
    destinatarios,
    asunto: `[SSA] Etapa proxima a vencer (${diasRestantes} dias) — ${procedimiento.numeroProcedimiento}`,
    cuerpoHtml: plantillaBase(
      `Etapa proxima a vencer en ${diasRestantes} dia(s)`,
      `
      <div class="alerta">La siguiente etapa vencera en <strong>${diasRestantes} dia(s)</strong>. Verifique el avance del procedimiento.</div>
      ${filaProcedimiento(procedimiento, etapa)}
      `
    ),
  });
}

// -------------------------------------------------------
// 4. Notificacion: Procedimiento urgente creado → Gerencial + DGT de la DG
// -------------------------------------------------------
async function notificarProcedimientoUrgente(procedimiento, correosGerencial, correosDGT) {
  const destinatarios = [...correosGerencial, ...correosDGT];

  await enviar({
    destinatarios,
    asunto: `[SSA] Nuevo procedimiento URGENTE — ${procedimiento.numeroProcedimiento}`,
    cuerpoHtml: plantillaBase(
      'Procedimiento urgente registrado',
      `
      <div class="urgente">Se ha registrado un nuevo procedimiento marcado como <strong>URGENTE</strong>.</div>
      <p class="dato"><strong>Procedimiento:</strong> ${procedimiento.numeroProcedimiento || 'S/N'}</p>
      <p class="dato"><strong>Titulo:</strong> ${procedimiento.titulo}</p>
      <p class="dato"><strong>Tipo:</strong> ${procedimiento.tipoProcedimiento}</p>
      <p class="dato"><strong>DG:</strong> ${procedimiento.direccionGeneral?.siglas || ''}</p>
      <p class="dato"><strong>Justificacion:</strong> ${procedimiento.justificacionUrgencia || ''}</p>
      `
    ),
  });
}

module.exports = {
  notificarCambioFecha,
  notificarVencimiento,
  notificarProximoVencimiento,
  notificarProcedimientoUrgente,
};
