import { api } from './api'
import type { ApiResponse, EtapaProcedimiento } from '../types'

const base = (id: string, etapaId: string) => `/procedimientos/${id}/etapas/${etapaId}`

async function completar(procedimientoId: string, etapaId: string): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/completar`
  )
  return data.data
}

async function proponerFecha(
  procedimientoId: string,
  etapaId: string,
  fechaPropuesta: string,
  motivo?: string
): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/proponer-fecha`,
    { fechaPropuesta, motivo }
  )
  return data.data
}

async function responderFecha(
  procedimientoId: string,
  etapaId: string,
  respuesta: 'aceptar' | 'rechazar',
  motivoRechazo?: string
): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/responder-fecha`,
    { respuesta, motivoRechazo }
  )
  return data.data
}

async function sobreescribirFecha(
  procedimientoId: string,
  etapaId: string,
  fechaNueva: string,
  motivo?: string
): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/sobreescribir-fecha`,
    { fechaNueva, motivo }
  )
  return data.data
}

async function agregarObservacion(
  procedimientoId: string,
  etapaId: string,
  texto: string
): Promise<void> {
  await api.post(`${base(procedimientoId, etapaId)}/observacion`, { texto })
}

export const etapasService = {
  completar,
  proponerFecha,
  responderFecha,
  sobreescribirFecha,
  agregarObservacion,
}
