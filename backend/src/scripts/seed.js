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

// Etapas de cronograma — comunes a todos los tipos de procedimiento (aplicaA vacio = aplica a todos)
const ETAPAS_CRONOGRAMA = [
  { nombre: 'Requisicion y autorizacion presupuestal', orden: 1, obligatoria: true, diasAlertaUrgente: 5 },
  { nombre: 'Elaboracion de bases de licitacion', orden: 2, obligatoria: true, diasAlertaUrgente: 5 },
  { nombre: 'Publicacion de convocatoria', orden: 3, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Visita a instalaciones', orden: 4, obligatoria: false },
  { nombre: 'Junta de aclaraciones', orden: 5, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Presentacion y apertura de proposiciones', orden: 6, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Evaluacion tecnica y economica', orden: 7, obligatoria: true, diasAlertaUrgente: 5 },
  { nombre: 'Dictamen de fallo', orden: 8, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Notificacion de fallo', orden: 9, obligatoria: true },
  { nombre: 'Firma de contrato', orden: 10, obligatoria: true, diasAlertaUrgente: 3 },
];

// Etapas especificas: solo aplican a licitacion publica nacional
const ETAPAS_CRONOGRAMA_ESPECIFICAS = [
  {
    nombre: 'Publicacion en CompraNet',
    orden: 11,
    obligatoria: true,
    aplicaA: ['licitacion_publica_nacional', 'licitacion_publica_internacional_libre', 'licitacion_publica_internacional_tratados'],
  },
];

// Etapas de hoja de trabajo — comunes a todos los tipos de procedimiento
const ETAPAS_HOJA_TRABAJO = [
  { nombre: 'Entrega de la documentacion soporte a la D.G.ADMON.', orden: 1, obligatoria: true, diasAlertaUrgente: 5 },
  { nombre: 'Revision de la documentacion soporte por la Seccion Juridica y Asesores Externos de D.G.ADMON.', orden: 2, obligatoria: true, diasAlertaUrgente: 5 },
  { nombre: 'Aprobacion del C.A.A.S. de la S.D.N.', orden: 3, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Solicitud para el inicio del procedimiento (DN-1 u Oficialia Mayor).', orden: 4, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Publicacion de la Convocatoria, o Entrega de la invitacion y/o Solicitud de cotizacion.', orden: 5, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Junta de aclaraciones.', orden: 6, obligatoria: false },
  { nombre: 'Apertura de propuestas.', orden: 7, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Solicitud para la comunicacion del fallo.', orden: 8, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Comunicacion del fallo o adjudicacion.', orden: 9, obligatoria: true, diasAlertaUrgente: 3 },
  { nombre: 'Firma de contrato.', orden: 10, obligatoria: true, diasAlertaUrgente: 5 },
  { nombre: 'Entrega de las fianzas (conforme a lo establecido en la convocatoria).', orden: 11, obligatoria: false },
  { nombre: 'Entrega de los bienes o servicios.', orden: 12, obligatoria: true, diasAlertaUrgente: 5 },
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
  // Cronograma comunes
  for (const etapa of ETAPAS_CRONOGRAMA) {
    const existe = await CatalogoEtapas.findOne({ tipo: 'cronograma', orden: etapa.orden });
    if (existe) {
      console.log(`  [skip] Etapa cronograma orden ${etapa.orden} ya existe`);
      continue;
    }
    await CatalogoEtapas.create({ ...etapa, tipo: 'cronograma', aplicaA: [] });
    console.log(`  [ok]   Etapa cronograma orden ${etapa.orden}: ${etapa.nombre}`);
  }

  // Cronograma especificas
  for (const etapa of ETAPAS_CRONOGRAMA_ESPECIFICAS) {
    const existe = await CatalogoEtapas.findOne({ tipo: 'cronograma', orden: etapa.orden });
    if (existe) {
      console.log(`  [skip] Etapa cronograma orden ${etapa.orden} ya existe`);
      continue;
    }
    await CatalogoEtapas.create({ ...etapa, tipo: 'cronograma' });
    console.log(`  [ok]   Etapa cronograma orden ${etapa.orden}: ${etapa.nombre}`);
  }

  // Hoja de trabajo
  for (const etapa of ETAPAS_HOJA_TRABAJO) {
    const existe = await CatalogoEtapas.findOne({ tipo: 'hoja_de_trabajo', orden: etapa.orden });
    if (existe) {
      console.log(`  [skip] Etapa hoja_de_trabajo orden ${etapa.orden} ya existe`);
      continue;
    }
    await CatalogoEtapas.create({ ...etapa, tipo: 'hoja_de_trabajo', aplicaA: [] });
    console.log(`  [ok]   Etapa hoja_de_trabajo orden ${etapa.orden}: ${etapa.nombre}`);
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
