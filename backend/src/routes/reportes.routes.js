'use strict';

const { Router } = require('express');
const { verifyToken, checkRole } = require('../middleware/auth');
const ctrl = require('../controllers/reportes.controller');

const router = Router();

router.use(verifyToken);
router.use(checkRole(['superadmin', 'gerencial', 'area_contratante']));

// GET /api/v1/reportes/pdf
router.get('/pdf', ctrl.pdf);

// GET /api/v1/reportes/excel
router.get('/excel', ctrl.excel);

module.exports = router;
