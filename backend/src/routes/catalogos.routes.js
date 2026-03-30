'use strict';

const { Router } = require('express');
const { verifyToken, checkRole } = require('../middleware/auth');

const dgCtrl = require('../controllers/catalogos/direccionesGenerales.controller');
const bsCtrl = require('../controllers/catalogos/bienesServicios.controller');
const etapasCtrl = require('../controllers/catalogos/etapas.controller');

const router = Router();

// Todos los endpoints requieren autenticacion
router.use(verifyToken);

// -------------------------------------------------------
// Direcciones Generales — /api/v1/catalogos/direcciones-generales
// -------------------------------------------------------
router
  .route('/direcciones-generales')
  .get(
    checkRole(['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt']),
    dgCtrl.listar
  )
  .post(checkRole(['superadmin']), dgCtrl.crear);

router
  .route('/direcciones-generales/:id')
  .get(
    checkRole(['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt']),
    dgCtrl.obtener
  )
  .put(checkRole(['superadmin']), dgCtrl.actualizar)
  .delete(checkRole(['superadmin']), dgCtrl.desactivar);

// -------------------------------------------------------
// Bienes y Servicios — /api/v1/catalogos/bienes-servicios
// -------------------------------------------------------
router
  .route('/bienes-servicios')
  .get(
    checkRole(['superadmin', 'area_contratante']),
    bsCtrl.listar
  )
  .post(checkRole(['superadmin']), bsCtrl.crear);

router
  .route('/bienes-servicios/:id')
  .get(checkRole(['superadmin', 'area_contratante']), bsCtrl.obtener)
  .put(checkRole(['superadmin']), bsCtrl.actualizar)
  .delete(checkRole(['superadmin']), bsCtrl.desactivar);

// -------------------------------------------------------
// Etapas — /api/v1/catalogos/etapas
// -------------------------------------------------------
router
  .route('/etapas')
  .get(
    checkRole(['superadmin', 'area_contratante', 'asesor_tecnico', 'dgt']),
    etapasCtrl.listar
  )
  .post(checkRole(['superadmin']), etapasCtrl.crear);

router
  .route('/etapas/:id')
  .get(
    checkRole(['superadmin', 'area_contratante', 'asesor_tecnico', 'dgt']),
    etapasCtrl.obtener
  )
  .put(checkRole(['superadmin']), etapasCtrl.actualizar)
  .delete(checkRole(['superadmin']), etapasCtrl.desactivar);

module.exports = router;
