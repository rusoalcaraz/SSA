import { useState, useEffect, useRef, useCallback } from 'react'
import { dashboardService, type ResumenDashboard } from '../services/dashboard.service'
import { mensajeDeError } from '../services/api'
import { Spinner } from '../components/ui/Spinner'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO } from '../utils/formato'
import type { EtapaActual, TipoProcedimiento } from '../types'

// ── Constantes ───────────────────────────────────────────────────────────────

const ETAPA_ORDEN: EtapaActual[] = ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido', 'cancelado']

const ETAPA_COLORS: Record<EtapaActual, string> = {
  cronograma: '#3B82F6',
  hoja_de_trabajo: '#A855F7',
  entregas: '#F59E0B',
  concluido: '#22C55E',
  cancelado: '#EF4444',
}

const TIPO_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6']

// ── Iconos SVG ───────────────────────────────────────────────────────────────

function IcoDocumento({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 0 0 2.25 2.25h.75" />
    </svg>
  )
}
function IcoAlerta({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
    </svg>
  )
}
function IcoReloj({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  )
}
function IcoCalendario({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}

// ── Gráfica donut SVG pura ───────────────────────────────────────────────────

interface DonutSlice {
  label: string
  value: number
  color: string
}

function GraficaDonut({ slices, size = 180 }: { slices: DonutSlice[]; size?: number }) {
  const [tooltip, setTooltip] = useState<{ slice: DonutSlice; x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const total = slices.reduce((s, d) => s + d.value, 0)
  if (total === 0) return <p className="text-xs text-gray-400 py-10 text-center">Sin datos</p>

  const cx = size / 2
  const cy = size / 2
  const R = size * 0.42
  const r = size * 0.24
  const strokeW = R - r

  // build arcs
  let offset = -0.25 // start at 12 o'clock
  const arcs = slices
    .filter((s) => s.value > 0)
    .map((s) => {
      const pct = s.value / total
      const start = offset
      offset += pct
      return { ...s, start, pct }
    })

  function polarToXY(pct: number, radius: number) {
    const angle = (pct * 2 - 0.5) * Math.PI
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    }
  }

  function describeArc(startPct: number, endPct: number, radius: number) {
    const from = polarToXY(startPct, radius)
    const to = polarToXY(endPct, radius)
    const large = endPct - startPct > 0.5 ? 1 : 0
    return `M ${from.x} ${from.y} A ${radius} ${radius} 0 ${large} 1 ${to.x} ${to.y}`
  }

  const midR = (R + r) / 2

  const handleMove = useCallback((e: React.MouseEvent<SVGPathElement>, slice: DonutSlice) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setTooltip({ slice, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [])

  return (
    <div className="relative">
      <svg ref={svgRef} width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto block">
        {arcs.map((arc, i) => {
          const endPct = arc.start + arc.pct
          const gap = 0.008
          const s = arc.start + gap
          const e = endPct - gap
          if (e <= s) return null
          const midAngle = ((s + e) / 2) * 2 * Math.PI - Math.PI / 2
          const mx = cx + midR * Math.cos(midAngle)
          const my = cy + midR * Math.sin(midAngle)
          return (
            <path
              key={i}
              d={describeArc(s, e, midR)}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseMove={(ev) => handleMove(ev, arc)}
              onMouseLeave={() => setTooltip(null)}
              opacity={tooltip && tooltip.slice.label !== arc.label ? 0.6 : 1}
              data-mx={mx}
              data-my={my}
            />
          )
        })}
        {/* Centro: total */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-sm" style={{ fontSize: 22, fontWeight: 700, fill: '#111827' }}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: '#9CA3AF' }}>
          total
        </text>
      </svg>
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-sm z-10"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: tooltip.slice.color }} />
            <span className="font-semibold text-gray-800">{tooltip.slice.label}</span>
          </div>
          <span className="text-gray-500">
            {tooltip.slice.value} procedimientos ({Math.round((tooltip.slice.value / total) * 100)}%)
          </span>
        </div>
      )}
    </div>
  )
}

// ── Leyenda de colores ───────────────────────────────────────────────────────

function Leyenda({ items }: { items: { label: string; color: string; value: number }[] }) {
  return (
    <div className="flex flex-col gap-1.5 mt-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs">
          <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.color }} />
          <span className="text-gray-600 flex-1 truncate">{item.label}</span>
          <span className="font-semibold text-gray-800 ml-auto">{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ── Barra horizontal simple ──────────────────────────────────────────────────

function BarraHorizontal({
  label,
  value,
  maxValue,
  color,
  subtitulo,
}: {
  label: string
  value: number
  maxValue: number
  color: string
  subtitulo?: string
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-xs text-gray-600 truncate">{label}</span>
        <span className="text-xs font-bold text-gray-800 shrink-0">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {subtitulo && <p className="text-[10px] text-gray-400 mt-0.5">{subtitulo}</p>}
    </div>
  )
}

// ── Tarjeta KPI ──────────────────────────────────────────────────────────────

function TarjetaKPI({
  titulo,
  valor,
  subtitulo,
  alerta,
  icono,
  colorBorde,
  colorFondo,
  colorIcono,
}: {
  titulo: string
  valor: number | string
  subtitulo?: string
  alerta?: boolean
  icono: React.ReactNode
  colorBorde: string
  colorFondo: string
  colorIcono: string
}) {
  return (
    <div
      className={`bg-white rounded-xl border-t-4 ${alerta ? 'border-red-500' : colorBorde} shadow-sm p-3 xl:px-5 xl:py-4 flex items-start gap-2 xl:gap-4 hover:shadow-md transition-shadow`}
    >
      <div className={`shrink-0 rounded-lg xl:rounded-xl p-2 xl:p-2.5 ${alerta ? 'bg-red-50 text-red-500' : `${colorFondo} ${colorIcono}`}`}>
        {icono}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] xl:text-xs font-semibold text-gray-400 uppercase tracking-wide xl:tracking-wider mb-1 leading-tight">{titulo}</p>
        <p className={`text-2xl xl:text-3xl font-extrabold leading-none ${alerta ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
        {subtitulo && <p className="text-[10px] xl:text-xs text-gray-400 mt-1 leading-tight">{subtitulo}</p>}
      </div>
    </div>
  )
}

// ── Componente principal ─────────────────────────────────────────────────────

export function Dashboard() {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [anioFiscal, setAnioFiscal] = useState<string>('')

  useEffect(() => {
    setCargando(true)
    setError(null)
    dashboardService
      .resumen(anioFiscal ? Number(anioFiscal) : undefined)
      .then(setResumen)
      .catch((err) => setError(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [anioFiscal])

  const anioActual = new Date().getFullYear()
  const aniosOpciones = Array.from({ length: 5 }, (_, i) => anioActual - i)

  // Datos gráfica donut — etapas
  const datosEtapa: DonutSlice[] = resumen
    ? ETAPA_ORDEN.filter((e) => (resumen.porEtapaActual[e] ?? 0) > 0).map((e) => ({
        label: ETIQUETA_ETAPA[e],
        value: resumen.porEtapaActual[e],
        color: ETAPA_COLORS[e],
      }))
    : []

  // Datos barras horizontales — tipos
  const datosTipo = resumen
    ? (Object.entries(resumen.porTipoProcedimiento) as [TipoProcedimiento, number][])
        .filter(([, c]) => c > 0)
        .sort(([, a], [, b]) => b - a)
    : []
  const maxTipo = datosTipo.reduce((m, [, c]) => Math.max(m, c), 0)

  // Datos DGs
  const datosDG = resumen
    ? [...resumen.porDireccionGeneral]
        .filter((d) => d.total > 0)
        .sort((a, b) => b.total - a.total)
    : []
  const maxDG = datosDG.reduce((m, d) => Math.max(m, d.total), 0)

  const hayAlertas =
    resumen && (resumen.alertas.etapasVencidas > 0 || resumen.alertas.etapasProximasAVencer > 0)

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between shadow-md"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)' }}
      >
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Resumen Ejecutivo</h1>
          <p className="text-blue-300 text-sm mt-0.5">Sistema de Seguimiento de Adquisiciones</p>
        </div>
        <select
          value={anioFiscal}
          onChange={(e) => setAnioFiscal(e.target.value)}
          className="rounded-lg border border-blue-500 bg-white/10 text-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 backdrop-blur"
        >
          <option value="" className="text-gray-900">Todos los años</option>
          {aniosOpciones.map((a) => (
            <option key={a} value={a} className="text-gray-900">{a}</option>
          ))}
        </select>
      </div>

      {/* ── Loading ── */}
      {cargando && (
        <div className="flex justify-center py-20">
          <Spinner className="text-blue-900" />
        </div>
      )}

      {/* ── Error de API ── */}
      {error && (
        <div className="py-10 text-center text-sm text-red-600">{error}</div>
      )}

      {resumen && !cargando && (
        <>
          {/* ── Banner alertas ── */}
          {hayAlertas && (
            <div className="flex flex-wrap gap-3">
              {resumen.alertas.etapasVencidas > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700 font-medium">
                  <IcoReloj className="w-4 h-4 text-red-500" />
                  <span>
                    <strong>{resumen.alertas.etapasVencidas}</strong> etapa{resumen.alertas.etapasVencidas !== 1 ? 's' : ''} vencida{resumen.alertas.etapasVencidas !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {resumen.alertas.etapasProximasAVencer > 0 && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-sm text-amber-700 font-medium">
                  <IcoCalendario className="w-4 h-4 text-amber-500" />
                  <span>
                    <strong>{resumen.alertas.etapasProximasAVencer}</strong> etapa{resumen.alertas.etapasProximasAVencer !== 1 ? 's' : ''} próxima{resumen.alertas.etapasProximasAVencer !== 1 ? 's' : ''} a vencer (3 días)
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <TarjetaKPI
              titulo="Total procedimientos"
              valor={resumen.totalProcedimientos}
              colorBorde="border-blue-500"
              colorFondo="bg-blue-50"
              colorIcono="text-blue-600"
              icono={<IcoDocumento className="w-6 h-6" />}
            />
            <TarjetaKPI
              titulo="Urgentes"
              valor={resumen.totalUrgentes}
              alerta={resumen.totalUrgentes > 0}
              colorBorde="border-orange-400"
              colorFondo="bg-orange-50"
              colorIcono="text-orange-500"
              icono={<IcoAlerta className="w-6 h-6" />}
            />
            <TarjetaKPI
              titulo="Etapas vencidas"
              valor={resumen.alertas.etapasVencidas}
              alerta={resumen.alertas.etapasVencidas > 0}
              colorBorde="border-red-400"
              colorFondo="bg-red-50"
              colorIcono="text-red-500"
              icono={<IcoReloj className="w-6 h-6" />}
            />
            <TarjetaKPI
              titulo="Próximas a vencer"
              valor={resumen.alertas.etapasProximasAVencer}
              subtitulo="en los próximos 3 días"
              alerta={resumen.alertas.etapasProximasAVencer > 0}
              colorBorde="border-amber-400"
              colorFondo="bg-amber-50"
              colorIcono="text-amber-500"
              icono={<IcoCalendario className="w-6 h-6" />}
            />
          </div>

          {/* ── Fila gráficas: Donut + Barras tipo ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Donut — distribución por etapa */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                Distribución por etapa
              </h2>
              <div className="flex flex-col items-center">
                <GraficaDonut slices={datosEtapa} size={200} />
                <Leyenda items={datosEtapa.map((s) => ({ label: s.label, color: s.color, value: s.value }))} />
              </div>
            </div>

            {/* Barras horizontales — tipos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                Procedimientos por tipo
              </h2>
              {datosTipo.length > 0 ? (
                <div className="space-y-4">
                  {datosTipo.map(([tipo, count], i) => (
                    <BarraHorizontal
                      key={tipo}
                      label={ETIQUETA_TIPO[tipo] ?? tipo}
                      value={count}
                      maxValue={maxTipo}
                      color={TIPO_COLORS[i % TIPO_COLORS.length]}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-10 text-center">Sin datos</p>
              )}
            </div>
          </div>

          {/* ── Gráfica DGs ── */}
          {datosDG.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-5">
                Procedimientos por Dirección General
              </h2>
              {/* Barras SVG para DGs */}
              <GraficaBarrasDG dgs={datosDG} maxValue={maxDG} />
            </div>
          )}

          {/* ── Tabla detalle DGs ── */}
          {datosDG.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-5">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">
                Detalle por Dirección General
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Dirección</th>
                      <th className="text-right py-2 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Total</th>
                      <th className="text-right py-2 pl-4 text-xs font-semibold text-gray-400 uppercase tracking-wide">Urgentes</th>
                      <th className="py-2 pl-6 text-xs font-semibold text-gray-400 uppercase tracking-wide">Participación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {datosDG.map((dg) => {
                      const pct =
                        resumen.totalProcedimientos > 0
                          ? Math.round((dg.total / resumen.totalProcedimientos) * 100)
                          : 0
                      return (
                        <tr key={dg._id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-2.5 pr-4">
                            <span className="font-semibold text-gray-800">{dg.siglas}</span>
                            <span className="ml-2 text-xs text-gray-400 hidden sm:inline truncate">{dg.nombre}</span>
                          </td>
                          <td className="text-right py-2.5 px-4 font-bold text-gray-800">{dg.total}</td>
                          <td className="text-right py-2.5 pl-4">
                            {dg.urgentes > 0 ? (
                              <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500" />
                                {dg.urgentes}
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="py-2.5 pl-6">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-16 max-w-32">
                                <div
                                  className="bg-blue-500 h-1.5 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-400 w-8 shrink-0">{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Gráfica de barras SVG para DGs ──────────────────────────────────────────

interface DGBar {
  _id: string
  nombre: string
  siglas: string
  total: number
  urgentes: number
}

function GraficaBarrasDG({ dgs, maxValue }: { dgs: DGBar[]; maxValue: number }) {
  const [tooltip, setTooltip] = useState<{ dg: DGBar; x: number; y: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const displayed = dgs.slice(0, 12)
  const W = 800
  const H = 200
  const padL = 48
  const padR = 16
  const padT = 10
  const padB = 40
  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = Math.floor(chartW / displayed.length) - 6
  const yTicks = 4

  function barX(i: number) {
    return padL + Math.floor((chartW / displayed.length) * i) + Math.floor((chartW / displayed.length - barW) / 2)
  }
  function valToY(v: number) {
    return padT + chartH - (maxValue > 0 ? (v / maxValue) * chartH : 0)
  }

  const handleMove = useCallback((e: React.MouseEvent<SVGRectElement>, dg: DGBar) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = W / rect.width
    const scaleY = H / rect.height
    setTooltip({
      dg,
      x: (e.clientX - rect.left) / scaleX,
      y: (e.clientY - rect.top) / scaleY,
    })
  }, [])

  return (
    <div className="relative overflow-x-auto">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ minWidth: Math.max(400, displayed.length * 60) }}
      >
        {/* Grid lines */}
        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = Math.round((maxValue / yTicks) * i)
          const y = valToY(v)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#F3F4F6" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" style={{ fontSize: 10, fill: '#9CA3AF' }}>
                {v}
              </text>
            </g>
          )
        })}
        {/* Barras total */}
        {displayed.map((dg, i) => {
          const x = barX(i)
          const yT = valToY(dg.total)
          const h = padT + chartH - yT
          return (
            <rect
              key={`total-${dg._id}`}
              x={x}
              y={yT}
              width={barW}
              height={h}
              rx={4}
              fill="#3B82F6"
              opacity={tooltip && tooltip.dg._id !== dg._id ? 0.5 : 1}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
              onMouseMove={(e) => handleMove(e, dg)}
              onMouseLeave={() => setTooltip(null)}
            />
          )
        })}
        {/* Barras urgentes (encima) */}
        {displayed.map((dg, i) => {
          if (dg.urgentes === 0) return null
          const x = barX(i)
          const yU = valToY(dg.urgentes)
          const h = padT + chartH - yU
          return (
            <rect
              key={`urg-${dg._id}`}
              x={x + barW * 0.25}
              y={yU}
              width={barW * 0.5}
              height={h}
              rx={3}
              fill="#EF4444"
              style={{ pointerEvents: 'none' }}
            />
          )
        })}
        {/* Etiquetas eje X */}
        {displayed.map((dg, i) => (
          <text
            key={`label-${dg._id}`}
            x={barX(i) + barW / 2}
            y={padT + chartH + 18}
            textAnchor="middle"
            style={{ fontSize: 11, fill: '#6B7280' }}
          >
            {dg.siglas || dg.nombre.substring(0, 6)}
          </text>
        ))}
        {/* Tooltip SVG */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x + 8, W - 160)}
              y={Math.max(tooltip.y - 48, 2)}
              width={152}
              height={54}
              rx={8}
              fill="white"
              stroke="#E5E7EB"
              strokeWidth={1}
              filter="drop-shadow(0 2px 4px rgba(0,0,0,.1))"
            />
            <text
              x={Math.min(tooltip.x + 16, W - 152)}
              y={Math.max(tooltip.y - 30, 18)}
              style={{ fontSize: 11, fontWeight: 700, fill: '#1F2937' }}
            >
              {tooltip.dg.siglas}
            </text>
            <text
              x={Math.min(tooltip.x + 16, W - 152)}
              y={Math.max(tooltip.y - 14, 34)}
              style={{ fontSize: 10, fill: '#6B7280' }}
            >
              Total: {tooltip.dg.total}
            </text>
            <text
              x={Math.min(tooltip.x + 16, W - 152)}
              y={Math.max(tooltip.y + 2, 50)}
              style={{ fontSize: 10, fill: '#EF4444' }}
            >
              Urgentes: {tooltip.dg.urgentes}
            </text>
          </g>
        )}
      </svg>
      {/* Leyenda */}
      <div className="flex gap-4 mt-2 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#3B82F6' }} />
          Total
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#EF4444' }} />
          Urgentes
        </span>
      </div>
    </div>
  )
}
