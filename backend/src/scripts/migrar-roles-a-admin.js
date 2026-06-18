'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Usuario } = require('../models/usuario.model');

const ROLES_VALIDOS = [
  'administrador',
  'adquisiciones',
  'subdirector',
  'jefe_seccion',
  'asesor_tecnico',
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI no esta definida en el archivo .env');
    process.exit(1);
  }

  console.log('Conectando a MongoDB...');
  await mongoose.connect(uri);
  console.log('Conexion establecida.\n');

  const filtroIntegranteLegacy = { rol: 'integrante_adquisiciones' };
  const filtroFueraCatalogo = { $or: [{ rol: { $exists: false } }, { rol: { $nin: ROLES_VALIDOS } }] };

  const totalIntegrantesLegacy = await Usuario.countDocuments(filtroIntegranteLegacy);
  const rolesEncontrados = await Usuario.distinct('rol', filtroFueraCatalogo);
  const totalFueraCatalogo = await Usuario.countDocuments(filtroFueraCatalogo);
  const totalAfectado = totalIntegrantesLegacy + totalFueraCatalogo;

  if (totalAfectado === 0) {
    console.log('No hay usuarios con roles fuera del catalogo actual.');
    fs.writeFileSync(
      path.join(process.cwd(), 'migracion-roles-a-admin.json'),
      JSON.stringify(
        {
          success: true,
          migrados: 0,
          rolesDetectados: [],
          fecha: new Date().toISOString(),
        },
        null,
        2
      ),
      'utf8'
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`Usuarios a migrar: ${totalAfectado}`);
  if (totalIntegrantesLegacy > 0) console.log(`Integrantes legacy: ${totalIntegrantesLegacy} -> adquisiciones`);
  if (totalFueraCatalogo > 0) {
    console.log(`Fuera de catalogo: ${totalFueraCatalogo}`);
    console.log(`Roles detectados: ${rolesEncontrados.map((r) => r ?? '(sin rol)').join(', ')}`);
  }

  const [resultadoIntegrantes, resultadoFueraCatalogo] = await Promise.all([
    Usuario.updateMany(filtroIntegranteLegacy, { $set: { rol: 'adquisiciones' } }),
    Usuario.updateMany(filtroFueraCatalogo, { $set: { rol: 'administrador' } }),
  ]);
  const migrados = (resultadoIntegrantes.modifiedCount ?? 0) + (resultadoFueraCatalogo.modifiedCount ?? 0);

  fs.writeFileSync(
    path.join(process.cwd(), 'migracion-roles-a-admin.json'),
    JSON.stringify(
      {
        success: true,
        migrados,
        migradosIntegrantesLegacy: resultadoIntegrantes.modifiedCount ?? 0,
        migradosFueraCatalogo: resultadoFueraCatalogo.modifiedCount ?? 0,
        totalDetectado: totalAfectado,
        rolesDetectados: rolesEncontrados,
        fecha: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Usuarios modificados: ${migrados}`);
  console.log('Migracion completada.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en migracion:', err);
  process.exit(1);
});
