'use strict';

require('./src/config/env'); // Valida variables de entorno al arranque
const { conectarDB } = require('./src/config/db');
const app = require('./src/app');
const env = require('./src/config/env');
const { iniciarCronJobs } = require('./src/services/cron.service');

async function iniciar() {
  await conectarDB();

  iniciarCronJobs();

  const servidor = app.listen(env.PORT, () => {
    console.log(`Servidor SSA corriendo en puerto ${env.PORT} [${env.NODE_ENV}]`);
  });

  // Cierre elegante
  function cerrar(senal) {
    console.log(`Senal ${senal} recibida. Cerrando servidor...`);
    servidor.close(() => {
      console.log('Servidor cerrado.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => cerrar('SIGTERM'));
  process.on('SIGINT', () => cerrar('SIGINT'));
}

iniciar();
