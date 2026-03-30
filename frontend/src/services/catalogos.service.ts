import { api } from './api'
import type { ApiResponse, DireccionGeneral, BienServicio, CatalogoEtapa, TipoProcedimiento } from '../types'

async function listarDGs(): Promise<DireccionGeneral[]> {
  const { data } = await api.get<ApiResponse<DireccionGeneral[]>>(
    '/catalogos/direcciones-generales',
    { params: { activa: true } }
  )
  return data.data
}

async function listarBienesServicios(q?: string): Promise<BienServicio[]> {
  const { data } = await api.get<ApiResponse<BienServicio[]>>('/catalogos/bienes-servicios', {
    params: { activo: true, ...(q ? { q } : {}) },
  })
  return data.data
}

async function listarEtapas(tipo?: 'cronograma' | 'hoja_de_trabajo', aplicaA?: TipoProcedimiento): Promise<CatalogoEtapa[]> {
  const { data } = await api.get<ApiResponse<CatalogoEtapa[]>>('/catalogos/etapas', {
    params: { activa: true, ...(tipo ? { tipo } : {}), ...(aplicaA ? { aplicaA } : {}) },
  })
  return data.data
}

export const catalogosService = { listarDGs, listarBienesServicios, listarEtapas }
