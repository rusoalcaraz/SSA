import { api } from './api'
import type { ApiResponse, EtapaActual, TipoProcedimiento } from '../types'

export interface ResumenDashboard {
  totalProcedimientos: number
  totalUrgentes: number
  porEtapaActual: Partial<Record<EtapaActual, number>>
  porTipoProcedimiento: Partial<Record<TipoProcedimiento, number>>
  porDireccionGeneral: {
    _id: string
    nombre: string
    siglas: string
    total: number
    urgentes: number
  }[]
  alertas: {
    etapasVencidas: number
    etapasProximasAVencer: number
  }
}

async function resumen(anioFiscal?: number): Promise<ResumenDashboard> {
  const { data } = await api.get<ApiResponse<ResumenDashboard>>('/dashboard/resumen', {
    params: anioFiscal ? { anioFiscal } : {},
  })
  return data.data
}

export const dashboardService = { resumen }
