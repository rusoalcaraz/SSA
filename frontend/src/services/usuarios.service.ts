import { api } from './api'
import type { ApiResponse, UsuarioResumen } from '../types'

async function listarAsesores(): Promise<UsuarioResumen[]> {
  const { data } = await api.get<ApiResponse<UsuarioResumen[]>>('/usuarios', {
    params: { rol: 'asesor_tecnico', activo: true, limit: 100 },
  })
  return data.data
}

export const usuariosService = { listarAsesores }
