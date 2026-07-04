'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');
const { uploadObservacion, uploadEntrega, uploadJustificacion, uploadEvidencia, uploadEvidenciaEntrega } = require('../middleware/upload');

const procCtrl = require('../controllers/procedimientos/procedimientos.controller');
const etapasCtrl = require('../controllers/procedimientos/etapas.controller');
const entregasCtrl = require('../controllers/procedimientos/entregas.controller');

// Destructure para acceder a las nuevas funciones
const { proponerRecibida, validarEntrega } = entregasCtrl;

const router = Router();

// Todos los endpoints requieren autenticacion
router.use(verifyToken, actualizarActividad, limitarPorUsuario);

// -------------------------------------------------------
// Procedimientos principales
// -------------------------------------------------------
router
  .route('/')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    procCtrl.listar
  )
  .post(
    checkRole(['administrador', 'adquisiciones', 'subdirector']),
    procCtrl.crear
  );

router
  .route('/:id')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    procCtrl.obtener
  )
  .put(
    checkRole(['administrador', 'adquisiciones', 'subdirector']),
    procCtrl.actualizar
  );

router.patch(
  '/:id/urgente',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  procCtrl.marcarUrgente
);

// Texto de justificacion + supuesto de excepcion
router.put(
  '/:id/justificacion',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  procCtrl.actualizarJustificacion
);

// Informacion de cabecera del cronograma
router.put(
  '/:id/cronograma-info',
  checkRole(['administrador', 'adquisiciones', 'subdirector', 'asesor_tecnico']),
  procCtrl.actualizarInfoCronograma
);

// Informacion de cabecera de la hoja de trabajo
router.put(
  '/:id/hoja-trabajo-info',
  checkRole(['administrador', 'adquisiciones', 'subdirector', 'asesor_tecnico']),
  procCtrl.actualizarInfoHojaDeTrabajo
);

// Archivo de evidencia de justificacion
router.post(
  '/:id/justificacion/archivo',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  uploadJustificacion.single('archivo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        const { crearError } = require('../middleware/errorHandler');
        throw crearError(400, 'ARCHIVO_REQUERIDO', 'Se requiere un archivo PDF');
      }
      const { Procedimiento } = require('../models/procedimiento.model');
      const { ok } = require('../utils/respuesta');
      const { puedeGestionarProcedimiento } = require('../services/procedimiento.service');
      const proc = await Procedimiento.findById(req.params.id);
      if (!proc) {
        const { crearError } = require('../middleware/errorHandler');
        throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
      }
      if (!puedeGestionarProcedimiento(proc, req.usuario)) {
        const { crearError } = require('../middleware/errorHandler');
        throw crearError(403, 'ACCESO_DENEGADO', 'No tiene permisos para modificar este procedimiento');
      }
      proc.evidenciaJustificacion.push({
        nombre: req.file.originalname,
        ruta: req.file.path,
        cargadoPor: req.usuario.id,
      });
      await proc.save();
      return ok(res, proc.evidenciaJustificacion[proc.evidenciaJustificacion.length - 1], 'Archivo de justificacion subido');
    } catch (error) {
      next(error);
    }
  }
);

// -------------------------------------------------------
// Etapas (cronograma y hoja de trabajo)
// -------------------------------------------------------
router.patch(
  '/:id/etapas/:etapaId/completar',
  checkRole(['administrador', 'asesor_tecnico']),
  etapasCtrl.completar
);

router.get(
  '/:id/etapas/:etapaId/reporte',
  checkRole(['administrador', 'adquisiciones', 'subdirector', 'jefe_seccion', 'asesor_tecnico']),
  etapasCtrl.descargarReporteActividad
);

router.get(
  '/:id/etapas/:etapaId/evidencia/:archivoId',
  checkRole(['administrador', 'adquisiciones', 'subdirector', 'jefe_seccion', 'asesor_tecnico']),
  etapasCtrl.obtenerEvidencia
);

router.post(
  '/:id/etapas/:etapaId/evidencia',
  checkRole(['administrador', 'asesor_tecnico']),
  uploadEvidencia.single('archivo'),
  etapasCtrl.subirEvidencia
);

router.patch(
  '/:id/etapas/:etapaId/evidencia/:archivoId/validar',
  checkRole(['administrador', 'adquisiciones']),
  etapasCtrl.validarEvidencia
);

router.patch(
  '/:id/etapas/:etapaId/validar-completado',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  etapasCtrl.validarCompletado
);

router.patch(
  '/:id/etapas/:etapaId/proponer-fecha',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  etapasCtrl.proponerFecha
);

router.patch(
  '/:id/etapas/:etapaId/responder-fecha',
  checkRole(['administrador', 'asesor_tecnico']),
  etapasCtrl.responderFecha
);

router.patch(
  '/:id/etapas/:etapaId/sobreescribir-fecha',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  etapasCtrl.sobreescribirFecha
);

router.patch(
  '/:id/etapas/:etapaId/no-aplica',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  etapasCtrl.marcarNoAplica
);

router.post(
  '/:id/etapas/:etapaId/observacion',
  checkRole(['administrador', 'asesor_tecnico', 'adquisiciones', 'subdirector']),
  uploadObservacion.array('archivos', 5),
  etapasCtrl.agregarObservacion
);

router.post(
  '/:id/etapas/:etapaId/archivo',
  checkRole(['administrador', 'asesor_tecnico', 'adquisiciones', 'subdirector']),
  uploadObservacion.single('archivo'),
  etapasCtrl.subirArchivo
);

// -------------------------------------------------------
// Entregas
// -------------------------------------------------------
router
  .route('/:id/entregas')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    entregasCtrl.listar
  )
  .post(
    checkRole(['administrador', 'adquisiciones', 'subdirector']),
    entregasCtrl.crear
  );

router.put(
  '/:id/entregas/:entregaId',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  entregasCtrl.actualizar
);

router.patch(
  '/:id/entregas/:entregaId/proponer-recibida',
  checkRole(['administrador', 'asesor_tecnico']),
  uploadEvidenciaEntrega.single('archivo'),
  entregasCtrl.proponerRecibida
);

router.get(
  '/:id/entregas/:entregaId/evidencia/:archivoId',
  checkRole(['administrador', 'adquisiciones', 'subdirector', 'jefe_seccion', 'asesor_tecnico']),
  entregasCtrl.obtenerEvidenciaEntrega
);

router.post(
  '/:id/entregas/:entregaId/evidencia',
  checkRole(['administrador', 'asesor_tecnico']),
  uploadEvidenciaEntrega.single('archivo'),
  entregasCtrl.subirEvidencia
);

router.patch(
  '/:id/entregas/:entregaId/evidencia/:archivoId/validar',
  checkRole(['administrador', 'adquisiciones']),
  entregasCtrl.validarEvidencia
);

router.patch(
  '/:id/entregas/:entregaId/validar',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  entregasCtrl.validarEntrega
);

router.post(
  '/:id/entregas/:entregaId/documento',
  checkRole(['administrador', 'adquisiciones', 'subdirector']),
  uploadEntrega.single('archivo'),
  entregasCtrl.subirDocumento
);

module.exports = router;
