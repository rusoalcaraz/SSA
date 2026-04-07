'use strict';

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const { errorHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// --- Seguridad de encabezados HTTP ---
app.use(helmet());

// --- CORS ---
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// --- Rate limiting global: 100 req / 15 min por IP ---
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'LIMITE_EXCEDIDO',
        message: 'Demasiadas solicitudes. Intente de nuevo en 15 minutos.',
      },
    },
  })
);

// --- Parsers ---
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Sanitizacion NoSQL: elimina operadores $ y . de req.body / req.query / req.params ---
app.use(mongoSanitize());

// --- Rutas de la API ---
app.use('/api/v1', routes);

// --- Ruta de salud ---
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'SSA API operativa' });
});

// --- Ruta no encontrada ---
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'RUTA_NO_ENCONTRADA',
      message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    },
  });
});

// --- Manejador global de errores (debe ir al final) ---
app.use(errorHandler);

module.exports = app;
