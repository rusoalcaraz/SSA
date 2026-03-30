import { api } from './api'
import type { ApiResponse, UsuarioResumen, Rol, Paginacion } from '../types'

export interface FiltroUsuarios {
  page?: number
  limit?: number
  rol?: Rol
  activo?: boolean
  dgId?: string
  q?: string
}

export interface UsuarioCompleto extends UsuarioResumen {
  activo: boolean
  createdAt: string
  updatedAt: string
}

export interface ListaUsuariosResponse {
  usuarios: UsuarioCompleto[]
  pagination: Paginacion
}

export interface CrearUsuarioPayload {
  nombre: string
  apellidos: string
  correo: string
  contrasena: string
  rol: Rol
  direccionGeneral?: string
}

export interface ActualizarUsuarioPayload {
  nombre?: string
  apellidos?: string
  rol?: Rol
  direccionGeneral?: string
  activo?: boolean
}

async function listarAsesores(): Promise<UsuarioResumen[]> {
  const { data } = await api.get<ApiResponse<UsuarioResumen[]>>('/usuarios', {
    params: { rol: 'asesor_tecnico', activo: true, limit: 100 },
  })
  return data.data
}

async function listar(filtros: FiltroUsuarios = {}): Promise<ListaUsuariosResponse> {
  const params: Record<string, string | number | boolean> = {}
  if (filtros.page) params.page = filtros.page
  if (filtros.limit) params.limit = filtros.limit
  if (filtros.rol) params.rol = filtros.rol
  if (filtros.activo !== undefined) params.activo = filtros.activo
  if (filtros.dgId) params.dgId = filtros.dgId
  if (filtros.q) params.q = filtros.q

  const { data } = await api.get<ApiResponse<UsuarioCompleto[]> & { pagination: Paginacion }>(
    '/usuarios',
    { params }
  )
  return { usuarios: data.data, pagination: data.pagination! }
}

async function crear(payload: CrearUsuarioPayload): Promise<UsuarioCompleto> {
  const { data } = await api.post<ApiResponse<UsuarioCompleto>>('/usuarios', payload)
  return data.data
}

async function actualizar(id: string, payload: ActualizarUsuarioPayload): Promise<UsuarioCompleto> {
  const { data } = await api.put<ApiResponse<UsuarioCompleto>>(`/usuarios/${id}`, payload)
  return data.data
}

async function desactivar(id: string): Promise<void> {
  await api.delete(`/usuarios/${id}`)
}

async function resetPassword(id: string, contrasenaNueva: string): Promise<void> {
  await api.put(`/usuarios/${id}/reset-password`, { contrasenaNueva })
}

export const usuariosService = {
  listarAsesores,
  listar,
  crear,
  actualizar,
  desactivar,
  resetPassword,
}
