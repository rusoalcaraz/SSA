'use strict';

const { generarPDF, generarExcel } = require('../services/reportes.service');

function construirConsultaSegura(query, usuario) {
  const consulta = { ...query };

  if (usuario.rol === 'subdirector') {
    if (!usuario.subdireccionId) {
      const { crearError } = require('../middleware/errorHandler');
      throw crearError(400, 'SUBDIRECCION_NO_ASIGNADA', 'El usuario no tiene subdireccion asignada');
    }
    consulta.subdireccionId = usuario.subdireccionId;
  }

  if (usuario.rol === 'jefe_seccion') {
    if (!usuario.seccionId) {
      const { crearError } = require('../middleware/errorHandler');
      throw crearError(400, 'SECCION_NO_ASIGNADA', 'El usuario no tiene seccion asignada');
    }
    consulta.seccionId = usuario.seccionId;
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
