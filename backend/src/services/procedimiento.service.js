'use strict';

const { Procedimiento } = require('../models/procedimiento.model');
const { DireccionGeneral } = require('../models/direccionGeneral.model');
const { CatalogoEtapas } = require('../models/catalogoEtapas.model');
const { crearError } = require('../middleware/errorHandler');

/**
 * Genera el numero de procedimiento con el formato:
 * SSA-{ANIO}-{SIGLAS_DG}-{SECUENCIA_PADDED_4}
 *
 * Ejemplo: SSA-2025-DGMG-0042
 *
 * @param {string|ObjectId} direccionGeneralId
 * @param {number} anioFiscal
 * @returns {Promise<string>}
 */
async function generarNumeroProcedimiento(direccionGeneralId, anioFiscal) {
  const dg = await DireccionGeneral.findById(direccionGeneralId).select('siglas');
  if (!dg) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada');

  const conteo = await Procedimiento.countDocuments({
    direccionGeneral: direccionGeneralId,
    anioFiscal,
  });

  const secuencia = String(conteo + 1).padStart(4, '0');
  return `SSA-${anioFiscal}-${dg.siglas}-${secuencia}`;
}

/**
 * Construye el filtro de consulta de procedimientos segun el rol del usuario.
 *
 * @param {object} usuario - Payload del JWT: { id, rol, dgId }
 * @returns {object} Filtro Mongoose
 */
function filtroByRol(usuario) {
  switch (usuario.rol) {
    case 'superadmin':
    case 'gerencial':
    case 'area_contratante':
      return {};

    case 'asesor_tecnico':
      return {
        $or: [
          { asesorTitular: usuario.id },
          { asesorSuplente: usuario.id },
        ],
      };

    case 'dgt':
      return { direccionGeneral: usuario.dgId };

    default:
      // inspeccion y cualquier otro rol sin acceso al listado general
      return null;
  }
}

/**
 * Verifica que un AT (titular o suplente) tenga acceso al procedimiento.
 */
function esMiProcedimiento(procedimiento, usuarioId) {
  return (
    procedimiento.asesorTitular.equals(usuarioId) ||
    (procedimiento.asesorSuplente && procedimiento.asesorSuplente.equals(usuarioId))
  );
}

/**
 * Inicializa las etapas del cronograma y hoja de trabajo a partir del catalogo
 * segun el tipo de procedimiento.
 *
 * @param {string} tipoProcedimiento
 * @returns {Promise<{ cronograma: object[], hojaDeTrabajoEtapas: object[] }>}
 */
async function inicializarEtapas(tipoProcedimiento) {
  const etapasCatalogo = await CatalogoEtapas.find({
    activa: true,
    $or: [
      { aplicaA: { $size: 0 } }, // aplica a todos
      { aplicaA: tipoProcedimiento },
    ],
  }).sort({ tipo: 1, orden: 1 });

  const cronograma = etapasCatalogo
    .filter((e) => e.tipo === 'cronograma')
    .map((e) => ({
      catalogoEtapa: e._id,
      nombre: e.nombre,
      orden: e.orden,
      obligatoria: e.obligatoria,
      estado: 'pendiente',
    }));

  const hojaDeTrabajoEtapas = etapasCatalogo
    .filter((e) => e.tipo === 'hoja_de_trabajo')
    .map((e) => ({
      catalogoEtapa: e._id,
      nombre: e.nombre,
      orden: e.orden,
      obligatoria: e.obligatoria,
      estado: 'pendiente',
    }));

  return { cronograma, hojaDeTrabajoEtapas };
}

module.exports = {
  generarNumeroProcedimiento,
  filtroByRol,
  esMiProcedimiento,
  inicializarEtapas,
};
