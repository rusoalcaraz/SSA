import type { EstadoEtapa } from '../../types'

const CLASES: Record<EstadoEtapa, string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  activo: 'bg-blue-100 text-blue-800',
  completado: 'bg-green-100 text-green-800',
  vencido: 'bg-red-100 text-red-700',
  fecha_propuesta: 'bg-yellow-100 text-yellow-800',
  fecha_rechazada: 'bg-orange-100 text-orange-800',
}

const ETIQUETAS: Record<EstadoEtapa, string> = {
  pendiente: 'Pendiente',
  activo: 'Activo',
  completado: 'Completado',
  vencido: 'Vencido',
  fecha_propuesta: 'Fecha propuesta',
  fecha_rechazada: 'Fecha rechazada',
}

export function EstadoEtapaBadge({ estado }: { estado: EstadoEtapa }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLASES[estado]}`}>
      {ETIQUETAS[estado]}
    </span>
  )
}
