import { useState, useEffect, useCallback } from 'react'
import type { Rol, DireccionGeneral, Subdireccion, Seccion, Paginacion as PaginacionTipo } from '../../types'
import {
  usuariosService,
  type UsuarioCompleto,
  type CrearUsuarioPayload,
  type ActualizarUsuarioPayload,
} from '../../services/usuarios.service'
import { catalogosService } from '../../services/catalogos.service'
import { mensajeDeError } from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Paginacion } from '../../components/ui/Paginacion'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'

const ROLES_VALIDOS: Rol[] = [
  'administrador',
  'adquisiciones',
  'subdirector',
  'jefe_seccion',
  'asesor_tecnico',
]

const ETIQUETA_ROL: Record<Rol, string> = {
  administrador: 'Administrador',
  adquisiciones: 'Adquisiciones',
  subdirector: 'Subdirector',
  jefe_seccion: 'Jefe de sección',
  asesor_tecnico: 'Asesor técnico',
}

const ROL_COLOR: Record<Rol, string> = {
  administrador: 'bg-red-100 text-red-700',
  adquisiciones: 'bg-blue-100 text-blue-800',
  subdirector: 'bg-purple-100 text-purple-800',
  jefe_seccion: 'bg-indigo-100 text-indigo-800',
  asesor_tecnico: 'bg-teal-100 text-teal-800',
}

function rolRequiereOrganismo(rol: Rol) {
  return Boolean(rol && false)
}

function obtenerIdOrganismo(valor: string | DireccionGeneral | null | undefined) {
  if (!valor) return ''
  return typeof valor === 'string' ? valor : valor._id
}

function SelectDG({
  value,
  onChange,
  dgs,
  requerido,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  dgs: DireccionGeneral[]
  requerido?: boolean
  disabled?: boolean
}) {
  return (
    <select
      required={requerido}
      disabled={disabled}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 disabled:bg-gray-50"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Sin organismo —</option>
      {dgs.map((dg) => (
        <option key={dg._id} value={dg._id}>
          {dg.siglas} — {dg.nombre}
        </option>
      ))}
    </select>
  )
}

function ModalCrearUsuario({
  dgs,
  rolesDisponibles,
  organismoFijo,
  onGuardado,
  onClose,
}: {
  dgs: DireccionGeneral[]
  rolesDisponibles: Rol[]
  organismoFijo?: string
  onGuardado: () => void
  onClose: () => void
}) {
  const rolInicial = rolesDisponibles[0] ?? 'asesor_tecnico'
  const [form, setForm] = useState<CrearUsuarioPayload>({
    nombre: '',
    apellidos: '',
    correo: '',
    contrasena: '',
    rol: rolInicial,
    direccionGeneral: organismoFijo ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const organismoBloqueado = Boolean(organismoFijo)
  const organismoRequerido = rolRequiereOrganismo(form.rol)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      const payload: CrearUsuarioPayload = {
        ...form,
        direccionGeneral: organismoBloqueado
          ? organismoFijo
          : (form.direccionGeneral || undefined),
      }
      await usuariosService.crear(payload)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nuevo usuario" onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.nombre}
              onChange={(e) => setForm((valorActual) => ({ ...valorActual, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Apellidos <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.apellidos}
              onChange={(e) => setForm((valorActual) => ({ ...valorActual, apellidos: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correo electrónico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.correo}
            onChange={(e) => setForm((valorActual) => ({ ...valorActual, correo: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contraseña <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.contrasena}
            onChange={(e) => setForm((valorActual) => ({ ...valorActual, contrasena: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rol <span className="text-red-500">*</span>
          </label>
          <select
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.rol}
            onChange={(e) =>
              setForm((valorActual) => ({
                ...valorActual,
                rol: e.target.value as Rol,
                direccionGeneral: organismoBloqueado ? organismoFijo ?? '' : valorActual.direccionGeneral,
              }))
            }
          >
            {rolesDisponibles.map((rol) => (
              <option key={rol} value={rol}>
                {ETIQUETA_ROL[rol]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organismo{organismoRequerido && <span className="text-red-500"> *</span>}
          </label>
          <SelectDG
            value={organismoBloqueado ? (organismoFijo ?? '') : (form.direccionGeneral ?? '')}
            onChange={(valor) => setForm((valorActual) => ({ ...valorActual, direccionGeneral: valor }))}
            dgs={dgs}
            requerido={organismoRequerido}
            disabled={organismoBloqueado}
          />
          {organismoBloqueado && (
            <p className="text-xs text-gray-400 mt-1">El organismo se toma de su perfil.</p>
          )}
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Crear usuario'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalEditarUsuario({
  usuario,
  dgs,
  rolesDisponibles,
  organismoFijo,
  onGuardado,
  onClose,
}: {
  usuario: UsuarioCompleto
  dgs: DireccionGeneral[]
  rolesDisponibles: Rol[]
  organismoFijo?: string
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ActualizarUsuarioPayload>({
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    rol: usuario.rol,
    direccionGeneral: organismoFijo ?? obtenerIdOrganismo(usuario.direccionGeneral),
    activo: usuario.activo,
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const organismoBloqueado = Boolean(organismoFijo)
  const organismoRequerido = rolRequiereOrganismo(form.rol ?? usuario.rol)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      await usuariosService.actualizar(usuario._id, {
        ...form,
        direccionGeneral: organismoBloqueado
          ? organismoFijo
          : (form.direccionGeneral || undefined),
      })
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Editar usuario" onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.nombre ?? ''}
              onChange={(e) => setForm((valorActual) => ({ ...valorActual, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.apellidos ?? ''}
              onChange={(e) => setForm((valorActual) => ({ ...valorActual, apellidos: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.rol}
            onChange={(e) => setForm((valorActual) => ({ ...valorActual, rol: e.target.value as Rol }))}
          >
            {rolesDisponibles.map((rol) => (
              <option key={rol} value={rol}>
                {ETIQUETA_ROL[rol]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organismo{organismoRequerido && <span className="text-red-500"> *</span>}
          </label>
          <SelectDG
            value={organismoBloqueado ? (organismoFijo ?? '') : (form.direccionGeneral ?? '')}
            onChange={(valor) => setForm((valorActual) => ({ ...valorActual, direccionGeneral: valor }))}
            dgs={dgs}
            requerido={organismoRequerido}
            disabled={organismoBloqueado}
          />
          {organismoBloqueado && (
            <p className="text-xs text-gray-400 mt-1">El organismo se mantiene fijo por su perfil.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activo"
            checked={form.activo ?? true}
            onChange={(e) => setForm((valorActual) => ({ ...valorActual, activo: e.target.checked }))}
            className="rounded border-gray-300 text-blue-900 focus:ring-blue-900"
          />
          <label htmlFor="activo" className="text-sm text-gray-700">
            Usuario activo
          </label>
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalResetPassword({
  usuario,
  onGuardado,
  onClose,
}: {
  usuario: UsuarioCompleto
  onGuardado: () => void
  onClose: () => void
}) {
  const [contrasena, setContrasena] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      await usuariosService.resetPassword(usuario._id, contrasena)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Resetear contraseña" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Se asignará una nueva contraseña a{' '}
          <strong>{usuario.nombre} {usuario.apellidos}</strong>. El usuario deberá iniciar sesión nuevamente.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contraseña <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres</p>
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Reseteando...' : 'Resetear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalEliminarUsuario({
  usuario,
  esAutoBorrado,
  onGuardado,
  onClose,
}: {
  usuario: UsuarioCompleto
  esAutoBorrado: boolean
  onGuardado: () => void
  onClose: () => void
}) {
  const [borrando, setBorrando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleEliminar() {
    setBorrando(true)
    setErrorMsg(null)
    try {
      await usuariosService.eliminar(usuario._id)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setBorrando(false)
    }
  }

  return (
    <Modal titulo="Borrar usuario" onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-gray-700">
          <p>
            ¿Está de acuerdo en borrar definitivamente a{' '}
            <strong>{usuario.nombre} {usuario.apellidos}</strong>?
          </p>
          <p className="text-red-700 mt-2">
            Esta acción es irreversible.
          </p>
          {esAutoBorrado && (
            <p className="text-red-700 mt-2">
              Está a punto de borrar su propia cuenta. Puede perder acceso inmediatamente.
            </p>
          )}
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={borrando}
            onClick={handleEliminar}
            className="px-4 py-2 text-sm rounded-md bg-red-700 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {borrando ? 'Borrando...' : 'Sí, borrar'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function Usuarios() {
  const { usuario, tieneRol } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([])
  const [dgs, setDgs] = useState<DireccionGeneral[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [paginacion, setPaginacion] = useState<PaginacionTipo | null>(null)

  const [filtroRol, setFiltroRol] = useState<string>('')
  const [filtroActivo, setFiltroActivo] = useState<string>('')
  const [filtroQ, setFiltroQ] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState<UsuarioCompleto | null>(null)
  const [modalReset, setModalReset] = useState<UsuarioCompleto | null>(null)
  const [modalEliminar, setModalEliminar] = useState<UsuarioCompleto | null>(null)

  const esAdministrador = tieneRol('administrador')
  const esAdquisiciones = tieneRol('adquisiciones')
  const esSubdirector = tieneRol('subdirector')
  const esJefe = tieneRol('jefe_seccion')

  const rolesDisponibles: Rol[] = esAdministrador
    ? ROLES_VALIDOS
    : esSubdirector
      ? ['jefe_seccion', 'asesor_tecnico']
      : esJefe
        ? ['asesor_tecnico']
        : []

  const rolesFiltrables: Rol[] = esAdquisiciones
    ? ['asesor_tecnico']
    : esSubdirector
      ? ['jefe_seccion', 'asesor_tecnico']
      : esJefe
        ? ['asesor_tecnico']
        : ROLES_VALIDOS

  const cargar = useCallback(() => {
    setCargando(true)
    const rolConsulta = esAdquisiciones || esJefe ? 'asesor_tecnico' : filtroRol
    usuariosService
      .listar({
        page: pagina,
        limit: 20,
        ...(rolConsulta ? { rol: rolConsulta as Rol } : {}),
        ...(filtroActivo !== '' ? { activo: filtroActivo === 'true' } : {}),
        ...(busqueda ? { q: busqueda } : {}),
      })
      .then(({ usuarios: lista, pagination }) => {
        setUsuarios(lista)
        setPaginacion(pagination)
      })
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [pagina, filtroRol, filtroActivo, busqueda, esAdquisiciones, esJefe])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    catalogosService
      .listarDGs(false)
      .then(setDgs)
      .catch(() => {})
  }, [])

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setPagina(1)
    setBusqueda(filtroQ)
  }

  function puedeGestionarUsuario(usuarioFila: UsuarioCompleto) {
    if (esAdministrador) return true
    if (esSubdirector) return usuarioFila.rol === 'jefe_seccion' || usuarioFila.rol === 'asesor_tecnico'
    if (esJefe) return usuarioFila.rol === 'asesor_tecnico'
    return false
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
          {esAdquisiciones && (
            <p className="text-sm text-gray-500 mt-1">Solo consulta: se muestran únicamente asesores técnicos.</p>
          )}
        </div>
        {(esAdministrador || esSubdirector || esJefe) && rolesDisponibles.length > 0 && (
          <button
            type="button"
            onClick={() => setModalCrear(true)}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
          >
            Nuevo usuario
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4">
        <form onSubmit={handleBuscar} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
            <select
              disabled={esAdquisiciones || esJefe}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={(esAdquisiciones || esJefe) ? 'asesor_tecnico' : filtroRol}
              onChange={(e) => { setFiltroRol(e.target.value); setPagina(1) }}
            >
              {!(esAdquisiciones || esJefe) && <option value="">Todos</option>}
              {rolesFiltrables.map((rol) => (
                <option key={rol} value={rol}>{ETIQUETA_ROL[rol]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Estado</label>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={filtroActivo}
              onChange={(e) => { setFiltroActivo(e.target.value); setPagina(1) }}
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Nombre, apellido o correo..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm w-56 focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={filtroQ}
              onChange={(e) => setFiltroQ(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Buscar
          </button>
        </form>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-20">
          <Spinner className="text-blue-900" />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-4">
            {usuarios.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-400">Sin resultados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Correo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Rol</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Área</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                    {(esAdministrador || esSubdirector || esJefe) && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((usuarioFila) => (
                    <tr key={usuarioFila._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {usuarioFila.nombre} {usuarioFila.apellidos}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{usuarioFila.correo}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROL_COLOR[usuarioFila.rol]}`}
                        >
                          {ETIQUETA_ROL[usuarioFila.rol]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {(() => {
                          const sec = usuarioFila.seccion as unknown as Seccion | string | null | undefined
                          const sub = usuarioFila.subdireccion as unknown as Subdireccion | string | null | undefined
                          if (sec && typeof sec !== 'string') {
                            const subNombre = sec.subdireccion?.nombre ?? ''
                            return subNombre ? `${subNombre} / ${sec.nombre}` : sec.nombre
                          }
                          if (sub && typeof sub !== 'string') return sub.nombre
                          return '—'
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            usuarioFila.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {usuarioFila.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {(esAdministrador || esSubdirector || esJefe) && (
                        <td className="px-4 py-3">
                          {puedeGestionarUsuario(usuarioFila) ? (
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => setModalEditar(usuarioFila)}
                                className="text-xs text-blue-700 hover:underline"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalReset(usuarioFila)}
                                className="text-xs text-orange-600 hover:underline"
                              >
                                Reset pwd
                              </button>
                              <button
                                type="button"
                                onClick={() => setModalEliminar(usuarioFila)}
                                className="text-xs text-red-700 hover:underline"
                              >
                                Borrar
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {paginacion && paginacion.totalPaginas > 1 && (
            <Paginacion paginacion={paginacion} onChange={setPagina} />
          )}
        </>
      )}

      {modalCrear && (
        <ModalCrearUsuario
          dgs={dgs}
          rolesDisponibles={rolesDisponibles}
          onGuardado={() => { setModalCrear(false); cargar() }}
          onClose={() => setModalCrear(false)}
        />
      )}
      {modalEditar && (
        <ModalEditarUsuario
          usuario={modalEditar}
          dgs={dgs}
          rolesDisponibles={rolesDisponibles}
          onGuardado={() => { setModalEditar(null); cargar() }}
          onClose={() => setModalEditar(null)}
        />
      )}
      {modalReset && (
        <ModalResetPassword
          usuario={modalReset}
          onGuardado={() => { setModalReset(null) }}
          onClose={() => setModalReset(null)}
        />
      )}
      {modalEliminar && (
        <ModalEliminarUsuario
          usuario={modalEliminar}
          esAutoBorrado={Boolean(usuario && modalEliminar._id === usuario._id)}
          onGuardado={() => { setModalEliminar(null); cargar() }}
          onClose={() => setModalEliminar(null)}
        />
      )}
    </div>
  )
}
