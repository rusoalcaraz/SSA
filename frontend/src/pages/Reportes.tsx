import { useState, useEffect } from 'react'
import type { EtapaActual, TipoProcedimiento, DireccionGeneral } from '../types'
import { reportesService, type FiltroReporte } from '../services/reportes.service'
import { catalogosService } from '../services/catalogos.service'
import { mensajeDeError } from '../services/api'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO_LARGO } from '../utils/formato'

const ETAPAS_ORDEN: EtapaActual[] = ['cronograma', 'hoja_de_trabajo', 'entregas', 'concluido', 'cancelado']

const TIPOS: TipoProcedimiento[] = [
  'licitacion_publica_nacional',
  'licitacion_publica_internacional_libre',
  'licitacion_publica_internacional_tratados',
  'invitacion_tres_personas',
  'adjudicacion_directa',
]

export function Reportes() {
  const [dgs, setDgs] = useState<DireccionGeneral[]>([])

  const [anioFiscal, setAnioFiscal] = useState('')
  const [dgId, setDgId] = useState('')
  const [tipoProcedimiento, setTipoProcedimiento] = useState('')
  const [etapaActual, setEtapaActual] = useState('')
  const [urgente, setUrgente] = useState('')

  const [descargandoPDF, setDescargandoPDF] = useState(false)
  const [descargandoExcel, setDescargandoExcel] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    catalogosService.listarDGs().then(setDgs).catch(() => {})
  }, [])

  function buildFiltros(): FiltroReporte {
    return {
      ...(anioFiscal ? { anioFiscal: Number(anioFiscal) } : {}),
      ...(dgId ? { dgId } : {}),
      ...(tipoProcedimiento ? { tipoProcedimiento: tipoProcedimiento as TipoProcedimiento } : {}),
      ...(etapaActual ? { etapaActual: etapaActual as EtapaActual } : {}),
      ...(urgente !== '' ? { urgente: urgente === 'true' } : {}),
    }
  }

  async function handlePDF() {
    setDescargandoPDF(true)
    setErrorMsg(null)
    try {
      await reportesService.descargarPDF(buildFiltros())
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDescargandoPDF(false)
    }
  }

  async function handleExcel() {
    setDescargandoExcel(true)
    setErrorMsg(null)
    try {
      await reportesService.descargarExcel(buildFiltros())
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDescargandoExcel(false)
    }
  }

  function limpiarFiltros() {
    setAnioFiscal('')
    setDgId('')
    setTipoProcedimiento('')
    setEtapaActual('')
    setUrgente('')
    setErrorMsg(null)
  }

  const anioActual = new Date().getFullYear()
  const aniosOpciones = Array.from({ length: 5 }, (_, i) => anioActual - i)

  const hayFiltros = anioFiscal || dgId || tipoProcedimiento || etapaActual || urgente !== ''

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Reportes</h1>
      <p className="text-sm text-gray-500 mb-6">
        Aplica filtros opcionales y descarga el reporte en el formato deseado.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 px-6 py-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Filtros</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Anio fiscal */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Anio fiscal
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={anioFiscal}
              onChange={(e) => setAnioFiscal(e.target.value)}
            >
              <option value="">Todos</option>
              {aniosOpciones.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Direccion General */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Direccion General
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={dgId}
              onChange={(e) => setDgId(e.target.value)}
            >
              <option value="">Todas</option>
              {dgs.map((dg) => (
                <option key={dg._id} value={dg._id}>
                  {dg.siglas} — {dg.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo de procedimiento */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Tipo de procedimiento
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={tipoProcedimiento}
              onChange={(e) => setTipoProcedimiento(e.target.value)}
            >
              <option value="">Todos</option>
              {TIPOS.map((t) => (
                <option key={t} value={t}>{ETIQUETA_TIPO_LARGO[t]}</option>
              ))}
            </select>
          </div>

          {/* Etapa actual */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Etapa actual
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={etapaActual}
              onChange={(e) => setEtapaActual(e.target.value)}
            >
              <option value="">Todas</option>
              {ETAPAS_ORDEN.map((e) => (
                <option key={e} value={e}>{ETIQUETA_ETAPA[e]}</option>
              ))}
            </select>
          </div>

          {/* Urgente */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
              Urgente
            </label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={urgente}
              onChange={(e) => setUrgente(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="true">Solo urgentes</option>
              <option value="false">Solo no urgentes</option>
            </select>
          </div>
        </div>

        {hayFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Resumen de filtros activos */}
      {hayFiltros && (
        <div className="mb-5 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700 flex flex-wrap gap-2">
          <span className="font-medium">Filtros activos:</span>
          {anioFiscal && <span>Anio {anioFiscal}</span>}
          {dgId && <span>DG: {dgs.find((d) => d._id === dgId)?.siglas ?? dgId}</span>}
          {tipoProcedimiento && <span>{ETIQUETA_TIPO_LARGO[tipoProcedimiento as TipoProcedimiento]}</span>}
          {etapaActual && <span>Etapa: {ETIQUETA_ETAPA[etapaActual as EtapaActual]}</span>}
          {urgente !== '' && <span>{urgente === 'true' ? 'Solo urgentes' : 'Solo no urgentes'}</span>}
        </div>
      )}

      {errorMsg && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {/* Botones de descarga */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* PDF */}
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-800">Reporte PDF</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">
                Resumen ejecutivo con totales por etapa y detalle de cada procedimiento.
              </p>
              <button
                type="button"
                disabled={descargandoPDF}
                onClick={handlePDF}
                className="px-4 py-2 text-sm rounded-md bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
              >
                {descargandoPDF ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>

        {/* Excel */}
        <div className="bg-white rounded-lg border border-gray-200 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-9.75 0h9.75" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-800">Reporte Excel</h3>
              <p className="text-xs text-gray-400 mt-0.5 mb-4">
                Tabla completa con todos los campos, auto-filtros y formato condicional para urgentes.
              </p>
              <button
                type="button"
                disabled={descargandoExcel}
                onClick={handleExcel}
                className="px-4 py-2 text-sm rounded-md bg-green-700 text-white hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {descargandoExcel ? 'Generando...' : 'Descargar Excel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
