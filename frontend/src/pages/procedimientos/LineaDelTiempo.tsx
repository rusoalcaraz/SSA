import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { dashboardService } from '../../services/dashboard.service'
import { catalogosService } from '../../services/catalogos.service'
import { mensajeDeError } from '../../services/api'
import type {
  Subdireccion,
  Entrega,
  EtapaActual,
  Paginacion as PaginacionTipo,
  Procedimiento,
  TipoProcedimiento,
} from '../../types'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { Badge } from '../../components/ui/Badge'
import { Paginacion } from '../../components/ui/Paginacion'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO, formatearFecha } from '../../utils/formato'

const TIPOS: { value: TipoProcedimiento; label: string }[] = [
  { value: 'licitacion_publica_nacional', label: ETIQUETA_TIPO.licitacion_publica_nacional },
  { value: 'licitacion_publica_internacional_libre', label: ETIQUETA_TIPO.licitacion_publica_internacional_libre },
  { value: 'licitacion_publica_internacional_tratados', label: ETIQUETA_TIPO.licitacion_publica_internacional_tratados },
  { value: 'invitacion_tres_personas', label: ETIQUETA_TIPO.invitacion_tres_personas },
  { value: 'adjudicacion_directa', label: ETIQUETA_TIPO.adjudicacion_directa },
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
    fuente: index === 0 ? 'Entregas' : 'Entregas',
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
  return entregas.filter((entrega) => ['recibida', 'recibida_propuesta'].includes(entrega.estado)).length
}

function obtenerResumen(proc: Procedimiento) {
  const etapasAplicables = [...(proc.cronograma ?? []), ...(proc.hojaDeTrabajoEtapas ?? [])]
    .filter((etapa) => !etapa.noAplica)
  const totalEtapas = etapasAplicables.length
  const etapasCompletadas = etapasAplicables.filter((etapa) => etapa.estado === 'completado').length
  const entregasTotales = proc.entregas?.length ?? 0
  const entregasRecibidas = contarEntregasRecibidas(proc.entregas ?? [])

  const totalElementos = totalEtapas + entregasTotales
  const completados = etapasCompletadas + entregasRecibidas
  const avance = proc.etapaActual === 'concluido'
    ? 100
    : proc.etapaActual === 'cancelado'
      ? Math.min(100, Math.round((completados / Math.max(totalElementos, 1)) * 100))
      : Math.round((completados / Math.max(totalElementos, 1)) * 100)

  const alertas = proc.etapasConAlerta ?? []
  const vencidas = alertas.filter((etapa) => etapa.vencida).length
  const proximas = alertas.filter((etapa) => etapa.proximaAVencer).length

  const hitos = normalizarHitos(proc)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const proximoHito = hitos.find((hito) => {
    if (!hito.fecha) return false
    return new Date(hito.fecha).getTime() >= hoy.getTime()
  })

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

function colorSemaforo(hito: Hito) {
  if (['completado', 'recibida', 'recibida_propuesta'].includes(hito.estado)) return 'bg-emerald-500'
  if (['vencido', 'rechazada', 'fecha_rechazada'].includes(hito.estado)) return 'bg-rose-500'
  if (['activo', 'fecha_propuesta', 'completado_propuesto'].includes(hito.estado)) return 'bg-amber-500'
  return 'bg-slate-400'
}

function AvanceCircular({ porcentaje }: { porcentaje: number }) {
  return (
    <div
      className="relative h-20 w-20 rounded-full"
      style={{ background: `conic-gradient(#1d4ed8 ${porcentaje}%, #e5e7eb 0)` }}
    >
      <div className="absolute inset-[7px] rounded-full bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-bold text-slate-900 leading-none">{porcentaje}%</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">Avance</div>
        </div>
      </div>
    </div>
  )
}

function RielEtapas({ etapaActual }: { etapaActual: EtapaActual }) {
  const etapaActualIndex = ETAPAS_MACRO.indexOf(etapaActual)

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {ETAPAS_MACRO.map((etapa, index) => {
        const completada = etapaActual === 'concluido'
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
              <span className={`mx-2 h-1 w-10 rounded-full ${completada || actual ? 'bg-slate-300' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function TarjetaProcedimiento({ procedimiento }: { procedimiento: Procedimiento }) {
  const navigate = useNavigate()
  const resumen = useMemo(() => obtenerResumen(procedimiento), [procedimiento])

  return (
    <article className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {procedimiento.urgente && (
                <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                  Urgente
                </span>
              )}
              <span className="font-mono text-[11px] text-slate-500">
                {procedimiento.numeroProcedimiento ?? 'Sin numero'}
              </span>
              <Badge etapa={procedimiento.etapaActual}>
                {ETIQUETA_ETAPA[procedimiento.etapaActual]}
              </Badge>
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-tight">{procedimiento.titulo}</h2>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>{ETIQUETA_TIPO[procedimiento.tipoProcedimiento]}</span>
              <span>{typeof procedimiento.seccion === 'object' && procedimiento.seccion ? (procedimiento.seccion as { nombre: string }).nombre : typeof procedimiento.subdireccion === 'object' && procedimiento.subdireccion ? (procedimiento.subdireccion as Subdireccion).nombre : '—'}</span>
              <span>{procedimiento.anioFiscal}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <AvanceCircular porcentaje={resumen.avance} />
            <button
              type="button"
              onClick={() => navigate(`/procedimientos/${procedimiento._id}`)}
              className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 transition-colors"
            >
              Ver detalle
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5">
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ruta del procedimiento</h3>
            <span className="text-xs text-slate-400">
              {resumen.proximas > 0 ? `${resumen.proximas} hito(s) proximo(s) a vencer` : 'Sin alertas proximas'}
            </span>
          </div>
          <RielEtapas etapaActual={procedimiento.etapaActual} />
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Linea del tiempo</h3>
            <span className="text-xs text-slate-400">
              {resumen.hitos.length} hito{resumen.hitos.length !== 1 ? 's' : ''} registrados
            </span>
          </div>

          {resumen.hitos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400">
              Aun no hay hitos cargados para este procedimiento.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {resumen.hitos.slice(0, 6).map((hito) => (
                <div key={hito.id} className="rounded-xl border border-slate-200 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-3 w-3 rounded-full shrink-0 ${colorSemaforo(hito)}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-snug">{hito.nombre}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{hito.fuente}</span>
                        <span className="capitalize">{hito.estado.replace(/_/g, ' ')}</span>
                        <span>{hito.fecha ? formatearFecha(hito.fecha) : 'Sin fecha'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  )
}

export function LineaDelTiempo() {
  const { tieneRol } = useAuth()
  const [procedimientos, setProcedimientos] = useState<Procedimiento[]>([])
  const [paginacion, setPaginacion] = useState<PaginacionTipo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [anioFiscal, setAnioFiscal] = useState('')
  const [subdirecciones, setSubdirecciones] = useState<Subdireccion[]>([])
  const [subdireccionId, setSubdireccionId] = useState('')
  const [tipoProcedimiento, setTipoProcedimiento] = useState<string>('')
  const [q, setQ] = useState('')

  const esSubdirector = tieneRol('subdirector')
  const esJefe = tieneRol('jefe_seccion')
  const esGlobal = tieneRol('administrador', 'adquisiciones')
  const esAsesor = tieneRol('asesor_tecnico')

  useEffect(() => {
    if (!esGlobal) {
      setSubdirecciones([])
      setSubdireccionId('')
      return
    }
    catalogosService
      .listarSubdirecciones(true)
      .then(setSubdirecciones)
      .catch(() => {})
  }, [esGlobal])

  useEffect(() => {
    setCargando(true)
    setError(null)

    dashboardService
      .misProcedimientos({
        page: pagina,
        limit: 8,
        ...(anioFiscal ? { anioFiscal: Number(anioFiscal) } : {}),
        ...(q ? { q } : {}),
        ...(tipoProcedimiento ? { tipoProcedimiento: tipoProcedimiento as TipoProcedimiento } : {}),
        ...(esGlobal && subdireccionId ? { subdireccionId } : {}),
      })
      .then(({ procedimientos: lista, pagination }) => {
        setProcedimientos(lista)
        setPaginacion(pagination)
      })
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [pagina, anioFiscal, q, tipoProcedimiento, subdireccionId, esGlobal])

  const anioActual = new Date().getFullYear()
  const aniosOpciones = Array.from({ length: 5 }, (_, index) => anioActual - index)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-linear-to-r from-slate-900 via-blue-950 to-blue-800 px-6 py-5 shadow-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Linea del tiempo</h1>
            <p className="mt-1 max-w-3xl text-sm text-blue-100">
              {esAsesor
                ? 'Vista grafica del avance de todos los procedimientos en los que participa como asesor tecnico.'
                : esSubdirector
                  ? 'Vista grafica del avance de los procedimientos de tu subdirección.'
                  : esJefe
                    ? 'Vista grafica del avance de los procedimientos de tu sección.'
                  : 'Vista grafica del avance de procedimientos con filtros de consulta.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-blue-100">
              Anio fiscal
            </label>
            <select
              value={anioFiscal}
              onChange={(event) => {
                setPagina(1)
                setAnioFiscal(event.target.value)
              }}
              className="rounded-lg border border-blue-400 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="" className="text-slate-900">Todos</option>
              {aniosOpciones.map((anio) => (
                <option key={anio} value={anio} className="text-slate-900">
                  {anio}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 w-full">
            {esGlobal && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Subdirección</label>
                <select
                  value={subdireccionId}
                  onChange={(event) => {
                    setPagina(1)
                    setSubdireccionId(event.target.value)
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
                >
                  <option value="">Todas</option>
                  {subdirecciones.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">No. / Titulo</label>
              <input
                value={q}
                onChange={(event) => {
                  setPagina(1)
                  setQ(event.target.value)
                }}
                placeholder="Buscar..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">Tipo de procedimiento</label>
              <select
                value={tipoProcedimiento}
                onChange={(event) => {
                  setPagina(1)
                  setTipoProcedimiento(event.target.value)
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              >
                <option value="">Todos</option>
                {TIPOS.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPagina(1)
                setAnioFiscal('')
                setQ('')
                setTipoProcedimiento('')
                if (esGlobal) setSubdireccionId('')
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {cargando ? (
        <div className="flex justify-center py-20">
          <Spinner className="text-blue-900" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : procedimientos.length === 0 ? (
        <EmptyState
          titulo="Sin procedimientos asignados"
          mensaje="No hay procedimientos para mostrar en la linea del tiempo con los filtros actuales."
        />
      ) : (
        <>
          <div className="grid gap-5">
            {procedimientos.map((procedimiento) => (
              <TarjetaProcedimiento key={procedimiento._id} procedimiento={procedimiento} />
            ))}
          </div>

          {paginacion && paginacion.totalPaginas > 1 && (
            <Paginacion paginacion={paginacion} onChange={setPagina} />
          )}
        </>
      )}
    </div>
  )
}
