import { useState, useEffect, useCallback } from 'react'
import type { Rol, DireccionGeneral } from '../../types'
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

const ROLES_VALIDOS: Rol[] = [
  'superadmin',
  'gerencial',
  'area_contratante',
  'asesor_tecnico',
  'dgt',
  'inspeccion',
]

const ETIQUETA_ROL: Record<Rol, string> = {
  superadmin: 'Superadmin',
  gerencial: 'Gerencial',
  area_contratante: 'Area Contratante',
  asesor_tecnico: 'Asesor Tecnico',
  dgt: 'DGT',
  inspeccion: 'Inspeccion',
}

const ROL_COLOR: Record<Rol, string> = {
  superadmin: 'bg-red-100 text-red-700',
  gerencial: 'bg-purple-100 text-purple-800',
  area_contratante: 'bg-blue-100 text-blue-800',
  asesor_tecnico: 'bg-teal-100 text-teal-800',
  dgt: 'bg-orange-100 text-orange-800',
  inspeccion: 'bg-gray-100 text-gray-600',
}

// -------------------------------------------------------
// Selector de DG (reutilizable en modales)
// -------------------------------------------------------
function SelectDG({
  value,
  onChange,
  dgs,
  requerido,
}: {
  value: string
  onChange: (v: string) => void
  dgs: DireccionGeneral[]
  requerido?: boolean
}) {
  return (
    <select
      required={requerido}
      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— Sin DG —</option>
      {dgs.map((dg) => (
        <option key={dg._id} value={dg._id}>
          {dg.siglas} — {dg.nombre}
        </option>
      ))}
    </select>
  )
}

// -------------------------------------------------------
// Modal crear usuario
// -------------------------------------------------------
function ModalCrearUsuario({
  dgs,
  onGuardado,
  onClose,
}: {
  dgs: DireccionGeneral[]
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<CrearUsuarioPayload>({
    nombre: '',
    apellidos: '',
    correo: '',
    contrasena: '',
    rol: 'asesor_tecnico',
    direccionGeneral: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      const payload: CrearUsuarioPayload = {
        ...form,
        ...(form.direccionGeneral ? {} : { direccionGeneral: undefined }),
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
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Correo electronico <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.correo}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contrasena <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.contrasena}
            onChange={(e) => setForm((f) => ({ ...f, contrasena: e.target.value }))}
          />
          <p className="text-xs text-gray-400 mt-1">Minimo 8 caracteres</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rol <span className="text-red-500">*</span>
          </label>
          <select
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
          >
            {ROLES_VALIDOS.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Direccion General{form.rol === 'dgt' && <span className="text-red-500"> *</span>}
          </label>
          <SelectDG
            value={form.direccionGeneral ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, direccionGeneral: v }))}
            dgs={dgs}
            requerido={form.rol === 'dgt'}
          />
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

// -------------------------------------------------------
// Modal editar usuario
// -------------------------------------------------------
function ModalEditarUsuario({
  usuario,
  dgs,
  onGuardado,
  onClose,
}: {
  usuario: UsuarioCompleto
  dgs: DireccionGeneral[]
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ActualizarUsuarioPayload>({
    nombre: usuario.nombre,
    apellidos: usuario.apellidos,
    rol: usuario.rol,
    direccionGeneral: (usuario.direccionGeneral as unknown as DireccionGeneral)?._id ?? '',
    activo: usuario.activo,
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      await usuariosService.actualizar(usuario._id, {
        ...form,
        direccionGeneral: form.direccionGeneral || undefined,
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
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
            <input
              type="text"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.apellidos ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as Rol }))}
          >
            {ROLES_VALIDOS.map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Direccion General{form.rol === 'dgt' && <span className="text-red-500"> *</span>}
          </label>
          <SelectDG
            value={form.direccionGeneral ?? ''}
            onChange={(v) => setForm((f) => ({ ...f, direccionGeneral: v }))}
            dgs={dgs}
            requerido={form.rol === 'dgt'}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="activo"
            checked={form.activo ?? true}
            onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
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

// -------------------------------------------------------
// Modal reset password
// -------------------------------------------------------
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
    <Modal titulo="Resetear contrasena" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Se asignara una nueva contrasena a{' '}
          <strong>{usuario.nombre} {usuario.apellidos}</strong>. El usuario debera iniciar sesion nuevamente.
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nueva contrasena <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-1">Minimo 8 caracteres</p>
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

// -------------------------------------------------------
// Pagina principal
// -------------------------------------------------------
export function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioCompleto[]>([])
  const [dgs, setDgs] = useState<DireccionGeneral[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [totalPaginas, setTotalPaginas] = useState(1)

  const [filtroRol, setFiltroRol] = useState<string>('')
  const [filtroActivo, setFiltroActivo] = useState<string>('')
  const [filtroQ, setFiltroQ] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const [modalCrear, setModalCrear] = useState(false)
  const [modalEditar, setModalEditar] = useState<UsuarioCompleto | null>(null)
  const [modalReset, setModalReset] = useState<UsuarioCompleto | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    usuariosService
      .listar({
        page: pagina,
        limit: 20,
        ...(filtroRol ? { rol: filtroRol as Rol } : {}),
        ...(filtroActivo !== '' ? { activo: filtroActivo === 'true' } : {}),
        ...(busqueda ? { q: busqueda } : {}),
      })
      .then(({ usuarios: u, pagination }) => {
        setUsuarios(u)
        setTotalPaginas(pagination.totalPaginas)
      })
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [pagina, filtroRol, filtroActivo, busqueda])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    catalogosService.listarDGs(false).then(setDgs).catch(() => {})
  }, [])

  function handleBuscar(e: React.FormEvent) {
    e.preventDefault()
    setPagina(1)
    setBusqueda(filtroQ)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Usuarios</h1>
        <button
          type="button"
          onClick={() => setModalCrear(true)}
          className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nuevo usuario
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4">
        <form onSubmit={handleBuscar} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Rol</label>
            <select
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={filtroRol}
              onChange={(e) => { setFiltroRol(e.target.value); setPagina(1) }}
            >
              <option value="">Todos</option>
              {ROLES_VALIDOS.map((r) => (
                <option key={r} value={r}>{ETIQUETA_ROL[r]}</option>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">DG</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {u.nombre} {u.apellidos}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.correo}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ROL_COLOR[u.rol]}`}
                        >
                          {ETIQUETA_ROL[u.rol]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {u.direccionGeneral
                          ? (u.direccionGeneral as unknown as DireccionGeneral)?.siglas ?? u.direccionGeneral
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            u.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {u.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => setModalEditar(u)}
                            className="text-xs text-blue-700 hover:underline"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => setModalReset(u)}
                            className="text-xs text-orange-600 hover:underline"
                          >
                            Reset pwd
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {totalPaginas > 1 && (
            <Paginacion
              paginaActual={pagina}
              totalPaginas={totalPaginas}
              onChange={setPagina}
            />
          )}
        </>
      )}

      {modalCrear && (
        <ModalCrearUsuario
          dgs={dgs}
          onGuardado={() => { setModalCrear(false); cargar() }}
          onClose={() => setModalCrear(false)}
        />
      )}
      {modalEditar && (
        <ModalEditarUsuario
          usuario={modalEditar}
          dgs={dgs}
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
    </div>
  )
}
