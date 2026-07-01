import { Fragment, useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { procedimientosService, type FiltroProcedimientos } from '../../services/procedimientos.service'
import { reportesService } from '../../services/reportes.service'
import type {
  Procedimiento,
  EtapaActual,
  TipoProcedimiento,
  Paginacion as PaginacionTipo,
  Entrega,
} from '../../types'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Paginacion } from '../../components/ui/Paginacion'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO, formatearFecha } from '../../utils/formato'

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

const ETAPAS_MACRO: EtapaActual[] = [
  'cronograma',
  'hoja_de_trabajo',
  'entregas',
  'concluido',
  'cancelado',
]

const ETAPA_COLOR: Record<EtapaActual, string> = {
  cronograma: 'bg-blue-600',
  hoja_de_trabajo: 'bg-violet-600',
  entregas: 'bg-amber-500',
  concluido: 'bg-emerald-600',
  cancelado: 'bg-rose-600',
}

type Hito = {
  id: string
  nombre: string
  fecha?: string
  estado: string
  fuente: string
}

function normalizarHitos(proc: Procedimiento): Hito[] {
  const cronograma = (proc.cronograma ?? []).map((etapa) => ({
    id: `cronograma-${etapa._id}`,
    nombre: etapa.nombre,
    fecha: etapa.fechaReal ?? etapa.fechaPlaneada,
    estado: etapa.estado,
    fuente: 'Cronograma',
    orden: etapa.orden,
  }))

  const hojaTrabajo = (proc.hojaDeTrabajoEtapas ?? []).map((etapa) => ({
    id: `hoja-${etapa._id}`,
    nombre: etapa.nombre,
    fecha: etapa.fechaReal ?? etapa.fechaPlaneada,
    estado: etapa.estado,
    fuente: 'Hoja de trabajo',
    orden: etapa.orden + 1000,
  }))

  const entregas = (proc.entregas ?? []).map((entrega, index) => ({
    id: `entrega-${entrega._id}`,
    nombre: entrega.descripcion,
    fecha: entrega.fechaReal ?? entrega.fechaEstimada,
    estado: entrega.estado,
    fuente: 'Entregas',
    orden: index + 2000,
  }))

  return [...cronograma, ...hojaTrabajo, ...entregas]
    .sort((a, b) => {
      const fechaA = a.fecha ? new Date(a.fecha).getTime() : Number.MAX_SAFE_INTEGER
      const fechaB = b.fecha ? new Date(b.fecha).getTime() : Number.MAX_SAFE_INTEGER
      if (fechaA !== fechaB) return fechaA - fechaB
      return a.orden - b.orden
    })
    .map(({ orden, ...hito }) => hito)
}

function contarEntregasRecibidas(entregas: Entrega[]) {
  return entregas.filter((e) => ['recibida', 'recibida_propuesta'].includes(e.estado)).length
}

function obtenerResumen(proc: Procedimiento) {
  const etapasAplicables = [...(proc.cronograma ?? []), ...(proc.hojaDeTrabajoEtapas ?? [])]
    .filter((etapa) => !etapa.noAplica)
  const totalEtapas = etapasAplicables.length
  const etapasCompletadas = etapasAplicables.filter((e) => e.estado === 'completado').length
  const entregasTotales = proc.entregas?.length ?? 0
  const entregasRecibidas = contarEntregasRecibidas(proc.entregas ?? [])

  const totalElementos = totalEtapas + entregasTotales
  const completados = etapasCompletadas + entregasRecibidas
  const avance =
    proc.etapaActual === 'concluido'
      ? 100
      : proc.etapaActual === 'cancelado'
        ? Math.min(100, Math.round((completados / Math.max(totalElementos, 1)) * 100))
        : Math.round((completados / Math.max(totalElementos, 1)) * 100)

  const alertas = proc.etapasConAlerta ?? []
  const vencidas = alertas.filter((e) => e.vencida).length
  const proximas = alertas.filter((e) => e.proximaAVencer).length

  const hitos = normalizarHitos(proc)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const proximoHito = hitos.find((h) => h.fecha && new Date(h.fecha).getTime() >= hoy.getTime())

  return {
    totalEtapas,
    etapasCompletadas,
    entregasTotales,
    entregasRecibidas,
    avance,
    vencidas,
    proximas,
    hitos,
    proximoHito,
  }
}


function RielEtapas({ etapaActual }: { etapaActual: EtapaActual }) {
  const etapaActualIndex = ETAPAS_MACRO.indexOf(etapaActual)
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {ETAPAS_MACRO.map((etapa, index) => {
        const completada =
          etapaActual === 'concluido'
            ? etapa !== 'cancelado'
            : etapaActual === 'cancelado'
              ? index <= etapaActualIndex
              : index < etapaActualIndex
        const actual = index === etapaActualIndex
        const color = actual || completada ? ETAPA_COLOR[etapa] : 'bg-slate-200'
        return (
          <div key={etapa} className="flex items-center min-w-max">
            <div className="flex flex-col items-center gap-2">
              <span className={`h-3.5 w-3.5 rounded-full ${color}`} />
              <span className={`text-[11px] font-medium ${actual ? 'text-slate-900' : 'text-slate-500'}`}>
                {ETIQUETA_ETAPA[etapa]}
              </span>
            </div>
            {index < ETAPAS_MACRO.length - 1 && (
              <span
                className={`mx-2 h-1 w-10 rounded-full ${completada || actual ? 'bg-slate-300' : 'bg-slate-200'}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PanelLineaTiempo({ proc }: { proc: Procedimiento }) {
  const resumen = useMemo(() => obtenerResumen(proc), [proc])

  return (
    <div className="px-6 py-5 bg-slate-50 border-t border-slate-200 space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-blue-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">Etapas completadas</p>
          <p className="mt-1 text-2xl font-bold text-blue-950">
            {resumen.etapasCompletadas}
            <span className="ml-1 text-sm font-medium text-blue-700">/ {resumen.totalEtapas}</span>
          </p>
        </div>
        <div className="rounded-xl bg-amber-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-amber-700 font-semibold">Entregas recibidas</p>
          <p className="mt-1 text-2xl font-bold text-amber-900">
            {resumen.entregasRecibidas}
            <span className="ml-1 text-sm font-medium text-amber-700">/ {resumen.entregasTotales}</span>
          </p>
        </div>
        <div className="rounded-xl bg-rose-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-rose-700 font-semibold">Hitos vencidos</p>
          <p className="mt-1 text-2xl font-bold text-rose-900">{resumen.vencidas}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">Siguiente hito</p>
          <p className="mt-1 text-sm font-semibold text-emerald-900">
            {resumen.proximoHito?.fecha ? formatearFecha(resumen.proximoHito.fecha) : 'Sin fecha programada'}
          </p>
          <p className="mt-1 text-xs text-emerald-700 truncate">
            {resumen.proximoHito?.nombre ?? 'Todos los hitos registrados'}
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Ruta del procedimiento
          </h3>
          <span className="text-xs text-slate-400">
            {resumen.proximas > 0
              ? `${resumen.proximas} hito(s) proximo(s) a vencer`
              : 'Sin alertas proximas'}
          </span>
        </div>
        <RielEtapas etapaActual={proc.etapaActual} />
      </section>
    </div>
  )
}

export function ListaProcedimientos() {
  const { tieneRol } = useAuth()
  const navigate = useNavigate()

  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([])
  const [paginacion, setPaginacion] = useState<PaginacionTipo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<FiltroProcedimientos>({ page: 1, limit: 20 })

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [detallesCache, setDetallesCache] = useState<Record<string, Procedimiento>>({})
  const [cargandoDetalle, setCargandoDetalle] = useState<Record<string, boolean>>({})

  const [descargandoPDF, setDescargandoPDF] = useState<Set<string>>(new Set())
  const [descargandoExcel, setDescargandoExcel] = useState<Set<string>>(new Set())

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

  async function cargarDetalle(procId: string) {
    setCargandoDetalle((prev) => ({ ...prev, [procId]: true }))
    try {
      const detalle = await procedimientosService.obtener(procId)
      setDetallesCache((prev) => ({ ...prev, [procId]: detalle }))
    } finally {
      setCargandoDetalle((prev) => ({ ...prev, [procId]: false }))
    }
  }

  function toggleExpansion(e: React.MouseEvent, procId: string) {
    e.stopPropagation()
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(procId)) {
        next.delete(procId)
      } else {
        next.add(procId)
        if (!detallesCache[procId]) {
          cargarDetalle(procId)
        }
      }
      return next
    })
  }

  function aplicarFiltro(cambios: Partial<FiltroProcedimientos>) {
    setFiltros((prev) => ({ ...prev, ...cambios, page: 1 }))
  }

  function limpiarFiltros() {
    setFiltros({ page: 1, limit: 20 })
  }

  async function handleDescargarPDF(e: React.MouseEvent, proc: Procedimiento) {
    e.stopPropagation()
    if (descargandoPDF.has(proc._id)) return
    setDescargandoPDF((prev) => new Set(prev).add(proc._id))
    try {
      const slug = proc.numeroProcedimiento ?? proc._id
      await reportesService.descargarPDF(
        { procedimientoId: proc._id },
        `SSA-${slug}.pdf`
      )
    } finally {
      setDescargandoPDF((prev) => { const next = new Set(prev); next.delete(proc._id); return next })
    }
  }

  async function handleDescargarExcel(e: React.MouseEvent, proc: Procedimiento) {
    e.stopPropagation()
    if (descargandoExcel.has(proc._id)) return
    setDescargandoExcel((prev) => new Set(prev).add(proc._id))
    try {
      const slug = proc.numeroProcedimiento ?? proc._id
      await reportesService.descargarExcel(
        { procedimientoId: proc._id },
        `SSA-${slug}.xlsx`
      )
    } finally {
      setDescargandoExcel((prev) => { const next = new Set(prev); next.delete(proc._id); return next })
    }
  }

  const puedeCrear = tieneRol('administrador', 'adquisiciones', 'subdirector')

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
                urgente: e.target.value === '' ? undefined : e.target.value === 'si',
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
                <Link to="/procedimientos/nuevo" className="text-sm text-blue-700 hover:underline">
                  Crear el primer procedimiento
                </Link>
              ) : undefined
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  No. / Titulo
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tipo
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Sección
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
                <th className="px-3 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide text-center">
                  Reporte
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {procedimientos.map((proc) => (
                <Fragment key={proc._id}>
                  <tr
                    onClick={() => navigate(`/procedimientos/${proc._id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-2 py-3">
                      <button
                        type="button"
                        onClick={(e) => toggleExpansion(e, proc._id)}
                        className="flex items-center justify-center h-6 w-6 rounded hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-600"
                        title={expandidos.has(proc._id) ? 'Ocultar linea del tiempo' : 'Ver linea del tiempo'}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className={`transition-transform duration-200 ${expandidos.has(proc._id) ? 'rotate-90' : ''}`}
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {proc.urgente && (
                          <span
                            className="mt-0.5 inline-block h-2 w-2 rounded-full bg-red-500 shrink-0"
                            title="Urgente"
                          />
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
                      {typeof proc.seccion === 'object' && proc.seccion ? (proc.seccion as { nombre: string }).nombre : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {proc.asesorTitular
                        ? `${proc.asesorTitular.nombre} ${proc.asesorTitular.apellidos}`
                        : 'pendiente por designar'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge etapa={proc.etapaActual}>
                          {ETIQUETA_ETAPA[proc.etapaActual]}
                        </Badge>
                        {proc.etapasConAlerta && proc.etapasConAlerta.length > 0 && (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-yellow-400"
                            title={`${proc.etapasConAlerta.length} etapa(s) con alerta`}
                          />
                        )}
                        {!!proc.pendientesValidacion && proc.pendientesValidacion > 0 && (
                          <span
                            className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-red-500 text-white text-xs font-bold leading-none"
                            title={`${proc.pendientesValidacion} actividad(es) pendiente(s) de validacion`}
                          >
                            {proc.pendientesValidacion}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{proc.anioFiscal}</td>
                    <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleDescargarPDF(e, proc)}
                          disabled={descargandoPDF.has(proc._id)}
                          title="Descargar reporte PDF de este procedimiento"
                          className="flex items-center justify-center h-7 w-7 rounded text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
                        >
                          {descargandoPDF.has(proc._id) ? (
                            <Spinner className="h-4 w-4 text-red-400" />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="9" y1="13" x2="15" y2="13" />
                              <line x1="9" y1="17" x2="15" y2="17" />
                              <line x1="9" y1="9" x2="11" y2="9" />
                            </svg>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDescargarExcel(e, proc)}
                          disabled={descargandoExcel.has(proc._id)}
                          title="Descargar reporte Excel de este procedimiento"
                          className="flex items-center justify-center h-7 w-7 rounded text-green-700 hover:bg-green-50 disabled:opacity-40 transition-colors"
                        >
                          {descargandoExcel.has(proc._id) ? (
                            <Spinner className="h-4 w-4 text-green-600" />
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <path d="M8 13l2 2 4-4" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {expandidos.has(proc._id) && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        {cargandoDetalle[proc._id] ? (
                          <div className="flex justify-center py-8 bg-slate-50 border-t border-slate-200">
                            <Spinner className="text-blue-900" />
                          </div>
                        ) : detallesCache[proc._id] ? (
                          <PanelLineaTiempo proc={detallesCache[proc._id]} />
                        ) : null}
                      </td>
                    </tr>
                  )}
                </Fragment>
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
