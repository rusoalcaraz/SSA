import { useOutletContext } from 'react-router-dom'
import { ListaEtapas } from '../../components/layout/ListaEtapas'
import type { Procedimiento } from '../../types'

interface ContextoDetalle {
  procedimiento: Procedimiento
  recargar: () => void
}

export function Cronograma() {
  const { procedimiento, recargar } = useOutletContext<ContextoDetalle>()

  return (
    <ListaEtapas
      procedimiento={procedimiento}
      etapas={procedimiento.cronograma}
      onActualizar={recargar}
    />
  )
}
