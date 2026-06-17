'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');

const dgCtrl = require('../controllers/catalogos/direccionesGenerales.controller');
const bsCtrl = require('../controllers/catalogos/bienesServicios.controller');
const etapasCtrl = require('../controllers/catalogos/etapas.controller');

const router = Router();

// Todos los endpoints requieren autenticacion
router.use(verifyToken, actualizarActividad, limitarPorUsuario);

// -------------------------------------------------------
// Direcciones Generales — /api/v1/catalogos/direcciones-generales
// -------------------------------------------------------
router
  .route('/direcciones-generales')
  .get(
    checkRole([
      'administrador',
      'oficialia_mayor',
      'dir_gral_admon',
      'integrante_adquisiciones',
      'asesor_tecnico',
    ]),
    dgCtrl.listar
  )
  .post(checkRole(['administrador']), dgCtrl.crear);

router
  .route('/direcciones-generales/:id')
  .get(
    checkRole([
      'administrador',
      'oficialia_mayor',
      'dir_gral_admon',
      'integrante_adquisiciones',
      'asesor_tecnico',
    ]),
    dgCtrl.obtener
  )
  .put(checkRole(['administrador']), dgCtrl.actualizar)
  .delete(checkRole(['administrador']), dgCtrl.desactivar);

// -------------------------------------------------------
// Bienes y Servicios — /api/v1/catalogos/bienes-servicios
// -------------------------------------------------------
router
  .route('/bienes-servicios')
  .get(
    checkRole([
      'administrador',
      'oficialia_mayor',
      'dir_gral_admon',
      'integrante_adquisiciones',
    ]),
    bsCtrl.listar
  )
  .post(checkRole(['administrador']), bsCtrl.crear);

router
  .route('/bienes-servicios/:id')
  .get(
    checkRole([
      'administrador',
      'oficialia_mayor',
      'dir_gral_admon',
      'integrante_adquisiciones',
    ]),
    bsCtrl.obtener
  )
  .put(checkRole(['administrador']), bsCtrl.actualizar)
  .delete(checkRole(['administrador']), bsCtrl.desactivar);

// -------------------------------------------------------
// Etapas — /api/v1/catalogos/etapas
// -------------------------------------------------------
router
  .route('/etapas')
  .get(
    checkRole([
      'administrador',
      'oficialia_mayor',
      'dir_gral_admon',
      'integrante_adquisiciones',
      'asesor_tecnico',
    ]),
    etapasCtrl.listar
  )
  .post(checkRole(['administrador']), etapasCtrl.crear);

router
  .route('/etapas/:id')
  .get(
    checkRole([
      'administrador',
      'oficialia_mayor',
      'dir_gral_admon',
      'integrante_adquisiciones',
      'asesor_tecnico',
    ]),
    etapasCtrl.obtener
  )
  .put(checkRole(['administrador']), etapasCtrl.actualizar)
  .delete(checkRole(['administrador']), etapasCtrl.desactivar);

module.exports = router;
