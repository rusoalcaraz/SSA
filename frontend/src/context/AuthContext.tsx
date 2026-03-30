import { createContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { Rol, UsuarioResumen } from '../types'
import { authService } from '../services/auth.service'

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
      if (guardado) return JSON.parse(guardado)
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
    setState({ accessToken, usuario })
  }, [])

  const logout = useCallback(async () => {
    try {
      await authService.logout()
    } finally {
      setState({ usuario: null, accessToken: null })
    }
  }, [])

  const setAccessToken = useCallback((token: string) => {
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
