'use strict';

const { Router } = require('express');
const { verifyToken, checkRole } = require('../middleware/auth');
const ctrl = require('../controllers/dashboard.controller');

const router = Router();

router.use(verifyToken);

// GET /api/v1/dashboard/resumen
router.get(
  '/resumen',
  checkRole(['superadmin', 'gerencial']),
  ctrl.resumen
);

// GET /api/v1/dashboard/por-dg/:dgId
router.get(
  '/por-dg/:dgId',
  checkRole(['superadmin', 'gerencial']),
  ctrl.porDG
);

// GET /api/v1/dashboard/mis-procedimientos
router.get(
  '/mis-procedimientos',
  checkRole(['superadmin', 'area_contratante', 'asesor_tecnico', 'dgt']),
  ctrl.misProcedimientos
);

module.exports = router;
