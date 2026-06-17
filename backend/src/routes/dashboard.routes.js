'use strict';

const { Router } = require('express');
const { verifyToken, checkRole, actualizarActividad } = require('../middleware/auth');
const { limitarPorUsuario } = require('../middleware/rateLimiters');
const ctrl = require('../controllers/dashboard.controller');

const router = Router();

router.use(verifyToken, actualizarActividad, limitarPorUsuario);

// GET /api/v1/dashboard/resumen
router.get(
  '/resumen',
  checkRole(['administrador', 'oficialia_mayor', 'dir_gral_admon']),
  ctrl.resumen
);

// GET /api/v1/dashboard/por-dg/:dgId
router.get(
  '/por-dg/:dgId',
  checkRole(['administrador', 'oficialia_mayor', 'dir_gral_admon']),
  ctrl.porDG
);

// GET /api/v1/dashboard/mis-procedimientos
router.get(
  '/mis-procedimientos',
  checkRole(['administrador', 'integrante_adquisiciones', 'asesor_tecnico']),
  ctrl.misProcedimientos
);

// GET /api/v1/dashboard/kpi-detalle
router.get(
  '/kpi-detalle',
  checkRole(['administrador', 'oficialia_mayor', 'dir_gral_admon']),
  ctrl.kpiDetalle
);

module.exports = router;
