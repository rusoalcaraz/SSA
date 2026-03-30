import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

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

export function Sidebar() {
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()

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
        <button
          onClick={handleLogout}
          className="mt-3 w-full text-left text-xs text-blue-300 hover:text-white transition-colors"
        >
          Cerrar sesion
        </button>
      </div>
    </aside>
  )
}
