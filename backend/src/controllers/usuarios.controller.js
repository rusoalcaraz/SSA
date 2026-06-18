'use strict';

const { Usuario, ROLES } = require('../models/usuario.model');
const { Procedimiento } = require('../models/procedimiento.model');
const { Seccion } = require('../models/seccion.model');
const { crearError } = require('../middleware/errorHandler');
const { ok, creado } = require('../utils/respuesta');
const auditLog = require('../services/auditLog.service');

function escaparRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function esAdmin(usuario) {
  return usuario?.rol === 'administrador';
}

function esAdquisiciones(usuario) {
  return usuario?.rol === 'adquisiciones';
}

function esSubdirector(usuario) {
  return usuario?.rol === 'subdirector';
}

function esJefe(usuario) {
  return usuario?.rol === 'jefe_seccion';
}

function obtenerSubdireccionSolicitante(usuario) {
  if (!usuario?.subdireccionId) {
    throw crearError(400, 'SUBDIRECCION_NO_ASIGNADA', 'El usuario autenticado no tiene subdireccion asignada');
  }
  return String(usuario.subdireccionId);
}

function obtenerSeccionSolicitante(usuario) {
  if (!usuario?.seccionId) {
    throw crearError(400, 'SECCION_NO_ASIGNADA', 'El usuario autenticado no tiene seccion asignada');
  }
  return String(usuario.seccionId);
}

async function validarSeccion(seccionId) {
  const seccion = await Seccion.findOne({ _id: seccionId, activa: true }).select('_id subdireccion');
  if (!seccion) throw crearError(404, 'SECCION_NO_ENCONTRADA', 'Seccion no encontrada o inactiva');
  return seccion;
}

async function listar(req, res, next) {
  try {
    const { rol, activo, subdireccionId, seccionId, q } = req.query;
    const filtro = {};

    if (esAdquisiciones(req.usuario)) {
      filtro.rol = 'asesor_tecnico';
    } else if (esSubdirector(req.usuario)) {
      filtro.subdireccion = obtenerSubdireccionSolicitante(req.usuario);
      filtro.rol = { $in: ['jefe_seccion', 'asesor_tecnico'] };
      if (rol) {
        if (!['jefe_seccion', 'asesor_tecnico'].includes(String(rol))) {
          throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar jefes de seccion y asesores tecnicos');
        }
        filtro.rol = String(rol);
      }
      if (seccionId) filtro.seccion = seccionId;
    } else if (esJefe(req.usuario)) {
      filtro.seccion = obtenerSeccionSolicitante(req.usuario);
      filtro.rol = 'asesor_tecnico';
    } else if (rol) {
      if (!ROLES.includes(rol)) throw crearError(400, 'ROL_INVALIDO', `Rol no valido: ${rol}`);
      filtro.rol = rol;
    }

    if (activo !== undefined) filtro.activo = activo === 'true';

    if (esAdmin(req.usuario) || esAdquisiciones(req.usuario)) {
      if (subdireccionId) filtro.subdireccion = subdireccionId;
      if (seccionId) filtro.seccion = seccionId;
    } else if (esSubdirector(req.usuario) && subdireccionId) {
      if (String(subdireccionId) !== filtro.subdireccion) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios de su propia subdireccion');
      }
    }

    if (q) {
      const qEscapado = escaparRegex(String(q).slice(0, 100)); // limitar longitud
      filtro.$or = [
        { nombre: { $regex: qEscapado, $options: 'i' } },
        { apellidos: { $regex: qEscapado, $options: 'i' } },
        { correo: { $regex: qEscapado, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [usuarios, total] = await Promise.all([
      Usuario.find(filtro)
        .populate('direccionGeneral', 'nombre siglas')
        .populate('subdireccion', 'nombre')
        .populate('seccion', 'nombre subdireccion')
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

async function obtener(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.params.id)
      .populate('direccionGeneral', 'nombre siglas')
      .populate('subdireccion', 'nombre')
      .populate('seccion', 'nombre subdireccion');
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    if (esAdquisiciones(req.usuario)) {
      if (usuario.rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios con rol asesor_tecnico');
      }
    } else if (esSubdirector(req.usuario)) {
      const subId = obtenerSubdireccionSolicitante(req.usuario);
      if (!usuario.subdireccion || String(usuario.subdireccion?._id || usuario.subdireccion) !== subId) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios de su subdireccion');
      }
      if (!['jefe_seccion', 'asesor_tecnico'].includes(usuario.rol) && !usuario._id.equals(req.usuario.id)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar jefes de seccion y asesores tecnicos');
      }
    } else if (esJefe(req.usuario)) {
      const secId = obtenerSeccionSolicitante(req.usuario);
      if (!usuario.seccion || String(usuario.seccion?._id || usuario.seccion) !== secId) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios de su seccion');
      }
      if (usuario.rol !== 'asesor_tecnico' && !usuario._id.equals(req.usuario.id)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar asesores tecnicos');
      }
    }

    return ok(res, usuario);
  } catch (error) {
    next(error);
  }
}

async function crear(req, res, next) {
  try {
    const { nombre, apellidos, correo, contrasena, rol, direccionGeneral, subdireccion, seccion } = req.body;

    if (!nombre || !apellidos || !correo || !contrasena || !rol) {
      throw crearError(400, 'DATOS_REQUERIDOS', 'nombre, apellidos, correo, contrasena y rol son requeridos');
    }
    if (!ROLES.includes(rol)) {
      throw crearError(400, 'ROL_INVALIDO', `Rol no valido: ${rol}`);
    }
    if (contrasena.length < 8) {
      throw crearError(400, 'CONTRASENA_CORTA', 'La contrasena debe tener al menos 8 caracteres');
    }

    if (esAdquisiciones(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'El perfil adquisiciones no puede crear usuarios');
    }

    if (esSubdirector(req.usuario)) {
      if (!['jefe_seccion', 'asesor_tecnico'].includes(rol)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Subdirector solo puede crear jefes de seccion y asesores tecnicos');
      }
    }

    if (esJefe(req.usuario)) {
      if (rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Jefe de seccion solo puede crear asesores tecnicos');
      }
    }

    let subdireccionFinal = subdireccion || null;
    let seccionFinal = seccion || null;

    if (esSubdirector(req.usuario)) {
      subdireccionFinal = obtenerSubdireccionSolicitante(req.usuario);
    }

    if (esJefe(req.usuario)) {
      seccionFinal = obtenerSeccionSolicitante(req.usuario);
    }

    if (rol === 'subdirector') {
      if (!subdireccionFinal) throw crearError(400, 'SUBDIRECCION_REQUERIDA', 'La subdireccion es requerida');
      seccionFinal = null;
    }
    if (rol === 'jefe_seccion' || rol === 'asesor_tecnico') {
      if (!seccionFinal) throw crearError(400, 'SECCION_REQUERIDA', 'La seccion es requerida');
      const sec = await validarSeccion(seccionFinal);
      subdireccionFinal = String(sec.subdireccion);
      if (esSubdirector(req.usuario) && subdireccionFinal !== obtenerSubdireccionSolicitante(req.usuario)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede crear usuarios dentro de su subdireccion');
      }
    }

    if (!esAdmin(req.usuario)) {
      if (direccionGeneral !== undefined) {
        throw crearError(403, 'ACCESO_DENEGADO', 'No puede asignar Direccion General manualmente');
      }
    }

    // El pre-save hashea passwordHash automaticamente
    const usuario = await Usuario.create({
      nombre,
      apellidos,
      correo,
      passwordHash: contrasena,
      rol,
      direccionGeneral: direccionGeneral || null,
      subdireccion: subdireccionFinal,
      seccion: seccionFinal,
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

async function actualizar(req, res, next) {
  try {
    const { nombre, apellidos, rol, direccionGeneral, subdireccion, seccion, activo } = req.body;

    const usuario = await Usuario.findById(req.params.id);
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    if (esAdquisiciones(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'El perfil adquisiciones no puede modificar usuarios');
    }

    if (esSubdirector(req.usuario)) {
      const subId = obtenerSubdireccionSolicitante(req.usuario);
      if (String(usuario.subdireccion || '') !== subId) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede modificar usuarios de su subdireccion');
      }
      if (!['jefe_seccion', 'asesor_tecnico'].includes(usuario.rol)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede modificar jefes de seccion y asesores tecnicos');
      }
    }

    if (esJefe(req.usuario)) {
      const secId = obtenerSeccionSolicitante(req.usuario);
      if (String(usuario.seccion || '') !== secId) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede modificar usuarios de su seccion');
      }
      if (usuario.rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede modificar asesores tecnicos');
      }
    }

    // Impedir que el administrador se quite su propio rol
    if (rol && usuario._id.equals(req.usuario.id) && rol !== 'administrador') {
      throw crearError(409, 'OPERACION_NO_PERMITIDA', 'No puede cambiar su propio rol de administrador');
    }

    if (rol) {
      if (!ROLES.includes(rol)) throw crearError(400, 'ROL_INVALIDO', `Rol no valido: ${rol}`);
      if (esSubdirector(req.usuario) && !['jefe_seccion', 'asesor_tecnico'].includes(rol)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede asignar roles jefe_seccion o asesor_tecnico');
      }
      if (esJefe(req.usuario) && rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede asignar rol asesor_tecnico');
      }
      usuario.rol = rol;
    }

    const rolFinal = rol || usuario.rol;

    let subdireccionFinal = subdireccion !== undefined ? (subdireccion || null) : usuario.subdireccion;
    let seccionFinal = seccion !== undefined ? (seccion || null) : usuario.seccion;

    if (esSubdirector(req.usuario)) {
      subdireccionFinal = obtenerSubdireccionSolicitante(req.usuario);
    }
    if (esJefe(req.usuario)) {
      seccionFinal = obtenerSeccionSolicitante(req.usuario);
    }

    if (rolFinal === 'subdirector') {
      if (!subdireccionFinal) throw crearError(400, 'SUBDIRECCION_REQUERIDA', 'La subdireccion es requerida');
      seccionFinal = null;
    }

    if (rolFinal === 'jefe_seccion' || rolFinal === 'asesor_tecnico') {
      if (!seccionFinal) throw crearError(400, 'SECCION_REQUERIDA', 'La seccion es requerida');
      const sec = await validarSeccion(seccionFinal);
      subdireccionFinal = String(sec.subdireccion);
      if (esSubdirector(req.usuario) && subdireccionFinal !== obtenerSubdireccionSolicitante(req.usuario)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede mantener usuarios dentro de su subdireccion');
      }
    }

    if (!esAdmin(req.usuario) && direccionGeneral !== undefined) {
      throw crearError(403, 'ACCESO_DENEGADO', 'No puede cambiar Direccion General');
    }

    if (nombre !== undefined) usuario.nombre = nombre;
    if (apellidos !== undefined) usuario.apellidos = apellidos;
    if (direccionGeneral !== undefined && esAdmin(req.usuario)) usuario.direccionGeneral = direccionGeneral || null;
    usuario.subdireccion = subdireccionFinal;
    usuario.seccion = seccionFinal;
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

    if (esAdquisiciones(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'El perfil adquisiciones no puede desactivar usuarios');
    }
    if (esSubdirector(req.usuario)) {
      const subId = obtenerSubdireccionSolicitante(req.usuario);
      if (String(usuario.subdireccion || '') !== subId || !['jefe_seccion', 'asesor_tecnico'].includes(usuario.rol)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede desactivar jefes de seccion y asesores de su subdireccion');
      }
    }
    if (esJefe(req.usuario)) {
      const secId = obtenerSeccionSolicitante(req.usuario);
      if (String(usuario.seccion || '') !== secId || usuario.rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede desactivar asesores de su seccion');
      }
    }

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
// DELETE /api/v1/usuarios/:id  — borrado definitivo
// -------------------------------------------------------
async function eliminarDefinitivo(req, res, next) {
  try {
    const usuarioObjetivo = await Usuario.findById(req.params.id).select('+refreshTokens');
    if (!usuarioObjetivo) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    if (esAdquisiciones(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'El perfil adquisiciones no puede borrar usuarios');
    }
    if (esSubdirector(req.usuario)) {
      const subId = obtenerSubdireccionSolicitante(req.usuario);
      if (String(usuarioObjetivo.subdireccion || '') !== subId || !['jefe_seccion', 'asesor_tecnico'].includes(usuarioObjetivo.rol)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede borrar jefes de seccion y asesores de su subdireccion');
      }
    }
    if (esJefe(req.usuario)) {
      const secId = obtenerSeccionSolicitante(req.usuario);
      if (String(usuarioObjetivo.seccion || '') !== secId || usuarioObjetivo.rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede borrar asesores de su seccion');
      }
    }

    await Procedimiento.updateMany(
      { asesorTitular: usuarioObjetivo._id },
      { $set: { asesorTitular: null } }
    );
    await Procedimiento.updateMany(
      { asesorSuplente: usuarioObjetivo._id },
      { $set: { asesorSuplente: null } }
    );

    await Usuario.deleteOne({ _id: usuarioObjetivo._id });

    await auditLog.registrar({
      usuarioId: req.usuario.id,
      accion: 'BORRAR_USUARIO',
      recurso: 'usuario',
      recursoId: usuarioObjetivo._id,
      detalle: { rolBorrado: usuarioObjetivo.rol, correo: usuarioObjetivo.correo },
      req,
    });

    return ok(res, { eliminado: true }, 'Usuario borrado definitivamente');
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

    if (esAdquisiciones(req.usuario)) {
      throw crearError(403, 'ACCESO_DENEGADO', 'El perfil adquisiciones no puede resetear contrasenas');
    }
    if (esSubdirector(req.usuario)) {
      const subId = obtenerSubdireccionSolicitante(req.usuario);
      if (String(usuario.subdireccion || '') !== subId || !['jefe_seccion', 'asesor_tecnico'].includes(usuario.rol)) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede resetear contrasenas en su subdireccion');
      }
    }
    if (esJefe(req.usuario)) {
      const secId = obtenerSeccionSolicitante(req.usuario);
      if (String(usuario.seccion || '') !== secId || usuario.rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede resetear contrasenas en su seccion');
      }
    }

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
    const usuario = await Usuario.findById(req.params.id).select('rol nombre apellidos subdireccion seccion');
    if (!usuario) throw crearError(404, 'USUARIO_NO_ENCONTRADO', 'Usuario no encontrado');

    if (esAdquisiciones(req.usuario)) {
      if (usuario.rol !== 'asesor_tecnico') {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios con rol asesor_tecnico');
      }
    }
    if (esSubdirector(req.usuario)) {
      const subId = obtenerSubdireccionSolicitante(req.usuario);
      if (String(usuario.subdireccion || '') !== subId) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios de su subdireccion');
      }
    }
    if (esJefe(req.usuario)) {
      const secId = obtenerSeccionSolicitante(req.usuario);
      if (String(usuario.seccion || '') !== secId) {
        throw crearError(403, 'ACCESO_DENEGADO', 'Solo puede consultar usuarios de su seccion');
      }
    }

    if (usuario.rol !== 'asesor_tecnico') {
      throw crearError(400, 'ROL_INCOMPATIBLE', 'Esta operacion solo aplica a usuarios con rol asesor_tecnico');
    }

    const procedimientos = await Procedimiento.find({
      $or: [
        { asesorTitular: usuario._id },
        { asesorSuplente: usuario._id },
      ],
    })
      .select('numeroProcedimiento titulo etapaActual urgente direccionGeneral asesorTitular asesorSuplente seccion subdireccion')
      .populate('direccionGeneral', 'nombre siglas')
      .populate('subdireccion', 'nombre')
      .populate('seccion', 'nombre')
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
  eliminarDefinitivo,
  resetPassword,
  listarProcedimientosAsignados,
};
