interface Props {
  className?: string
}

export function Spinner({ className = '' }: Props) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-solid border-current border-r-transparent ${className}`}
      role="status"
      aria-label="Cargando"
    />
  )
}
