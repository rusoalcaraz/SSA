import type { Paginacion as PaginacionTipo } from '../../types'

interface Props {
  paginacion: PaginacionTipo
  onChange: (page: number) => void
}

export function Paginacion({ paginacion, onChange }: Props) {
  const { page, totalPaginas, total, limit } = paginacion
  const inicio = (page - 1) * limit + 1
  const fin = Math.min(page * limit, total)

  if (totalPaginas <= 1) return null

  return (
    <div className="flex items-center justify-between px-1 py-3 border-t border-gray-200 mt-2">
      <p className="text-xs text-gray-500">
        Mostrando {inicio}-{fin} de {total} resultados
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          Anterior
        </button>

        {Array.from({ length: totalPaginas }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - page) <= 1)
          .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis')
            acc.push(p)
            return acc
          }, [])
          .map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`e-${idx}`} className="px-2 py-1.5 text-xs text-gray-400">
                ...
              </span>
            ) : (
              <button
                key={item}
                onClick={() => onChange(item)}
                className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                  item === page
                    ? 'bg-blue-900 text-white border-blue-900'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {item}
              </button>
            )
          )}

        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPaginas}
          className="px-3 py-1.5 text-xs rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50 transition-colors"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
