'use strict';

const { Router } = require('express');
const authRoutes = require('./auth.routes');
const catalogosRoutes = require('./catalogos.routes');
const procedimientosRoutes = require('./procedimientos.routes');
const usuariosRoutes = require('./usuarios.routes');
const dashboardRoutes = require('./dashboard.routes');
const reportesRoutes = require('./reportes.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/catalogos', catalogosRoutes);
router.use('/procedimientos', procedimientosRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reportes', reportesRoutes);

// Los siguientes modulos se registraran conforme se implementen:
// router.use('/dashboard', require('./dashboard.routes'));
// router.use('/reportes', require('./reportes.routes'));
// router.use('/archivos', require('./archivos.routes'));

module.exports = router;
