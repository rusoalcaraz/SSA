'use strict';

const { generarPDF, generarExcel } = require('../services/reportes.service');

function construirConsultaSegura(query, usuario) {
  const consulta = { ...query };

  if (usuario.rol === 'integrante_adquisiciones') {
    if (!usuario.dgId) {
      const { crearError } = require('../middleware/errorHandler');
      throw crearError(400, 'ORGANISMO_NO_ASIGNADO', 'El usuario no tiene organismo asignado');
    }
    consulta.dgId = usuario.dgId;
  }

  return consulta;
}

// GET /api/v1/reportes/pdf
// Query params: anioFiscal, dgId, tipoProcedimiento, etapaActual, urgente
async function pdf(req, res, next) {
  try {
    await generarPDF(construirConsultaSegura(req.query, req.usuario), res);
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/reportes/excel
// Query params: anioFiscal, dgId, tipoProcedimiento, etapaActual, urgente
async function excel(req, res, next) {
  try {
    await generarExcel(construirConsultaSegura(req.query, req.usuario), res);
  } catch (error) {
    next(error);
  }
}

module.exports = { pdf, excel };
