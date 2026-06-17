'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Usuario } = require('../models/usuario.model');

const ROLES_VALIDOS = [
  'administrador',
  'oficialia_mayor',
  'dir_gral_admon',
  'integrante_adquisiciones',
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

  const filtro = {
    $or: [{ rol: { $exists: false } }, { rol: { $nin: ROLES_VALIDOS } }],
  };

  const rolesEncontrados = await Usuario.distinct('rol', filtro);
  const totalAfectado = await Usuario.countDocuments(filtro);

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
  console.log(`Roles detectados: ${rolesEncontrados.map((r) => r ?? '(sin rol)').join(', ')}`);

  const resultado = await Usuario.updateMany(filtro, { $set: { rol: 'administrador' } });

  fs.writeFileSync(
    path.join(process.cwd(), 'migracion-roles-a-admin.json'),
    JSON.stringify(
      {
        success: true,
        migrados: resultado.modifiedCount ?? 0,
        totalDetectado: totalAfectado,
        rolesDetectados: rolesEncontrados,
        fecha: new Date().toISOString(),
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`Usuarios modificados: ${resultado.modifiedCount ?? 0}`);
  console.log('Migracion completada.');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en migracion:', err);
  process.exit(1);
});
