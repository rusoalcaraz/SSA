import { api, setAccessToken, clearAccessToken } from './api'
import type { UsuarioResumen } from '../types'

interface LoginResponse {
  accessToken: string
  usuario: UsuarioResumen
}

async function login(correo: string, contrasena: string): Promise<LoginResponse> {
  const { data } = await api.post<{ success: boolean; data: LoginResponse }>(
    '/auth/login',
    { correo, contrasena }
  )
  setAccessToken(data.data.accessToken)
  return data.data
}

async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout')
  } finally {
    clearAccessToken()
  }
}

async function refrescarToken(): Promise<string> {
  const { data } = await api.post<{ success: boolean; data: { accessToken: string } }>(
    '/auth/refresh'
  )
  setAccessToken(data.data.accessToken)
  return data.data.accessToken
}

async function cambiarPassword(contrasenaActual: string, contrasenaNueva: string): Promise<void> {
  await api.put('/auth/cambiar-password', { contrasenaActual, contrasenaNueva })
}

async function actualizarMiSubdireccion(subdireccionId: string | null, seccionId?: string | null): Promise<LoginResponse> {
  const { data } = await api.put<{ success: boolean; data: LoginResponse }>(
    '/auth/yo/subdireccion',
    { subdireccionId, seccionId: seccionId ?? null }
  )
  setAccessToken(data.data.accessToken)
  return data.data
}

export const authService = { login, logout, refrescarToken, cambiarPassword, actualizarMiSubdireccion }
