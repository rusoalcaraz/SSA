'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');
const { uploadObservacion, uploadEntrega, uploadJustificacion } = require('../middleware/upload');

const procCtrl = require('../controllers/procedimientos/procedimientos.controller');
const etapasCtrl = require('../controllers/procedimientos/etapas.controller');
const entregasCtrl = require('../controllers/procedimientos/entregas.controller');

const router = Router();

// Todos los endpoints requieren autenticacion
router.use(verifyToken, actualizarActividad, limitarPorUsuario);

// -------------------------------------------------------
// Procedimientos principales
// -------------------------------------------------------
router
  .route('/')
  .get(
    checkRole(['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt']),
    procCtrl.listar
  )
  .post(
    checkRole(['superadmin', 'area_contratante']),
    procCtrl.crear
  );

router
  .route('/:id')
  .get(
    checkRole(['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt']),
    procCtrl.obtener
  )
  .put(
    checkRole(['superadmin', 'area_contratante']),
    procCtrl.actualizar
  );

router.patch(
  '/:id/urgente',
  checkRole(['superadmin', 'area_contratante']),
  procCtrl.marcarUrgente
);

// Texto de justificacion + supuesto de excepcion
router.put(
  '/:id/justificacion',
  checkRole(['superadmin', 'area_contratante']),
  procCtrl.actualizarJustificacion
);

// Informacion de cabecera del cronograma
router.put(
  '/:id/cronograma-info',
  checkRole(['superadmin', 'area_contratante', 'asesor_tecnico']),
  procCtrl.actualizarInfoCronograma
);

// Informacion de cabecera de la hoja de trabajo
router.put(
  '/:id/hoja-trabajo-info',
  checkRole(['superadmin', 'area_contratante', 'asesor_tecnico']),
  procCtrl.actualizarInfoHojaDeTrabajo
);

// Archivo de evidencia de justificacion
router.post(
  '/:id/justificacion/archivo',
  checkRole(['superadmin', 'area_contratante']),
  uploadJustificacion.single('archivo'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        const { crearError } = require('../middleware/errorHandler');
        throw crearError(400, 'ARCHIVO_REQUERIDO', 'Se requiere un archivo PDF');
      }
      const { Procedimiento } = require('../models/procedimiento.model');
      const { ok } = require('../utils/respuesta');
      const proc = await Procedimiento.findById(req.params.id);
      if (!proc) {
        const { crearError } = require('../middleware/errorHandler');
        throw crearError(404, 'PROCEDIMIENTO_NO_ENCONTRADO', 'Procedimiento no encontrado');
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
  checkRole(['superadmin', 'asesor_tecnico']),
  etapasCtrl.completar
);

router.patch(
  '/:id/etapas/:etapaId/proponer-fecha',
  checkRole(['superadmin', 'area_contratante']),
  etapasCtrl.proponerFecha
);

router.patch(
  '/:id/etapas/:etapaId/responder-fecha',
  checkRole(['superadmin', 'asesor_tecnico']),
  etapasCtrl.responderFecha
);

router.patch(
  '/:id/etapas/:etapaId/sobreescribir-fecha',
  checkRole(['superadmin', 'area_contratante']),
  etapasCtrl.sobreescribirFecha
);

router.patch(
  '/:id/etapas/:etapaId/no-aplica',
  checkRole(['superadmin', 'area_contratante']),
  etapasCtrl.marcarNoAplica
);

router.post(
  '/:id/etapas/:etapaId/observacion',
  checkRole(['superadmin', 'asesor_tecnico', 'dgt']),
  uploadObservacion.array('archivos', 5),
  etapasCtrl.agregarObservacion
);

router.post(
  '/:id/etapas/:etapaId/archivo',
  checkRole(['superadmin', 'asesor_tecnico', 'dgt']),
  uploadObservacion.single('archivo'),
  etapasCtrl.subirArchivo
);

// -------------------------------------------------------
// Entregas
// -------------------------------------------------------
router
  .route('/:id/entregas')
  .get(
    checkRole(['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt', 'inspeccion']),
    entregasCtrl.listar
  )
  .post(
    checkRole(['superadmin', 'area_contratante']),
    entregasCtrl.crear
  );

router.put(
  '/:id/entregas/:entregaId',
  checkRole(['superadmin', 'area_contratante']),
  entregasCtrl.actualizar
);

router.post(
  '/:id/entregas/:entregaId/documento',
  checkRole(['superadmin', 'inspeccion']),
  uploadEntrega.single('archivo'),
  entregasCtrl.subirDocumento
);

module.exports = router;
