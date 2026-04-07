'use strict';

/**
 * Script de inicializacion de datos base.
 * Uso: node src/scripts/seed.js
 *
 * - Crea un usuario superadmin si no existe.
 * - Crea las etapas del catalogo si no existen.
 * - Crea bienes/servicios de ejemplo si no existen.
 * - Crea direcciones generales de ejemplo si no existen.
 *
 * Es idempotente: puede ejecutarse multiples veces sin duplicar datos.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { Usuario } = require('../models/usuario.model');
const { CatalogoEtapas } = require('../models/catalogoEtapas.model');
const { CatalogoBienesServicios } = require('../models/catalogoBienesServicios.model');
const { DireccionGeneral } = require('../models/direccionGeneral.model');

// -------------------------------------------------------
// Datos a sembrar
// -------------------------------------------------------
const SUPERADMIN = {
  nombre: 'Admin',
  apellidos: 'Sistema',
  correo: 'admin@ssa.gob.mx',
  passwordHash: 'Admin1234!',   // el pre-save lo hashea
  rol: 'superadmin',
  activo: true,
};

const DIRECCIONES_GENERALES = [
  { nombre: 'Direccion General de Administracion', siglas: 'DGA', descripcion: 'Administracion y finanzas institucionales' },
  { nombre: 'Direccion General de Tecnologias de la Informacion', siglas: 'DGTI', descripcion: 'Infraestructura y sistemas informaticos' },
  { nombre: 'Direccion General Juridica', siglas: 'DGJ', descripcion: 'Asesoria juridica y normatividad' },
  { nombre: 'Direccion General de Planeacion', siglas: 'DGP', descripcion: 'Planeacion institucional y proyectos estrategicos' },
];

const BIENES_SERVICIOS = [
  { clave: 'BS-001', descripcion: 'Equipos de computo de escritorio', tipo: 'bien', unidadMedida: 'Pieza' },
  { clave: 'BS-002', descripcion: 'Equipos de computo portatil', tipo: 'bien', unidadMedida: 'Pieza' },
  { clave: 'BS-003', descripcion: 'Impresoras multifuncionales', tipo: 'bien', unidadMedida: 'Pieza' },
  { clave: 'BS-004', descripcion: 'Licencias de software offimatico', tipo: 'servicio', unidadMedida: 'Licencia' },
  { clave: 'BS-005', descripcion: 'Servicio de mantenimiento preventivo y correctivo de equipos', tipo: 'servicio', unidadMedida: 'Servicio' },
  { clave: 'BS-006', descripcion: 'Mobiliario de oficina', tipo: 'bien', unidadMedida: 'Pieza' },
  { clave: 'BS-007', descripcion: 'Papeleria y utiles de oficina', tipo: 'bien', unidadMedida: 'Paquete' },
  { clave: 'BS-008', descripcion: 'Servicio de capacitacion y adiestramiento', tipo: 'servicio', unidadMedida: 'Curso' },
  { clave: 'BS-009', descripcion: 'Servicio de limpieza y mantenimiento de instalaciones', tipo: 'servicio', unidadMedida: 'Mes' },
  { clave: 'BS-010', descripcion: 'Desarrollo y consultoria de sistemas informaticos', tipo: 'bien_y_servicio', unidadMedida: 'Proyecto' },
];

// Etapas de cronograma — 7 etapas reales del proceso previo a la contratacion
const ETAPAS_CRONOGRAMA = [
  {
    nombre: 'Ficha tecnica, tarjeta de requerimientos y consolidado de necesidades.',
    orden: 1,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
  {
    nombre: 'Constancia de existencias en el almacen (FOCON-02) y requisicion de bienes y servicios (FOCON-03).',
    orden: 2,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
  {
    nombre: 'Entrega de la solicitud de cotizacion (FOCON-04) y criterios de evaluacion.',
    orden: 3,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Investigacion de mercado (FOCON-05).',
    orden: 4,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Informe de la investigacion de mercado.',
    orden: 5,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Estudio de acreditacion.',
    orden: 6,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
  {
    nombre: 'Entrega de la documentacion soporte al area contratante.',
    orden: 7,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
];

// Etapas de hoja de trabajo — 12 etapas del procedimiento de contratacion
const ETAPAS_HOJA_TRABAJO = [
  {
    nombre: 'Entrega de la documentacion soporte al area contratante.',
    orden: 1,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
  {
    nombre: 'Revision de la documentacion soporte por la Seccion Juridica y Asesores Externos del area contratante.',
    orden: 2,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
  {
    nombre: 'Aprobacion del C.A.A.S. S.D.N.',
    orden: 3,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Solicitud para el inicio del procedimiento.',
    orden: 4,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Publicacion de la convocatoria o entrega de la invitacion y/o solicitud de cotizacion.',
    orden: 5,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Junta de aclaraciones.',
    orden: 6,
    obligatoria: false,
  },
  {
    nombre: 'Apertura de propuestas.',
    orden: 7,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Solicitud para la comunicacion del fallo.',
    orden: 8,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Comunicacion del fallo o adjudicacion.',
    orden: 9,
    obligatoria: true,
    diasAlertaUrgente: 3,
  },
  {
    nombre: 'Firma del contrato.',
    orden: 10,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
  {
    nombre: 'Entrega de las fianzas (conforme a lo establecido en la convocatoria).',
    orden: 11,
    obligatoria: false,
  },
  {
    nombre: 'Entrega de los bienes o servicios.',
    orden: 12,
    obligatoria: true,
    diasAlertaUrgente: 5,
  },
];

// -------------------------------------------------------
// Funciones de seed
// -------------------------------------------------------
async function seedSuperadmin() {
  const existe = await Usuario.findOne({ correo: SUPERADMIN.correo });
  if (existe) {
    console.log(`  [skip] Superadmin ya existe: ${SUPERADMIN.correo}`);
    return;
  }
  await Usuario.create(SUPERADMIN);
  console.log(`  [ok]   Superadmin creado: ${SUPERADMIN.correo} / contrasena: Admin1234!`);
}

async function seedDGs() {
  for (const dg of DIRECCIONES_GENERALES) {
    const existe = await DireccionGeneral.findOne({ siglas: dg.siglas });
    if (existe) {
      console.log(`  [skip] DG ya existe: ${dg.siglas}`);
      continue;
    }
    await DireccionGeneral.create(dg);
    console.log(`  [ok]   DG creada: ${dg.siglas}`);
  }
}

async function seedBienesServicios() {
  for (const bs of BIENES_SERVICIOS) {
    const existe = await CatalogoBienesServicios.findOne({ clave: bs.clave });
    if (existe) {
      console.log(`  [skip] Bien/Servicio ya existe: ${bs.clave}`);
      continue;
    }
    await CatalogoBienesServicios.create(bs);
    console.log(`  [ok]   Bien/Servicio creado: ${bs.clave} — ${bs.descripcion}`);
  }
}

async function seedEtapas() {
  // Cronograma — upsert por tipo+orden para que re-ejecutar actualice los nombres
  for (const etapa of ETAPAS_CRONOGRAMA) {
    const resultado = await CatalogoEtapas.findOneAndUpdate(
      { tipo: 'cronograma', orden: etapa.orden },
      { $set: { ...etapa, tipo: 'cronograma', aplicaA: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  [ok]   Etapa cronograma orden ${etapa.orden}: ${resultado.nombre}`);
  }

  // Eliminar etapas de cronograma que ya no existen (orden > 7)
  const eliminadas = await CatalogoEtapas.deleteMany({
    tipo: 'cronograma',
    orden: { $gt: ETAPAS_CRONOGRAMA.length },
  });
  if (eliminadas.deletedCount > 0) {
    console.log(`  [clean] Eliminadas ${eliminadas.deletedCount} etapas de cronograma obsoletas`);
  }

  // Hoja de trabajo — upsert por tipo+orden
  for (const etapa of ETAPAS_HOJA_TRABAJO) {
    const resultado = await CatalogoEtapas.findOneAndUpdate(
      { tipo: 'hoja_de_trabajo', orden: etapa.orden },
      { $set: { ...etapa, tipo: 'hoja_de_trabajo', aplicaA: [] } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  [ok]   Etapa hoja_de_trabajo orden ${etapa.orden}: ${resultado.nombre}`);
  }
}

// -------------------------------------------------------
// Main
// -------------------------------------------------------
async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI no esta definida en el archivo .env');
    process.exit(1);
  }

  console.log('Conectando a MongoDB...');
  await mongoose.connect(uri);
  console.log('Conexion establecida.\n');

  console.log('=== Superadmin ===');
  await seedSuperadmin();

  console.log('\n=== Direcciones Generales ===');
  await seedDGs();

  console.log('\n=== Bienes y Servicios ===');
  await seedBienesServicios();

  console.log('\n=== Etapas del catalogo ===');
  await seedEtapas();

  console.log('\nSeed completado.');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
