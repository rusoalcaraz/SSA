import { useState, useEffect } from 'react'
import { dashboardService, type ResumenDashboard } from '../services/dashboard.service'
import { mensajeDeError } from '../services/api'
import { Spinner } from '../components/ui/Spinner'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO } from '../utils/formato'
import type { EtapaActual, TipoProcedimiento } from '../types'

const ETAPA_ORDEN: EtapaActual[] = ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido', 'cancelado']

const ETAPA_COLOR: Record<EtapaActual, string> = {
  cronograma: 'bg-blue-100 text-blue-800',
  hoja_de_trabajo: 'bg-purple-100 text-purple-800',
  entregas: 'bg-yellow-100 text-yellow-800',
  concluido: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-700',
}

function Tarjeta({
  titulo,
  valor,
  subtitulo,
  alerta,
}: {
  titulo: string
  valor: number | string
  subtitulo?: string
  alerta?: boolean
}) {
  return (
    <div className={`bg-white rounded-lg border px-5 py-4 ${alerta ? 'border-red-200' : 'border-gray-200'}`}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{titulo}</p>
      <p className={`text-3xl font-bold ${alerta ? 'text-red-600' : 'text-gray-900'}`}>{valor}</p>
      {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
    </div>
  )
}

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

  return (
    <div>
      {/* Encabezado */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Resumen ejecutivo</h1>
        <select
          value={anioFiscal}
          onChange={(e) => setAnioFiscal(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
        >
          <option value="">Todos los anios</option>
          {aniosOpciones.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {cargando && (
        <div className="flex justify-center py-20">
          <Spinner className="text-blue-900" />
        </div>
      )}

      {error && (
        <div className="py-10 text-center text-sm text-red-600">{error}</div>
      )}

      {resumen && !cargando && (
        <div className="space-y-6">
          {/* Tarjetas principales */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Tarjeta titulo="Total procedimientos" valor={resumen.totalProcedimientos} />
            <Tarjeta
              titulo="Urgentes"
              valor={resumen.totalUrgentes}
              alerta={resumen.totalUrgentes > 0}
            />
            <Tarjeta
              titulo="Etapas vencidas"
              valor={resumen.alertas.etapasVencidas}
              alerta={resumen.alertas.etapasVencidas > 0}
            />
            <Tarjeta
              titulo="Proximas a vencer"
              valor={resumen.alertas.etapasProximasAVencer}
              subtitulo="en los proximos 3 dias"
              alerta={resumen.alertas.etapasProximasAVencer > 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* Por etapa actual */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Por etapa actual</h2>
              <div className="space-y-2">
                {ETAPA_ORDEN.map((etapa) => {
                  const count = resumen.porEtapaActual[etapa] ?? 0
                  if (count === 0) return null
                  return (
                    <div key={etapa} className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ETAPA_COLOR[etapa]}`}
                      >
                        {ETIQUETA_ETAPA[etapa]}
                      </span>
                      <span className="text-sm font-semibold text-gray-700">{count}</span>
                    </div>
                  )
                })}
                {Object.keys(resumen.porEtapaActual).length === 0 && (
                  <p className="text-xs text-gray-400">Sin datos</p>
                )}
              </div>
            </div>

            {/* Por tipo de procedimiento */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Por tipo de procedimiento</h2>
              <div className="space-y-2">
                {(Object.entries(resumen.porTipoProcedimiento) as [TipoProcedimiento, number][])
                  .sort(([, a], [, b]) => b - a)
                  .map(([tipo, count]) => (
                    <div key={tipo} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-600 truncate">
                        {ETIQUETA_TIPO[tipo] ?? tipo}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 shrink-0">{count}</span>
                    </div>
                  ))}
                {Object.keys(resumen.porTipoProcedimiento).length === 0 && (
                  <p className="text-xs text-gray-400">Sin datos</p>
                )}
              </div>
            </div>

            {/* Por DG */}
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Por Direccion General</h2>
              <div className="space-y-2">
                {resumen.porDireccionGeneral.map((dg) => (
                  <div key={dg._id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-gray-700">{dg.siglas ?? '—'}</span>
                      {dg.urgentes > 0 && (
                        <span className="ml-1 text-xs text-red-500">({dg.urgentes} urg.)</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 shrink-0">{dg.total}</span>
                  </div>
                ))}
                {resumen.porDireccionGeneral.length === 0 && (
                  <p className="text-xs text-gray-400">Sin datos</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
