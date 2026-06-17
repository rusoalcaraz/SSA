import { api } from './api'
import type { ApiResponse, Entrega } from '../types'

const base = (id: string) => `/procedimientos/${id}/entregas`

export interface CrearEntregaPayload {
  descripcion: string
  tipo: 'parcial' | 'total'
  fechaEstimada?: string
  observaciones?: string
}

export interface ActualizarEntregaPayload {
  descripcion?: string
  tipo?: 'parcial' | 'total'
  fechaEstimada?: string
  fechaReal?: string
  estado?: 'pendiente' | 'recibida' | 'rechazada' | 'recibida_propuesta'
  observaciones?: string
}

async function listar(procedimientoId: string): Promise<Entrega[]> {
  const { data } = await api.get<ApiResponse<Entrega[]>>(base(procedimientoId))
  return data.data
}

async function crear(
  procedimientoId: string,
  payload: CrearEntregaPayload
): Promise<Entrega> {
  const { data } = await api.post<ApiResponse<Entrega>>(base(procedimientoId), payload)
  return data.data
}

async function actualizar(
  procedimientoId: string,
  entregaId: string,
  payload: ActualizarEntregaPayload
): Promise<Entrega> {
  const { data } = await api.put<ApiResponse<Entrega>>(
    `${base(procedimientoId)}/${entregaId}`,
    payload
  )
  return data.data
}

async function subirDocumento(
  procedimientoId: string,
  entregaId: string,
  tipo: 'constancia_recepcion' | 'hoja_aceptacion' | 'otro',
  archivo: File
): Promise<Entrega> {
  const form = new FormData()
  form.append('archivo', archivo)
  form.append('tipo', tipo)
  const { data } = await api.post<ApiResponse<Entrega>>(
    `${base(procedimientoId)}/${entregaId}/documento`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data.data
}

async function proponerRecibida(
  procedimientoId: string,
  entregaId: string
): Promise<Entrega> {
  const { data } = await api.patch<ApiResponse<Entrega>>(
    `${base(procedimientoId)}/${entregaId}/proponer-recibida`
  )
  return data.data
}

async function validarEntrega(
  procedimientoId: string,
  entregaId: string,
  respuesta: 'si' | 'no'
): Promise<Entrega> {
  const { data } = await api.patch<ApiResponse<Entrega>>(
    `${base(procedimientoId)}/${entregaId}/validar`,
    { respuesta }
  )
  return data.data
}

export const entregasService = { listar, crear, actualizar, subirDocumento, proponerRecibida, validarEntrega }
