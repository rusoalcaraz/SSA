import { useOutletContext } from 'react-router-dom'
import { ListaEtapas } from '../../components/layout/ListaEtapas'
import type { Procedimiento } from '../../types'

interface ContextoDetalle {
  procedimiento: Procedimiento
  recargar: () => void
}

export function HojaTrabajo() {
  const { procedimiento, recargar } = useOutletContext<ContextoDetalle>()

  return (
    <ListaEtapas
      procedimiento={procedimiento}
      etapas={procedimiento.hojaDeTrabajoEtapas}
      onActualizar={recargar}
    />
  )
}
