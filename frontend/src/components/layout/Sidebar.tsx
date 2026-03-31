import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../ui/Modal'
import { authService } from '../../services/auth.service'
import { mensajeDeError } from '../../services/api'

interface NavItem {
  to: string
  label: string
}

function NavItems() {
  const { tieneRol } = useAuth()

  const items: NavItem[] = []

  if (tieneRol('superadmin', 'gerencial')) {
    items.push({ to: '/dashboard', label: 'Dashboard' })
  }
  if (tieneRol('area_contratante', 'asesor_tecnico', 'dgt')) {
    items.push({ to: '/mis-procedimientos', label: 'Mis procedimientos' })
  }
  if (!tieneRol('inspeccion')) {
    items.push({ to: '/procedimientos', label: 'Procedimientos' })
  }
  if (tieneRol('superadmin', 'gerencial', 'area_contratante')) {
    items.push({ to: '/reportes', label: 'Reportes' })
  }
  if (tieneRol('superadmin')) {
    items.push(
      { to: '/admin/usuarios', label: 'Usuarios' },
      { to: '/admin/catalogos', label: 'Catalogos' },
      { to: '/admin/direcciones-generales', label: 'Direcciones Generales' }
    )
  }

  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-900 text-white'
                : 'text-blue-100 hover:bg-blue-800 hover:text-white'
            }`
          }
        >
          {item.label}
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

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="w-60 bg-blue-950 flex flex-col min-h-screen shrink-0">
      {/* Logo / titulo */}
      <div className="px-5 py-5 border-b border-blue-800">
        <span className="text-white font-bold text-base leading-tight block">
          SSA
        </span>
        <span className="text-blue-300 text-xs">
          Seguimiento de Adquisiciones
        </span>
      </div>

      <NavItems />

      {/* Pie: info del usuario */}
      <div className="px-4 py-4 border-t border-blue-800">
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
      </div>

      {modalPassword && (
        <ModalCambiarPassword onClose={() => setModalPassword(false)} />
      )}
    </aside>
  )
}
