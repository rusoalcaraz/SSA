import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { Rol } from '../../types'

interface Props {
  roles?: Rol[]
}

export function ProtectedRoute({ roles }: Props) {
  const { estaAutenticado, tieneRol } = useAuth()
  const location = useLocation()

  if (!estaAutenticado) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (roles && !tieneRol(...roles)) {
    return <Navigate to="/sin-acceso" replace />
  }

  return <Outlet />
}
