'use strict';

const cron = require('node-cron');
const { Procedimiento } = require('../models/procedimiento.model');
const { Usuario } = require('../models/usuario.model');
const {
  notificarVencimiento,
  notificarProximoVencimiento,
} = require('./notificaciones.service');

const ESTADOS_ACTIVOS = ['pendiente', 'activo', 'fecha_propuesta', 'fecha_rechazada'];

// -------------------------------------------------------
// Helper: obtiene correos de los usuarios DGT de una DG
// -------------------------------------------------------
async function correosDGT(direccionGeneralId) {
  const usuarios = await Usuario.find({
    rol: 'dgt',
    direccionGeneral: direccionGeneralId,
    activo: true,
  }).select('correo');
  return usuarios.map((u) => u.correo);
}

// -------------------------------------------------------
// Verifica vencimientos sobre un array de etapas del procedimiento
// Retorna true si se modifico alguna etapa (para guardar el doc)
// -------------------------------------------------------
async function procesarEtapas(etapas, procedimiento, hoy, enTresDias) {
  let modificado = false;
  const dgCorreos = await correosDGT(procedimiento.direccionGeneral);

  for (const etapa of etapas) {
    if (!ESTADOS_ACTIVOS.includes(etapa.estado) || !etapa.fechaPlaneada) continue;
    if (etapa.alertaEnviada) continue;

    const fecha = new Date(etapa.fechaPlaneada);

    if (fecha < hoy) {
      // Etapa vencida
      await notificarVencimiento(procedimiento, etapa, dgCorreos);
      etapa.estado = 'vencido';
      etapa.alertaEnviada = true;
      modificado = true;
    } else if (fecha <= enTresDias) {
      // Proxima a vencer
      await notificarProximoVencimiento(procedimiento, etapa);
      etapa.alertaEnviada = true;
      modificado = true;
    }
  }

  return modificado;
}

// -------------------------------------------------------
// Funcion principal del cron
// -------------------------------------------------------
async function verificarVencimientos() {
  console.log('[Cron] Iniciando verificacion de vencimientos:', new Date().toISOString());

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const enTresDias = new Date(hoy);
  enTresDias.setDate(enTresDias.getDate() + 3);

  try {
    // Buscar procedimientos con al menos una etapa activa pendiente de alerta
    const procedimientos = await Procedimiento.find({
      etapaActual: { $nin: ['concluido', 'cancelado'] },
      $or: [
        {
          cronograma: {
            $elemMatch: {
              estado: { $in: ESTADOS_ACTIVOS },
              fechaPlaneada: { $lte: enTresDias },
              alertaEnviada: false,
            },
          },
        },
        {
          hojaDeTrabajoEtapas: {
            $elemMatch: {
              estado: { $in: ESTADOS_ACTIVOS },
              fechaPlaneada: { $lte: enTresDias },
              alertaEnviada: false,
            },
          },
        },
      ],
    })
      .populate('asesorTitular', 'nombre apellidos correo')
      .populate('asesorSuplente', 'nombre apellidos correo')
      .populate('direccionGeneral', 'nombre siglas');

    console.log(`[Cron] Procedimientos con etapas a revisar: ${procedimientos.length}`);

    let totalNotificados = 0;

    for (const proc of procedimientos) {
      const modCronograma = await procesarEtapas(proc.cronograma, proc, hoy, enTresDias);
      const modHoja = await procesarEtapas(proc.hojaDeTrabajoEtapas, proc, hoy, enTresDias);

      if (modCronograma || modHoja) {
        await proc.save();
        totalNotificados++;
      }
    }

    console.log(`[Cron] Verificacion completada. Procedimientos notificados: ${totalNotificados}`);
  } catch (err) {
    console.error('[Cron] Error en verificarVencimientos:', err.message);
  }
}

// -------------------------------------------------------
// Registra el job — se llama una vez desde server.js
// -------------------------------------------------------
function iniciarCronJobs() {
  // Verificacion diaria a las 08:00 hora del servidor
  cron.schedule('0 8 * * *', verificarVencimientos, {
    timezone: 'America/Mexico_City',
  });

  console.log('[Cron] Job de verificacion de vencimientos registrado (08:00 diario)');
}

module.exports = { iniciarCronJobs, verificarVencimientos };
