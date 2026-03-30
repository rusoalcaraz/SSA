import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { procedimientosService, type FiltroProcedimientos } from '../../services/procedimientos.service'
import type { Procedimiento, EtapaActual, TipoProcedimiento, Paginacion as PaginacionTipo } from '../../types'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Paginacion } from '../../components/ui/Paginacion'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO } from '../../utils/formato'

const ETAPAS: { value: EtapaActual; label: string }[] = [
  { value: 'cronograma', label: 'Cronograma' },
  { value: 'hoja_de_trabajo', label: 'Hoja de Trabajo' },
  { value: 'entregas', label: 'Entregas' },
  { value: 'concluido', label: 'Concluido' },
  { value: 'cancelado', label: 'Cancelado' },
]

const TIPOS: { value: TipoProcedimiento; label: string }[] = [
  { value: 'licitacion_publica_nacional', label: 'LP Nacional' },
  { value: 'licitacion_publica_internacional_libre', label: 'LP Intl. Libre' },
  { value: 'licitacion_publica_internacional_tratados', label: 'LP Intl. Tratados' },
  { value: 'invitacion_tres_personas', label: 'Inv. 3 Personas' },
  { value: 'adjudicacion_directa', label: 'Adj. Directa' },
]

export function ListaProcedimientos() {
  const { tieneRol } = useAuth()
  const navigate = useNavigate()

  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([])
  const [paginacion, setPaginacion] = useState<PaginacionTipo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [filtros, setFiltros] = useState<FiltroProcedimientos>({ page: 1, limit: 20 })

  const cargar = useCallback(async (f: FiltroProcedimientos) => {
    setCargando(true)
    setError(null)
    try {
      const { procedimientos: datos, pagination } = await procedimientosService.listar(f)
      setProcedimientos(datos)
      setPaginacion(pagination)
    } catch {
      setError('No se pudieron cargar los procedimientos.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar(filtros)
  }, [filtros, cargar])

  function aplicarFiltro(cambios: Partial<FiltroProcedimientos>) {
    setFiltros((prev) => ({ ...prev, ...cambios, page: 1 }))
  }

  function limpiarFiltros() {
    setFiltros({ page: 1, limit: 20 })
  }

  const puedeCrear = tieneRol('superadmin', 'area_contratante')

  return (
    <div>
      {/* Cabecera */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Procedimientos</h1>
          {paginacion && (
            <p className="text-sm text-gray-500 mt-0.5">
              {paginacion.total} procedimiento{paginacion.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        {puedeCrear && (
          <Link
            to="/procedimientos/nuevo"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-900 text-white text-sm font-medium rounded-md hover:bg-blue-800 transition-colors"
          >
            + Nuevo procedimiento
          </Link>
        )}
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Anio fiscal</label>
          <input
            type="number"
            min={2020}
            max={2099}
            placeholder="Todos"
            value={filtros.anioFiscal ?? ''}
            onChange={(e) =>
              aplicarFiltro({ anioFiscal: e.target.value ? Number(e.target.value) : undefined })
            }
            className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Etapa</label>
          <select
            value={filtros.etapaActual ?? ''}
            onChange={(e) =>
              aplicarFiltro({
                etapaActual: e.target.value ? (e.target.value as EtapaActual) : undefined,
              })
            }
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas</option>
            {ETAPAS.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={filtros.tipoProcedimiento ?? ''}
            onChange={(e) =>
              aplicarFiltro({
                tipoProcedimiento: e.target.value
                  ? (e.target.value as TipoProcedimiento)
                  : undefined,
              })
            }
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            {TIPOS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Urgentes</label>
          <select
            value={filtros.urgente === undefined ? '' : filtros.urgente ? 'si' : 'no'}
            onChange={(e) =>
              aplicarFiltro({
                urgente:
                  e.target.value === '' ? undefined : e.target.value === 'si',
              })
            }
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todos</option>
            <option value="si">Solo urgentes</option>
            <option value="no">No urgentes</option>
          </select>
        </div>

        <button
          onClick={limpiarFiltros}
          className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
        >
          Limpiar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {cargando ? (
          <div className="flex justify-center py-16">
            <Spinner className="text-blue-900" />
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>
        ) : procedimientos.length === 0 ? (
          <EmptyState
            titulo="Sin resultados"
            mensaje="No hay procedimientos que coincidan con los filtros aplicados."
            accion={
              puedeCrear ? (
                <Link
                  to="/procedimientos/nuevo"
                  className="text-sm text-blue-700 hover:underline"
                >
                  Crear el primer procedimiento
                </Link>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  No. / Titulo
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tipo
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  DG
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Asesor Titular
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Etapa
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Anio
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {procedimientos.map((proc) => (
                <tr
                  key={proc._id}
                  onClick={() => navigate(`/procedimientos/${proc._id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {proc.urgente && (
                        <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0" title="Urgente" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900 leading-snug">
                          {proc.numeroProcedimiento ?? 'S/N'}
                        </p>
                        <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">{proc.titulo}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {ETIQUETA_TIPO[proc.tipoProcedimiento]}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {proc.direccionGeneral?.siglas ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {proc.asesorTitular
                      ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge etapa={proc.etapaActual}>
                      {ETIQUETA_ETAPA[proc.etapaActual]}
                    </Badge>
                    {proc.etapasConAlerta && proc.etapasConAlerta.length > 0 && (
                      <span
                        className="ml-1.5 inline-block h-2 w-2 rounded-full bg-yellow-400"
                        title={`${proc.etapasConAlerta.length} etapa(s) con alerta`}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{proc.anioFiscal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {paginacion && (
          <div className="px-4">
            <Paginacion
              paginacion={paginacion}
              onChange={(page) => setFiltros((prev) => ({ ...prev, page }))}
            />
          </div>
        )}
      </div>
    </div>
  )
}
