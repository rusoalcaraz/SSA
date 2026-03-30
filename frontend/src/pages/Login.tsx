import { useState, type FormEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { mensajeDeError } from '../services/api'

export function Login() {
  const { login, tieneRol } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [correo, setCorreo] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function destino() {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname
    if (from && from !== '/login') return from
    if (tieneRol('gerencial', 'superadmin')) return '/dashboard'
    return '/procedimientos'
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    try {
      await login(correo.trim(), contrasena)
      navigate(destino(), { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Encabezado */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-blue-950">SSA</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Seguimiento de Adquisiciones</p>
        </div>

        {/* Tarjeta */}
        <div className="bg-white rounded-lg shadow-md px-8 py-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Iniciar sesion</h2>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label htmlFor="correo" className="block text-sm font-medium text-gray-700 mb-1">
                Correo institucional
              </label>
              <input
                id="correo"
                type="email"
                autoComplete="email"
                required
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                disabled={cargando}
                placeholder="usuario@institucion.gob.mx"
              />
            </div>

            <div>
              <label htmlFor="contrasena" className="block text-sm font-medium text-gray-700 mb-1">
                Contrasena
              </label>
              <input
                id="contrasena"
                type="password"
                autoComplete="current-password"
                required
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                disabled={cargando}
              />
            </div>

            <button
              type="submit"
              disabled={cargando || !correo || !contrasena}
              className="w-full py-2.5 px-4 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {cargando ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acceso exclusivo para personal autorizado
        </p>
      </div>
    </div>
  )
}
