'use strict';

const { generarPDF, generarExcel } = require('../services/reportes.service');

// GET /api/v1/reportes/pdf
// Query params: anioFiscal, dgId, tipoProcedimiento, etapaActual, urgente
async function pdf(req, res, next) {
  try {
    await generarPDF(req.query, res);
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/reportes/excel
// Query params: anioFiscal, dgId, tipoProcedimiento, etapaActual, urgente
async function excel(req, res, next) {
  try {
    await generarExcel(req.query, res);
  } catch (error) {
    next(error);
  }
}

module.exports = { pdf, excel };
