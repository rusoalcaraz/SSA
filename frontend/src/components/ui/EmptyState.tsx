interface Props {
  titulo?: string
  mensaje: string
  accion?: React.ReactNode
}

export function EmptyState({ titulo, mensaje, accion }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      {titulo && <p className="text-base font-medium text-gray-700">{titulo}</p>}
      <p className="text-sm text-gray-400 max-w-xs">{mensaje}</p>
      {accion}
    </div>
  )
}
