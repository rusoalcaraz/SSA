'use strict';

const { Router } = require('express');
const { verifyToken } = require('../middleware/auth');
const authController = require('../controllers/auth.controller');

const router = Router();

// POST /api/v1/auth/login
router.post('/login', authController.login);

// POST /api/v1/auth/logout
router.post('/logout', verifyToken, authController.logout);

// POST /api/v1/auth/refresh
router.post('/refresh', authController.refresh);

// PUT /api/v1/auth/cambiar-password
router.put('/cambiar-password', verifyToken, authController.cambiarPassword);

module.exports = router;
