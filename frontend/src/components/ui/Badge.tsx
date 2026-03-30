import type { EtapaActual } from '../../types'

type Variante = 'gris' | 'azul' | 'verde' | 'amarillo' | 'rojo' | 'naranja'

const CLASES: Record<Variante, string> = {
  gris: 'bg-gray-100 text-gray-700',
  azul: 'bg-blue-100 text-blue-800',
  verde: 'bg-green-100 text-green-800',
  amarillo: 'bg-yellow-100 text-yellow-800',
  rojo: 'bg-red-100 text-red-800',
  naranja: 'bg-orange-100 text-orange-800',
}

const VARIANTE_POR_ETAPA: Record<EtapaActual, Variante> = {
  cronograma: 'azul',
  hoja_de_trabajo: 'naranja',
  entregas: 'amarillo',
  concluido: 'verde',
  cancelado: 'rojo',
}

interface Props {
  children: React.ReactNode
  variante?: Variante
  etapa?: EtapaActual
  className?: string
}

export function Badge({ children, variante, etapa, className = '' }: Props) {
  const v = etapa ? VARIANTE_POR_ETAPA[etapa] : (variante ?? 'gris')
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${CLASES[v]} ${className}`}
    >
      {children}
    </span>
  )
}
