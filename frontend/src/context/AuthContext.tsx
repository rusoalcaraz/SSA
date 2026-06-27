import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Rol, UsuarioResumen, Subdireccion } from '../types'
import { authService } from '../services/auth.service'
import { setAccessToken as setApiToken, clearAccessToken } from '../services/api'

interface AuthState {
  usuario: UsuarioResumen | null
  accessToken: string | null
}

export interface SesionData {
  accessToken: string
  usuario: UsuarioResumen
}

interface AuthContextValue extends AuthState {
  login: (correo: string, contrasena: string) => Promise<void>
  logout: () => Promise<void>
  setAccessToken: (token: string) => void
  actualizarSesion: (data: SesionData) => void
  estaAutenticado: boolean
  tieneRol: (...roles: Rol[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'ssa_usuario'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    try {
      const guardado = sessionStorage.getItem(STORAGE_KEY)
      if (guardado) {
        const parsed: AuthState = JSON.parse(guardado)
        if (parsed.accessToken) setApiToken(parsed.accessToken)
        return parsed
      }
    } catch {
      // sessionStorage no disponible
    }
    return { usuario: null, accessToken: null }
  })

  useEffect(() => {
    if (state.usuario && state.accessToken) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [state])

  const login = useCallback(async (correo: string, contrasena: string) => {
    const { accessToken, usuario } = await authService.login(correo, contrasena)
    setApiToken(accessToken)
    setState({ accessToken, usuario })
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      clearAccessToken()
      setState({ usuario: null, accessToken: null })
    }
  }, [])

  const setAccessToken = useCallback((token: string) => {
    setApiToken(token)
    setState((prev) => ({ ...prev, accessToken: token }))
  }, [])

  const actualizarSesion = useCallback(({ accessToken, usuario }: SesionData) => {
    setApiToken(accessToken)
    setState({ accessToken, usuario })
  }, [])

  const tieneRol = useCallback(
    (...roles: Rol[]) => {
      if (!state.usuario) return false
      if (roles.includes(state.usuario.rol)) return true
      // Permiso derivado de pertenecer a la Subdireccion de Adquisiciones
      if (roles.includes('adquisiciones')) {
        const sub = state.usuario.subdireccion
        if (typeof sub === 'object' && sub !== null && (sub as Subdireccion).esAdquisiciones === true) {
          return true
        }
      }
      return false
    },
    [state.usuario]
  )

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setAccessToken,
        actualizarSesion,
        estaAutenticado: !!state.accessToken,
        tieneRol,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
