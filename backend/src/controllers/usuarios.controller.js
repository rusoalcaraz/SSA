'use strict';

const { Usuario, ROLES } = require('../models/usuario.model');
const { Procedimiento } = require('../models/procedimiento.model');
const { DireccionGeneral } = require('../models/direccionGeneral.model');
const { crearError } = require('../middleware/errorHandler');
const { ok, creado } = require('../utils/respuesta');
const auditLog = require('../services/auditLog.service');

// -------------------------------------------------------
// GET /api/v1/usuarios
// -------------------------------------------------------
async function listar(req, res, next) {
  try {
    const { rol, activo, dgId, q } = req.query;
    const filtro = {};

    if (rol) {
      if (!ROLES.includes(rol)) throw crearError(400, 'ROL_INVALIDO', `Rol no valido: ${rol}`);
      filtro.rol = rol;
    }
    if (activo !== undefined) filtro.activo = activo === 'true';
    if (dgId) filtro.direccionGeneral = dgId;
    if (q) {
      filtro.$or = [
        { nombre: { $regex: q, $options: 'i' } },
        { apellidos: { $regex: q, $options: 'i' } },
        { correo: { $regex: q, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtro)
        .populate('direccionGeneral', 'nombre siglas')
        .sort({ apellidos: 1, nombre: 1 })
        .skip(skip)
        .limit(limit),
      Usuario.countDocuments(filtro),
    ]);

    return ok(res, usuarios, 'Usuarios obtenidos', 200, {
      page,
      limit,
      total,
      totalPaginas: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /api/v1/usuarios/:id
// -------------------------------------------------------
async function obtener(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id)
      .populate('direccionGeneral', 'nombre siglas');
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');
    return ok(res, usuario);
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// POST /api/v1/usuarios
// -------------------------------------------------------
async function crear(req, res, next) {
  try {
    const { nombre, apellidos, correo, contrasena, rol, direccionGeneral } = req.body;

    if (!nombre || !apellidos || !correo || !contrasena || !rol) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'nombre, apellidos, correo, contrasena y rol son requeridos');
    }
    if (!ROLES.includes(rol)) {
      throw crearError(400, 'ROL_INVALIDO', `Rol no valido: ${rol}`);
    }
    if (contrasena.length < 8) {
      throw crearError(400, 'CONTRASENA_CORTA', 'La contrasena debe tener al menos 8 caracteres');
    }
    if (rol === 'dgt' && !direccionGeneral) {
      throw crearError(400, 'DG_REQUERIDA', 'La Direccion General es obligatoria para el rol dgt');
    }

    // Verificar que la DG existe si se proporciona
    if (direccionGeneral) {
      const dgExiste = await DireccionGeneral.exists({ _id: direccionGeneral, activa: true });
      if (!dgExiste) throw crearError(404, 'DG_NO_ENCONTRADA', 'Direccion General no encontrada o inactiva');
    }

    // El pre-save hashea passwordHash automaticamente
    const usuario = await Usuario.create({
      nombre,
      apellidos,
      correo,
      passwordHash: contrasena,
      rol,
      direccionGeneral: direccionGeneral || null,
    });

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'CREAR_USUARIO',
      recurso: 'usuario',
      recursoId: usuario._id,
      detalle: { correo, rol },
      req,
    });

    // No exponer passwordHash en la respuesta
    const respuesta = usuario.toObject();
    delete respuesta.passwordHash;

    return creado(res, respuesta, 'Usuario creado correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/usuarios/:id
// -------------------------------------------------------
async function actualizar(req, res, next) {
  try {
    const { nombre, apellidos, rol, direccionGeneral, activo } = req.body;

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    // Impedir que el superadmin se quite su propio rol
    if (rol && usuario._id.equals(req.usuario.id) && rol !== 'superadmin') {
      throw crearError(409, 'OPERACION_NO_PERMITIDA', 'No puede cambiar su propio rol de superadmin');
    }

    if (rol) {
      if (!ROLES.includes(rol)) throw crearError(400, 'ROL_INVALIDO', `Rol no valido: ${rol}`);
      usuario.rol = rol;
    }

    // Validar DG si el nuevo rol es dgt
    const rolFinal = rol || usuario.rol;
    if (rolFinal === 'dgt') {
      const dgFinal = direccionGeneral !== undefined ? direccionGeneral : usuario.direccionGeneral;
      if (!dgFinal) throw crearError(400, 'DG_REQUERIDA', 'La Direccion General es obligatoria para el rol dgt');
    }

    if (nombre !== undefined) usuario.nombre = nombre;
    if (apellidos !== undefined) usuario.apellidos = apellidos;
    if (direccionGeneral !== undefined) usuario.direccionGeneral = direccionGeneral || null;
    if (activo !== undefined) usuario.activo = activo;

    // Si se desactiva el usuario, invalidar todos sus refresh tokens
    if (activo === false) usuario.refreshTokens = [];

    await usuario.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'ACTUALIZAR_USUARIO',
      recurso: 'usuario',
      recursoId: usuario._id,
      detalle: { cambios: { nombre, apellidos, rol, direccionGeneral, activo } },
      req,
    });

    const respuesta = usuario.toObject();
    delete respuesta.passwordHash;
    delete respuesta.refreshTokens;

    return ok(res, respuesta, 'Usuario actualizado correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// DELETE /api/v1/usuarios/:id  — baja logica
// -------------------------------------------------------
async function desactivar(req, res, next) {
  try {
    if (req.params.id === req.usuario.id) {
      throw crearError(409, 'OPERACION_NO_PERMITIDA', 'No puede desactivar su propia cuenta');
    }

    const usuario = await Usuario.findById(req.params.id).select('+refreshTokens');
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');
    if (!usuario.activo) throw crearError(409, 'USUARIO_YA_INACTIVO', 'El usuario ya esta inactivo');

    usuario.activo = false;
    usuario.refreshTokens = [];
    await usuario.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'DESACTIVAR_USUARIO',
      recurso: 'usuario',
      recursoId: usuario._id,
      req,
    });

    return ok(res, null, 'Usuario desactivado correctamente');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// PUT /api/v1/usuarios/:id/reset-password
// Solo superadmin puede resetear la contrasena de otro usuario.
// -------------------------------------------------------
async function resetPassword(req, res, next) {
  try {
    const { contrasenaNueva } = req.body;
    if (!contrasenaNueva || contrasenaNueva.length < 8) {
      throw crearError(400, 'CONTRASENA_INVALIDA', 'La contrasena nueva debe tener al menos 8 caracteres');
    }

    const usuario = await Usuario.findById(req.params.id).select('+passwordHash +refreshTokens');
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    usuario.passwordHash = contrasenaNueva; // el pre-save lo hashea
    usuario.refreshTokens = [];             // fuerza re-login
    await usuario.save();

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'RESET_PASSWORD',
      recurso: 'usuario',
      recursoId: usuario._id,
      req,
    });

    return ok(res, null, 'Contrasena reseteada. El usuario debera iniciar sesion nuevamente.');
  } catch (error) {
    next(error);
  }
}

// -------------------------------------------------------
// GET /api/v1/usuarios/:id/procedimientos
// Procedimientos asignados a un asesor tecnico (consulta rapida para el superadmin).
// -------------------------------------------------------
async function listarProcedimientosAsignados(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id).select('rol nombre apellidos');
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    if (usuario.rol !== 'asesor_tecnico') {
      throw crearError(400, 'ROL_INCOMPATIBLE', 'Esta operacion solo aplica a usuarios con rol asesor_tecnico');
    }

    const procedimientos = await Procedimiento.find({
      $or: [
        { asesorTitular: usuario._id },
        { asesorSuplente: usuario._id },
      ],
    })
      .select('numeroProcedimiento titulo etapaActual urgente direccionGeneral asesorTitular asesorSuplente')
      .populate('direccionGeneral', 'nombre siglas')
      .sort({ createdAt: -1 });

    return ok(res, procedimientos, `Procedimientos asignados a ${usuario.nombre} ${usuario.apellidos}`);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  desactivar,
  resetPassword,
  listarProcedimientosAsignados,
};
