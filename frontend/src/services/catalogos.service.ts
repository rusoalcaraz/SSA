import { api } from './api'
import type {
  ApiResponse,
  DireccionGeneral,
  BienServicio,
  CatalogoEtapa,
  TipoProcedimiento,
} from '../types'

// -------------------------------------------------------
// Direcciones Generales
// -------------------------------------------------------
async function listarDGs(soloActivas = true): Promise<DireccionGeneral[]> {
  const { data } = await api.get<ApiResponse<DireccionGeneral[]>>(
    '/catalogos/direcciones-generales',
    { params: soloActivas ? { activa: true } : {} }
  )
  return data.data
}

async function crearDG(payload: { nombre: string; siglas: string; descripcion?: string; tipo?: string }): Promise<DireccionGeneral> {
  const { data } = await api.post<ApiResponse<DireccionGeneral>>(
    '/catalogos/direcciones-generales',
    payload
  )
  return data.data
}

async function actualizarDG(
  id: string,
  payload: { nombre?: string; siglas?: string; descripcion?: string; tipo?: string; activa?: boolean }
): Promise<DireccionGeneral> {
  const { data } = await api.put<ApiResponse<DireccionGeneral>>(
    `/catalogos/direcciones-generales/${id}`,
    payload
  )
  return data.data
}

async function desactivarDG(id: string): Promise<void> {
  await api.delete(`/catalogos/direcciones-generales/${id}`)
}

async function eliminarDGDefinitivo(id: string): Promise<void> {
  await api.delete(`/catalogos/direcciones-generales/${id}`, { params: { hard: true } })
}

// -------------------------------------------------------
// Bienes y Servicios
// -------------------------------------------------------
async function listarBienesServicios(q?: string): Promise<BienServicio[]> {
  const { data } = await api.get<ApiResponse<BienServicio[]>>('/catalogos/bienes-servicios', {
    params: { activo: true, ...(q ? { q } : {}) },
  })
  return data.data
}

async function listarTodosBienesServicios(): Promise<BienServicio[]> {
  const { data } = await api.get<ApiResponse<BienServicio[]>>('/catalogos/bienes-servicios', {
    params: { limit: 500 },
  })
  return data.data
}

async function crearBienServicio(payload: {
  clave: string
  descripcion: string
  tipo: BienServicio['tipo']
  unidadMedida?: string
}): Promise<BienServicio> {
  const { data } = await api.post<ApiResponse<BienServicio>>(
    '/catalogos/bienes-servicios',
    payload
  )
  return data.data
}

async function actualizarBienServicio(
  id: string,
  payload: {
    clave?: string
    descripcion?: string
    tipo?: BienServicio['tipo']
    unidadMedida?: string
    activo?: boolean
  }
): Promise<BienServicio> {
  const { data } = await api.put<ApiResponse<BienServicio>>(
    `/catalogos/bienes-servicios/${id}`,
    payload
  )
  return data.data
}

async function desactivarBienServicio(id: string): Promise<void> {
  await api.delete(`/catalogos/bienes-servicios/${id}`)
}

// -------------------------------------------------------
// Etapas
// -------------------------------------------------------
async function listarEtapas(
  tipo?: 'cronograma' | 'hoja_de_trabajo',
  aplicaA?: TipoProcedimiento
): Promise<CatalogoEtapa[]> {
  const { data } = await api.get<ApiResponse<CatalogoEtapa[]>>('/catalogos/etapas', {
    params: { activa: true, ...(tipo ? { tipo } : {}), ...(aplicaA ? { aplicaA } : {}) },
  })
  return data.data
}

async function listarTodasEtapas(): Promise<CatalogoEtapa[]> {
  const { data } = await api.get<ApiResponse<CatalogoEtapa[]>>('/catalogos/etapas', {
    params: { limit: 200 },
  })
  return data.data
}

async function crearEtapa(payload: {
  nombre: string
  descripcion?: string
  tipo: 'cronograma' | 'hoja_de_trabajo'
  obligatoria: boolean
  aplicaA: TipoProcedimiento[]
  orden: number
  diasAlertaUrgente?: number
}): Promise<CatalogoEtapa> {
  const { data } = await api.post<ApiResponse<CatalogoEtapa>>('/catalogos/etapas', payload)
  return data.data
}

async function actualizarEtapa(
  id: string,
  payload: Partial<{
    nombre: string
    descripcion: string
    tipo: 'cronograma' | 'hoja_de_trabajo'
    obligatoria: boolean
    aplicaA: TipoProcedimiento[]
    orden: number
    diasAlertaUrgente: number
    activa: boolean
  }>
): Promise<CatalogoEtapa> {
  const { data } = await api.put<ApiResponse<CatalogoEtapa>>(
    `/catalogos/etapas/${id}`,
    payload
  )
  return data.data
}

async function desactivarEtapa(id: string): Promise<void> {
  await api.delete(`/catalogos/etapas/${id}`)
}

export const catalogosService = {
  listarDGs,
  crearDG,
  actualizarDG,
  desactivarDG,
  eliminarDGDefinitivo,
  listarBienesServicios,
  listarTodosBienesServicios,
  crearBienServicio,
  actualizarBienServicio,
  desactivarBienServicio,
  listarEtapas,
  listarTodasEtapas,
  crearEtapa,
  actualizarEtapa,
  desactivarEtapa,
}
