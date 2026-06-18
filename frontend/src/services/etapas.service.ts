import { api } from './api'
import type { ApiResponse, EtapaProcedimiento } from '../types'

const base = (id: string, etapaId: string) => `/procedimientos/${id}/etapas/${etapaId}`

async function completar(procedimientoId: string, etapaId: string, archivo?: File): Promise<EtapaProcedimiento> {
  const form = new FormData()
  if (archivo) form.append('archivo', archivo)
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/completar`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data.data
}

async function obtenerEvidencia(procedimientoId: string, etapaId: string, archivoId: string): Promise<string> {
  const response = await api.get(
    `${base(procedimientoId, etapaId)}/evidencia/${archivoId}`,
    { responseType: 'blob' }
  )
  return URL.createObjectURL(response.data as Blob)
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

async function marcarNoAplica(
  procedimientoId: string,
  etapaId: string,
  noAplica: boolean
): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/no-aplica`,
    { noAplica }
  )
  return data.data
}

async function validarCompletado(
  procedimientoId: string,
  etapaId: string,
  respuesta: 'si' | 'no'
): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/validar-completado`,
    { respuesta }
  )
  return data.data
}

export const etapasService = {
  completar,
  obtenerEvidencia,
  validarCompletado,
  proponerFecha,
  responderFecha,
  sobreescribirFecha,
  agregarObservacion,
  marcarNoAplica,
}
