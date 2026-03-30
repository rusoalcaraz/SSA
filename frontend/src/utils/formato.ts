import type { EtapaActual, TipoProcedimiento } from '../types'

export const ETIQUETA_ETAPA: Record<EtapaActual, string> = {
  cronograma: 'Cronograma',
  hoja_de_trabajo: 'Hoja de Trabajo',
  entregas: 'Entregas',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
}

export const ETIQUETA_TIPO: Record<TipoProcedimiento, string> = {
  licitacion_publica_nacional: 'LP Nacional',
  licitacion_publica_internacional_libre: 'LP Intl. Libre',
  licitacion_publica_internacional_tratados: 'LP Intl. Tratados',
  invitacion_tres_personas: 'Inv. 3 Personas',
  adjudicacion_directa: 'Adj. Directa',
}

export const ETIQUETA_TIPO_LARGO: Record<TipoProcedimiento, string> = {
  licitacion_publica_nacional: 'Licitacion Publica Nacional',
  licitacion_publica_internacional_libre: 'Licitacion Publica Internacional Libre',
  licitacion_publica_internacional_tratados: 'Licitacion Publica Internacional (Tratados)',
  invitacion_tres_personas: 'Invitacion a Tres Personas',
  adjudicacion_directa: 'Adjudicacion Directa',
}

export function formatearMonto(monto: number, moneda = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 2,
  }).format(monto)
}

export function formatearFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
