import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../ui/Modal'
import { authService } from '../../services/auth.service'
import { catalogosService } from '../../services/catalogos.service'
import { mensajeDeError } from '../../services/api'
import type { Subdireccion, Seccion } from '../../types'

interface NavItem {
  to: string
  label: string
  icon: string
}

function Icono({ nombre, className }: { nombre: string; className?: string }) {
  const props = { width: 18, height: 18, className: className ?? 'shrink-0' }
  switch (nombre) {
    case 'dashboard':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z" />
        </svg>
      )
    case 'procedimientos':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v4H4zM4 10h16v10H4z" />
          <path d="M8 14h8M8 18h5" />
        </svg>
      )
    case 'timeline':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6h5M15 6h5M12 6h.01M7 12h10M4 18h5M15 18h5M12 18h.01" />
          <circle cx="12" cy="6" r="2" />
          <circle cx="7" cy="12" r="2" />
          <circle cx="17" cy="12" r="2" />
          <circle cx="12" cy="18" r="2" />
        </svg>
      )
    case 'mis':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="8" r="3" />
          <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
        </svg>
      )
    case 'reportes':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h16v16H4z" />
          <path d="M7 13l3 3 7-7" />
        </svg>
      )
    case 'usuarios':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="8" cy="8" r="3" />
          <circle cx="16" cy="8" r="3" />
          <path d="M2 20c0-3.5 3-6 6-6" />
          <path d="M22 20c0-3.5-3-6-6-6" />
        </svg>
      )
    case 'dgs':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 21V8l9-5 9 5v13H3z" />
          <path d="M9 22V12h6v10" />
        </svg>
      )
    case 'toggle':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 6l-4 6 4 6" />
          <path d="M16 6l4 6-4 6" />
        </svg>
      )
    default:
      return null
  }
}

function NavItems({ colapsado }: { colapsado: boolean }) {
  const { tieneRol } = useAuth()

  const items: NavItem[] = []

  if (tieneRol('administrador', 'adquisiciones', 'subdirector', 'jefe_seccion')) {
    items.push({ to: '/dashboard', label: 'Dashboard', icon: 'dashboard' })
  }
  if (tieneRol('asesor_tecnico')) {
    items.push({ to: '/mis-procedimientos', label: 'Mis procedimientos', icon: 'mis' })
  }
  if (
    tieneRol(
      'administrador',
      'adquisiciones',
      'subdirector',
      'jefe_seccion'
    )
  ) {
    items.push({ to: '/procedimientos', label: 'Procedimientos', icon: 'procedimientos' })
  }
  if (tieneRol('administrador', 'adquisiciones', 'subdirector', 'jefe_seccion')) {
    items.push({ to: '/reportes', label: 'Reportes', icon: 'reportes' })
  }
  if (tieneRol('administrador', 'adquisiciones', 'subdirector', 'jefe_seccion')) {
    items.push({ to: '/admin/usuarios', label: 'Usuarios', icon: 'usuarios' })
  }
  if (tieneRol('administrador', 'subdirector')) {
    items.push({ to: '/admin/areas', label: 'Áreas', icon: 'dgs' })
  }

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          title={colapsado ? item.label : undefined}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-900 text-white'
                : 'text-blue-100 hover:bg-blue-800 hover:text-white'
            }`
          }
        >
          <Icono nombre={item.icon} />
          {!colapsado && <span>{item.label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

// -------------------------------------------------------
// Modal cambiar contrasena
// -------------------------------------------------------
function ModalCambiarPassword({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    contrasenaActual: '',
    contrasenaNueva: '',
    confirmar: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.contrasenaNueva !== form.confirmar) {
      setErrorMsg('Las contrasenas nuevas no coinciden.')
      return
    }
    if (form.contrasenaNueva.length < 8) {
      setErrorMsg('La contrasena nueva debe tener al menos 8 caracteres.')
      return
    }
    setGuardando(true)
    setErrorMsg(null)
    try {
      await authService.cambiarPassword(form.contrasenaActual, form.contrasenaNueva)
      setOk(true)
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  if (ok) {
    return (
      <Modal titulo="Cambiar contrasena" onClose={onClose}>
        <div className="py-4 text-center space-y-3">
          <p className="text-sm text-green-700 font-medium">Contrasena actualizada correctamente.</p>
          <p className="text-xs text-gray-500">
            Tu sesion en otros dispositivos ha sido cerrada por seguridad.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titulo="Cambiar contrasena" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contrasena actual <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.contrasenaActual}
            onChange={(e) => setForm((f) => ({ ...f, contrasenaActual: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Contrasena nueva <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.contrasenaNueva}
            onChange={(e) => setForm((f) => ({ ...f, contrasenaNueva: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirmar contrasena nueva <span className="text-red-500">*</span>
          </label>
          <input
            type="password"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.confirmar}
            onChange={(e) => setForm((f) => ({ ...f, confirmar: e.target.value }))}
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
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Cambiar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------
// Modal Mi Perfil
// -------------------------------------------------------
const ETIQUETA_ROL: Record<string, string> = {
  administrador: 'Administrador',
  adquisiciones: 'Adquisiciones',
  subdirector: 'Subdirector',
  jefe_seccion: 'Jefe de Sección',
  asesor_tecnico: 'Asesor Técnico',
}

function ModalMiPerfil({
  onClose,
  onCambiarPassword,
}: {
  onClose: () => void
  onCambiarPassword: () => void
}) {
  const { usuario, tieneRol, actualizarSesion } = useAuth()
  const esAdmin = tieneRol('administrador')

  const [subdirecciones, setSubdirecciones] = useState<Subdireccion[]>([])
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [subdireccionSeleccionada, setSubdireccionSeleccionada] = useState<string>('')
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string>('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [exito, setExito] = useState(false)

  useEffect(() => {
    if (!esAdmin) return
    catalogosService.listarSubdirecciones(true).then(setSubdirecciones).catch(() => {})
    const sub = usuario?.subdireccion
    const subId = typeof sub === 'object' && sub !== null ? (sub as Subdireccion)._id : (sub as string) ?? ''
    setSubdireccionSeleccionada(subId)
    const sec = usuario?.seccion
    setSeccionSeleccionada(typeof sec === 'object' && sec !== null ? (sec as Seccion)._id : (sec as string) ?? '')
  }, [esAdmin, usuario])

  useEffect(() => {
    if (!esAdmin || !subdireccionSeleccionada) {
      setSecciones([])
      return
    }
    catalogosService.listarSecciones({ soloActivas: true, subdireccionId: subdireccionSeleccionada }).then(setSecciones).catch(() => {})
  }, [esAdmin, subdireccionSeleccionada])

  async function handleGuardar() {
    setGuardando(true)
    setErrorMsg(null)
    try {
      const resultado = await authService.actualizarMiSubdireccion(
        subdireccionSeleccionada || null,
        seccionSeleccionada || null,
      )
      actualizarSesion(resultado)
      setExito(true)
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  const nombreCompleto = `${usuario?.nombre ?? ''} ${usuario?.apellidos ?? ''}`.trim()
  const iniciales = [usuario?.nombre?.[0], usuario?.apellidos?.[0]].filter(Boolean).join('').toUpperCase()

  const subActual = usuario?.subdireccion
  const nombreSubActual = typeof subActual === 'object' && subActual !== null
    ? (subActual as Subdireccion).nombre
    : null

  const seccion = usuario?.seccion
  const nombreSeccion = typeof seccion === 'object' && seccion !== null
    ? (seccion as { nombre: string }).nombre
    : null

  return (
    <Modal titulo="Mi perfil" onClose={onClose}>
      {exito ? (
        <div className="py-3 text-center space-y-3">
          <p className="text-sm text-green-700 font-medium">Perfil actualizado correctamente.</p>
          <p className="text-xs text-gray-500">Tu vista del sistema ha sido actualizada.</p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Avatar + nombre */}
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-blue-900 flex items-center justify-center text-white font-bold text-lg shrink-0">
              {iniciales || '?'}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">{nombreCompleto}</p>
              <p className="text-sm text-gray-500 truncate">{usuario?.correo}</p>
            </div>
          </div>

          {/* Datos del perfil */}
          <div className="space-y-3 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-gray-500 shrink-0">Rol</span>
              <span className="font-medium text-gray-800 text-right">
                {ETIQUETA_ROL[usuario?.rol ?? ''] ?? usuario?.rol}
              </span>
            </div>

            {/* Subdirección y Sección — editables solo para admin */}
            {esAdmin ? (
              <>
                <div className="space-y-1">
                  <label className="text-gray-500">Subdirección</label>
                  <select
                    value={subdireccionSeleccionada}
                    onChange={(e) => { setSubdireccionSeleccionada(e.target.value); setSeccionSeleccionada('') }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
                  >
                    <option value="">— Ninguna —</option>
                    {subdirecciones.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.nombre}{s.esAdquisiciones ? ' ★' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400">
                    ★ indica la Subdirección de Adquisiciones.
                  </p>
                </div>
                {subdireccionSeleccionada && (
                  <div className="space-y-1">
                    <label className="text-gray-500">Sección</label>
                    <select
                      value={seccionSeleccionada}
                      onChange={(e) => setSeccionSeleccionada(e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
                    >
                      <option value="">— Ninguna —</option>
                      {secciones.map((s) => (
                        <option key={s._id} value={s._id}>{s.nombre}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between gap-2">
                  <span className="text-gray-500 shrink-0">Subdirección</span>
                  <span className="font-medium text-gray-800 text-right">{nombreSubActual ?? '—'}</span>
                </div>
                {nombreSeccion && (
                  <div className="flex justify-between gap-2">
                    <span className="text-gray-500 shrink-0">Sección</span>
                    <span className="font-medium text-gray-800 text-right">{nombreSeccion}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

          {/* Acciones */}
          <div className="pt-1 flex flex-col gap-2">
            {esAdmin && (
              <button
                type="button"
                onClick={handleGuardar}
                disabled={guardando}
                className="w-full py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            )}
            <button
              type="button"
              onClick={() => { onClose(); onCambiarPassword() }}
              className="w-full py-2 text-sm text-blue-700 hover:text-blue-900 transition-colors text-left"
            >
              Cambiar contraseña
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// -------------------------------------------------------
// Sidebar principal
// -------------------------------------------------------
export function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [modalPassword, setModalPassword] = useState(false)
  const [modalPerfil, setModalPerfil] = useState(false)
  const [colapsado, setColapsado] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem('ssa_sidebar_colapsado')
      return s ? JSON.parse(s) : false
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('ssa_sidebar_colapsado', JSON.stringify(colapsado))
    } catch {}
  }, [colapsado])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const iniciales = [usuario?.nombre?.[0], usuario?.apellidos?.[0]].filter(Boolean).join('').toUpperCase()

  return (
    <aside className={`${colapsado ? 'w-16' : 'w-60'} bg-blue-950 flex flex-col min-h-screen shrink-0 transition-all duration-200`}>
      <div className="px-3 py-3 border-b border-blue-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-bold text-base leading-tight block">SSA</span>
          {!colapsado && <span className="text-blue-300 text-xs">Seguimiento de Adquisiciones</span>}
        </div>
        <button
          onClick={() => setColapsado((v) => !v)}
          className="text-blue-200 hover:text-white p-1 rounded transition-colors"
          title={colapsado ? 'Expandir' : 'Colapsar'}
        >
          <Icono nombre="toggle" className="h-5 w-5" />
        </button>
      </div>

      <NavItems colapsado={colapsado} />

      {/* Sección inferior — perfil clickable */}
      <div className="px-3 py-3 border-t border-blue-800">
        {!colapsado ? (
          <>
            <button
              type="button"
              onClick={() => setModalPerfil(true)}
              className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-blue-900 transition-colors group"
            >
              <div className="h-7 w-7 rounded-full bg-blue-700 group-hover:bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0 transition-colors">
                {iniciales || '?'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-blue-100 text-xs font-medium truncate">
                  {usuario?.nombre} {usuario?.apellidos}
                </p>
                <p className="text-blue-400 text-xs truncate capitalize">{usuario?.rol?.replace(/_/g, ' ')}</p>
              </div>
              <svg className="h-3.5 w-3.5 text-blue-400 group-hover:text-blue-200 shrink-0 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
            <div className="mt-2">
              <button
                onClick={handleLogout}
                className="text-left text-xs text-blue-400 hover:text-white transition-colors"
              >
                Cerrar sesion
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setModalPerfil(true)}
              className="h-7 w-7 rounded-full bg-blue-700 hover:bg-blue-600 flex items-center justify-center text-white text-xs font-bold transition-colors"
              title="Mi perfil"
            >
              {iniciales || '?'}
            </button>
            <button
              onClick={handleLogout}
              className="text-blue-300 hover:text-white transition-colors"
              title="Cerrar sesion"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
                <path d="M3 21V3h6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {modalPerfil && (
        <ModalMiPerfil
          onClose={() => setModalPerfil(false)}
          onCambiarPassword={() => setModalPassword(true)}
        />
      )}
      {modalPassword && (
        <ModalCambiarPassword onClose={() => setModalPassword(false)} />
      )}
    </aside>
  )
}
