'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');
const ctrl = require('../controllers/usuarios.controller');

const router = Router();

router.use(verifyToken, actualizarActividad, limitarPorUsuario);
router.use(checkRole(['superadmin']));

// GET  /api/v1/usuarios             — listar con filtros
// POST /api/v1/usuarios             — crear usuario
router.route('/').get(ctrl.listar).post(ctrl.crear);

// GET    /api/v1/usuarios/:id       — detalle
// PUT    /api/v1/usuarios/:id       — actualizar datos / rol / DG / activo
// DELETE /api/v1/usuarios/:id       — baja logica
router.route('/:id').get(ctrl.obtener).put(ctrl.actualizar).delete(ctrl.desactivar);

// PUT /api/v1/usuarios/:id/reset-password
router.put('/:id/reset-password', ctrl.resetPassword);

// GET /api/v1/usuarios/:id/procedimientos
router.get('/:id/procedimientos', ctrl.listarProcedimientosAsignados);

module.exports = router;
