'use strict';

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

const MAX_BYTES = env.MAX_FILE_SIZE_MB * 1024 * 1024;

/**
 * Fabrica de almacenamiento Multer con destino dinamico.
 *
 * @param {function} obtenerDestino - Funcion (req, file) => string con la ruta relativa de destino.
 */
function crearStorage(obtenerDestino) {
  return multer.diskStorage({
    destination(req, file, cb) {
      const destino = path.join(env.UPLOAD_DIR, obtenerDestino(req, file));
      cb(null, destino);
    },
    filename(req, file, cb) {
      const extension = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${extension}`);
    },
  });
}

/**
 * Filtro de tipo MIME — solo PDF permitido.
 */
function filtrarPDF(req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    const error = new Error('Solo se permiten archivos PDF');
    error.statusCode = 400;
    error.code = 'TIPO_ARCHIVO_INVALIDO';
    cb(error, false);
  }
}

/**
 * Middleware de subida para archivos de justificacion.
 * Destino: uploads/justificaciones/{procedimientoId}/
 */
const uploadJustificacion = multer({
  storage: crearStorage((req) => `justificaciones/${req.params.id}/`),
  fileFilter: filtrarPDF,
  limits: { fileSize: MAX_BYTES },
});

/**
 * Middleware de subida para archivos adjuntos de etapas (observaciones).
 * Destino: uploads/observaciones/{procedimientoId}/{etapaId}/
 */
const uploadObservacion = multer({
  storage: crearStorage(
    (req) => `observaciones/${req.params.id}/${req.params.etapaId}/`
  ),
  fileFilter: filtrarPDF,
  limits: { fileSize: MAX_BYTES },
});

/**
 * Middleware de subida para documentos de entregas.
 * Destino: uploads/entregas/{procedimientoId}/{entregaId}/
 */
const uploadEntrega = multer({
  storage: crearStorage(
    (req) => `entregas/${req.params.id}/${req.params.entregaId}/`
  ),
  fileFilter: filtrarPDF,
  limits: { fileSize: MAX_BYTES },
});

module.exports = { uploadJustificacion, uploadObservacion, uploadEntrega };
