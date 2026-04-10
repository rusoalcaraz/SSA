import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../ui/Modal'
import { authService } from '../../services/auth.service'
import { mensajeDeError } from '../../services/api'

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
    case 'catalogos':
      return (
        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h16M4 17h16" />
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

  if (tieneRol('superadmin', 'gerencial')) {
    items.push({ to: '/dashboard', label: 'Dashboard', icon: 'dashboard' })
  }
  if (tieneRol('area_contratante', 'asesor_tecnico', 'dgt')) {
    items.push({ to: '/mis-procedimientos', label: 'Mis procedimientos', icon: 'mis' })
  }
  if (!tieneRol('inspeccion')) {
    items.push({ to: '/procedimientos', label: 'Procedimientos', icon: 'procedimientos' })
  }
  if (tieneRol('superadmin', 'gerencial', 'area_contratante')) {
    items.push({ to: '/reportes', label: 'Reportes', icon: 'reportes' })
  }
  if (tieneRol('superadmin')) {
    items.push(
      { to: '/admin/usuarios', label: 'Usuarios', icon: 'usuarios' },
      { to: '/admin/direcciones-generales', label: 'Organismos', icon: 'dgs' }
    )
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
// Modal cambiar contrasena propia
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
// Sidebar principal
// -------------------------------------------------------
export function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const [modalPassword, setModalPassword] = useState(false)
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

      <div className="px-3 py-3 border-t border-blue-800">
        {!colapsado ? (
          <>
            <p className="text-blue-200 text-xs font-medium truncate">
              {usuario?.nombre} {usuario?.apellidos}
            </p>
            <p className="text-blue-400 text-xs truncate">{usuario?.correo}</p>
            <p className="text-blue-400 text-xs mt-0.5 capitalize">{usuario?.rol?.replace(/_/g, ' ')}</p>
            <div className="mt-3 flex flex-col gap-1">
              <button
                onClick={() => setModalPassword(true)}
                className="text-left text-xs text-blue-300 hover:text-white transition-colors"
              >
                Cambiar contrasena
              </button>
              <button
                onClick={handleLogout}
                className="text-left text-xs text-blue-300 hover:text-white transition-colors"
              >
                Cerrar sesion
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setModalPassword(true)}
              className="text-blue-300 hover:text-white transition-colors"
              title="Cambiar contrasena"
            >
              <Icono nombre="usuarios" className="h-5 w-5" />
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

      {modalPassword && (
        <ModalCambiarPassword onClose={() => setModalPassword(false)} />
      )}
    </aside>
  )
}
