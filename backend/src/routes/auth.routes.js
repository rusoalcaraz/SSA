'use strict';

const { Router } = require('express');
const { verifyToken, actualizarActividad } = require('../middleware/auth');
const { limitarAuth } = require('../middleware/rateLimiters');
const authController = require('../controllers/auth.controller');

const router = Router();

// POST /api/v1/auth/login — rate limit estricto por IP
router.post('/login', limitarAuth, authController.login);

// POST /api/v1/auth/logout
router.post('/logout', verifyToken, authController.logout);

// POST /api/v1/auth/refresh — rate limit estricto por IP
router.post('/refresh', limitarAuth, authController.refresh);

// PUT /api/v1/auth/cambiar-password
router.put('/cambiar-password', verifyToken, actualizarActividad, authController.cambiarPassword);

module.exports = router;
