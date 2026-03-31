import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Rol, UsuarioResumen } from '../types'
import { authService } from '../services/auth.service'
import { setAccessToken as setApiToken, clearAccessToken } from '../services/api'

interface AuthState {
  usuario: UsuarioResumen | null
  accessToken: string | null
}

interface AuthContextValue extends AuthState {
  login: (correo: string, contrasena: string) => Promise<void>
  logout: () => Promise<void>
  setAccessToken: (token: string) => void
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
        // Sincronizar el token en memoria del cliente axios al restaurar sesion
        if (parsed.accessToken) setApiToken(parsed.accessToken)
        return parsed
      }
    } catch {
      // sessionStorage no disponible
    }
    return { usuario: null, accessToken: null }
  })

  // Persistir en sessionStorage cada vez que cambia el estado
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

  const tieneRol = useCallback(
    (...roles: Rol[]) => {
      if (!state.usuario) return false
      return roles.includes(state.usuario.rol)
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
        estaAutenticado: !!state.accessToken,
        tieneRol,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
