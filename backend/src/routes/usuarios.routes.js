'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');
const ctrl = require('../controllers/usuarios.controller');

const router = Router();

router.use(verifyToken, actualizarActividad, limitarPorUsuario);

// GET  /api/v1/usuarios             — listar con filtros
// POST /api/v1/usuarios             — crear usuario
router.route('/')
  .get(checkRole(['administrador', 'oficialia_mayor', 'dir_gral_admon', 'integrante_adquisiciones']), ctrl.listar)
  .post(checkRole(['administrador', 'integrante_adquisiciones']), ctrl.crear);

// GET    /api/v1/usuarios/:id       — detalle
// PUT    /api/v1/usuarios/:id       — actualizar datos / rol / DG / activo
// DELETE /api/v1/usuarios/:id       — baja logica
router.route('/:id')
  .get(checkRole(['administrador', 'oficialia_mayor', 'dir_gral_admon', 'integrante_adquisiciones']), ctrl.obtener)
  .put(checkRole(['administrador', 'integrante_adquisiciones']), ctrl.actualizar)
  .delete(checkRole(['administrador', 'integrante_adquisiciones']), ctrl.eliminarDefinitivo);

// PUT /api/v1/usuarios/:id/reset-password
router.put(
  '/:id/reset-password',
  checkRole(['administrador', 'integrante_adquisiciones']),
  ctrl.resetPassword
);

// GET /api/v1/usuarios/:id/procedimientos
router.get(
  '/:id/procedimientos',
  checkRole(['administrador', 'oficialia_mayor', 'dir_gral_admon', 'integrante_adquisiciones']),
  ctrl.listarProcedimientosAsignados
);

module.exports = router;
