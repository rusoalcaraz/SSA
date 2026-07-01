import { api } from './api'
import type { EtapaActual, TipoProcedimiento } from '../types'

export interface FiltroReporte {
  anioFiscal?: number
  dgId?: string
  tipoProcedimiento?: TipoProcedimiento
  etapaActual?: EtapaActual
  urgente?: boolean
  procedimientoId?: string
}

function construirParams(filtros: FiltroReporte): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}
  if (filtros.procedimientoId) params.procedimientoId = filtros.procedimientoId
  if (filtros.anioFiscal) params.anioFiscal = filtros.anioFiscal
  if (filtros.dgId) params.dgId = filtros.dgId
  if (filtros.tipoProcedimiento) params.tipoProcedimiento = filtros.tipoProcedimiento
  if (filtros.etapaActual) params.etapaActual = filtros.etapaActual
  if (filtros.urgente !== undefined) params.urgente = filtros.urgente
  return params
}

async function descargarPDF(filtros: FiltroReporte, nombreArchivo?: string): Promise<void> {
  const { data } = await api.get<Blob>('/reportes/pdf', {
    params: construirParams(filtros),
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo ?? `SSA-reporte-${Date.now()}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}

async function descargarExcel(filtros: FiltroReporte, nombreArchivo?: string): Promise<void> {
  const { data } = await api.get<Blob>('/reportes/excel', {
    params: construirParams(filtros),
    responseType: 'blob',
  })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo ?? `SSA-reporte-${Date.now()}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

export const reportesService = { descargarPDF, descargarExcel }
