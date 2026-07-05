import { api } from './api'
import type { ApiResponse, EtapaProcedimiento, EvidenciaArchivo } from '../types'

const base = (id: string, etapaId: string) => `/procedimientos/${id}/etapas/${etapaId}`

async function completar(procedimientoId: string, etapaId: string): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/completar`,
    {}
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

async function descargarReporte(procedimientoId: string, etapaId: string, nombreArchivo?: string): Promise<void> {
  const { data } = await api.get<Blob>(
    `${base(procedimientoId, etapaId)}/reporte`,
    { responseType: 'blob' }
  )
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo ?? `SSA-etapa-${Date.now()}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

async function revertirCompletado(procedimientoId: string, etapaId: string): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/revertir-completado`,
    {}
  )
  return data.data
}

async function subirEvidencia(
  procedimientoId: string,
  etapaId: string,
  archivo: File,
  reemplazaEvidenciaId?: string
): Promise<EvidenciaArchivo> {
  const form = new FormData()
  form.append('archivo', archivo)
  if (reemplazaEvidenciaId) form.append('reemplazaEvidenciaId', reemplazaEvidenciaId)
  const { data } = await api.post<ApiResponse<EvidenciaArchivo>>(
    `${base(procedimientoId, etapaId)}/evidencia`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
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
  respuesta: 'si' | 'no',
  motivoRechazo?: string
): Promise<EtapaProcedimiento> {
  const { data } = await api.patch<ApiResponse<EtapaProcedimiento>>(
    `${base(procedimientoId, etapaId)}/validar-completado`,
    { respuesta, motivoRechazo }
  )
  return data.data
}

async function validarEvidencia(
  procedimientoId: string,
  etapaId: string,
  archivoId: string,
  respuesta: 'aceptar' | 'rechazar',
  comentario?: string
): Promise<EvidenciaArchivo> {
  const { data } = await api.patch<ApiResponse<EvidenciaArchivo>>(
    `${base(procedimientoId, etapaId)}/evidencia/${archivoId}/validar`,
    { respuesta, comentario }
  )
  return data.data
}

export const etapasService = {
  completar,
  revertirCompletado,
  obtenerEvidencia,
  descargarReporte,
  subirEvidencia,
  validarCompletado,
  validarEvidencia,
  proponerFecha,
  responderFecha,
  sobreescribirFecha,
  agregarObservacion,
  marcarNoAplica,
}
