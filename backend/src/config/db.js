'use strict';

const mongoose = require('mongoose');
const env = require('./env');

async function conectarDB() {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log(`Conexion a MongoDB establecida: ${env.MONGODB_URI}`);
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error.message);
    process.exit(1);
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB desconectado. Intentando reconectar...');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconectado.');
});

module.exports = { conectarDB };
