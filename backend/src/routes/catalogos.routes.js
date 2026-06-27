'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');

const dgCtrl = require('../controllers/catalogos/direccionesGenerales.controller');
const subCtrl = require('../controllers/catalogos/subdirecciones.controller');
const secCtrl = require('../controllers/catalogos/secciones.controller');
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
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
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
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    dgCtrl.obtener
  )
  .put(checkRole(['administrador']), dgCtrl.actualizar)
  .delete(checkRole(['administrador']), dgCtrl.desactivar);

// -------------------------------------------------------
// Subdirecciones — /api/v1/catalogos/subdirecciones
// -------------------------------------------------------
router
  .route('/subdirecciones')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    subCtrl.listar
  )
  .post(checkRole(['administrador']), subCtrl.crear);

router
  .route('/subdirecciones/:id')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    subCtrl.obtener
  )
  .put(checkRole(['administrador']), subCtrl.actualizar)
  .delete(checkRole(['administrador']), subCtrl.desactivar);

router.delete('/subdirecciones/:id/eliminar', checkRole(['administrador']), subCtrl.eliminar);

// -------------------------------------------------------
// Secciones — /api/v1/catalogos/secciones
// -------------------------------------------------------
router
  .route('/secciones')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    secCtrl.listar
  )
  .post(checkRole(['administrador', 'subdirector']), secCtrl.crear);

router
  .route('/secciones/:id')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    secCtrl.obtener
  )
  .put(checkRole(['administrador', 'subdirector']), secCtrl.actualizar)
  .delete(checkRole(['administrador', 'subdirector']), secCtrl.desactivar);

router.delete('/secciones/:id/eliminar', checkRole(['administrador']), secCtrl.eliminar);

// -------------------------------------------------------
// Bienes y Servicios — /api/v1/catalogos/bienes-servicios
// -------------------------------------------------------
router
  .route('/bienes-servicios')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    bsCtrl.listar
  )
  .post(checkRole(['administrador']), bsCtrl.crear);

router
  .route('/bienes-servicios/:id')
  .get(
    checkRole([
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
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
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
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
      'adquisiciones',
      'subdirector',
      'jefe_seccion',
      'asesor_tecnico',
    ]),
    etapasCtrl.obtener
  )
  .put(checkRole(['administrador']), etapasCtrl.actualizar)
  .delete(checkRole(['administrador']), etapasCtrl.desactivar);

module.exports = router;
