import { api } from './api'
import type {
  ApiResponse,
  Procedimiento,
  EtapaActual,
  TipoProcedimiento,
  Paginacion,
} from '../types'

export interface FiltroProcedimientos {
  page?: number
  limit?: number
  anioFiscal?: number
  urgente?: boolean
  etapaActual?: EtapaActual
  tipoProcedimiento?: TipoProcedimiento
  dgId?: string
}

export interface ListaProcedimientosResponse {
  procedimientos: Procedimiento[]
  pagination: Paginacion
}

async function listar(
  filtros: FiltroProcedimientos = {}
): Promise<ListaProcedimientosResponse> {
  const params: Record<string, string | number | boolean> = {}
  if (filtros.page) params.page = filtros.page
  if (filtros.limit) params.limit = filtros.limit
  if (filtros.anioFiscal) params.anioFiscal = filtros.anioFiscal
  if (filtros.urgente !== undefined) params.urgente = filtros.urgente
  if (filtros.etapaActual) params.etapaActual = filtros.etapaActual
  if (filtros.tipoProcedimiento) params.tipoProcedimiento = filtros.tipoProcedimiento
  if (filtros.dgId) params.dgId = filtros.dgId

  const { data } = await api.get<ApiResponse<Procedimiento[]> & { pagination: Paginacion }>(
    '/procedimientos',
    { params }
  )
  return { procedimientos: data.data, pagination: data.pagination! }
}

async function obtener(id: string): Promise<Procedimiento> {
  const { data } = await api.get<ApiResponse<Procedimiento>>(`/procedimientos/${id}`)
  return data.data
}

export interface CrearProcedimientoPayload {
  titulo: string
  descripcion?: string
  anioFiscal: number
  bienServicio: string
  descripcionEspecifica?: string
  montoEstimado?: number
  moneda?: string
  direccionGeneral: string
  asesorTitular: string
  asesorSuplente?: string
  tipoProcedimiento: TipoProcedimiento
  supuestoExcepcion?: string
  tipoConsultoria?: string
  justificacionTipo?: string
  urgente?: boolean
  justificacionUrgencia?: string
}

async function crear(payload: CrearProcedimientoPayload): Promise<Procedimiento> {
  const { data } = await api.post<ApiResponse<Procedimiento>>('/procedimientos', payload)
  return data.data
}

async function actualizar(
  id: string,
  payload: Partial<CrearProcedimientoPayload>
): Promise<Procedimiento> {
  const { data } = await api.put<ApiResponse<Procedimiento>>(`/procedimientos/${id}`, payload)
  return data.data
}

async function marcarUrgente(
  id: string,
  urgente: boolean,
  justificacionUrgencia?: string
): Promise<Procedimiento> {
  const { data } = await api.patch<ApiResponse<Procedimiento>>(
    `/procedimientos/${id}/urgente`,
    { urgente, justificacionUrgencia }
  )
  return data.data
}

export const procedimientosService = { listar, obtener, crear, actualizar, marcarUrgente }
