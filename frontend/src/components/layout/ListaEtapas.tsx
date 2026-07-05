import { useRef, useState } from 'react'
import type { EtapaProcedimiento, EvidenciaArchivo, Procedimiento } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { etapasService } from '../../services/etapas.service'
import { mensajeDeError } from '../../services/api'
import { EstadoEtapaBadge } from '../ui/EstadoEtapaBadge'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { EmptyState } from '../ui/EmptyState'
import { formatearFecha, formatearFechaHora } from '../../utils/formato'

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'

interface Props {
  procedimiento: Procedimiento
  etapas: EtapaProcedimiento[]
  onActualizar: () => void
}

type AccionModal =
  | { tipo: 'proponer'; etapa: EtapaProcedimiento }
  | { tipo: 'responder'; etapa: EtapaProcedimiento }
  | { tipo: 'sobreescribir'; etapa: EtapaProcedimiento }
  | { tipo: 'completar'; etapa: EtapaProcedimiento }
  | { tipo: 'validar'; etapa: EtapaProcedimiento }
  | { tipo: 'revertir'; etapa: EtapaProcedimiento }
  | { tipo: 'subirEvidencia'; etapa: EtapaProcedimiento; evidenciaOriginal?: EvidenciaArchivo }
  | { tipo: 'validarEvidencia'; etapa: EtapaProcedimiento; evidencia: EvidenciaArchivo }
  | { tipo: 'motivoEvidencia'; evidencia: EvidenciaArchivo }
  | { tipo: 'observacion'; etapa: EtapaProcedimiento }
  | { tipo: 'historial'; etapa: EtapaProcedimiento }
  | { tipo: 'noAplica'; etapa: EtapaProcedimiento }
  | null

const ACEPTA_EVIDENCIA = 'application/pdf,image/png,image/jpeg,image/webp'

const ETIQUETA_EVIDENCIA: Record<'pendiente' | 'validada' | 'rechazada', string> = {
  pendiente: 'Pend. validación',
  validada: 'Validada',
  rechazada: 'Rechazada',
}

const CLASE_EVIDENCIA: Record<'pendiente' | 'validada' | 'rechazada', string> = {
  pendiente: 'bg-amber-100 text-amber-800',
  validada: 'bg-emerald-100 text-emerald-800',
  rechazada: 'bg-rose-100 text-rose-800',
}

function nombreCompletoUsuario(nombre?: string, apellidos?: string) {
  return [nombre, apellidos].filter(Boolean).join(' ')
}

function evidenciaSigueVigente(evidencia: EvidenciaArchivo, evidencias: EvidenciaArchivo[]) {
  return !evidencias.some((candidata) => candidata.reemplazaEvidenciaId === evidencia._id)
}

export function ListaEtapas({ procedimiento, etapas, onActualizar }: Props) {
  const { usuario, tieneRol } = useAuth()
  const [modal, setModal] = useState<AccionModal>(null)
  const [enviando, setEnviando] = useState(false)
  const [errorModal, setErrorModal] = useState<string | null>(null)
  const [menuAcciones, setMenuAcciones] = useState<string | null>(null)
  const scrollYRef = useRef<number>(0)

  // Campos de formularios dentro de modales
  const [fechaInput, setFechaInput] = useState('')
  const [motivoInput, setMotivoInput] = useState('')
  const [respuestaInput, setRespuestaInput] = useState<'aceptar' | 'rechazar' | ''>('')
  const [observacionInput, setObservacionInput] = useState('')
  const [archivoEvidencia, setArchivoEvidencia] = useState<File | null>(null)
  const [comentarioEvidencia, setComentarioEvidencia] = useState('')
  const [descargandoReporteId, setDescargandoReporteId] = useState<string | null>(null)

  function abrirModal(accion: AccionModal) {
    setModal(accion)
    setErrorModal(null)
    setFechaInput('')
    setMotivoInput('')
    setRespuestaInput('')
    setObservacionInput('')
    setArchivoEvidencia(null)
    setComentarioEvidencia('')
    const cont = document.getElementById('app-scroll')
    scrollYRef.current = cont ? cont.scrollTop : window.scrollY
  }

  function cerrarModal() {
    if (!enviando) setModal(null)
  }

  async function ejecutar<T>(fn: () => Promise<T>) {
    setErrorModal(null)
    setEnviando(true)
    try {
      await fn()
      setModal(null)
      onActualizar()
      const y = scrollYRef.current
      requestAnimationFrame(() => {
        const cont = document.getElementById('app-scroll')
        if (cont) cont.scrollTo({ top: y, behavior: 'auto' })
        else window.scrollTo({ top: y, behavior: 'auto' })
      })
    } catch (err) {
      setErrorModal(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  // Determina permisos de este usuario sobre el procedimiento
  const esAT =
    tieneRol('asesor_tecnico') &&
    (procedimiento.asesorTitular?._id === usuario?._id ||
      procedimiento.asesorSuplente?._id === usuario?._id)
  const esGestor = tieneRol('administrador', 'adquisiciones', 'subdirector')
  const esAdministrador = tieneRol('administrador')

  if (etapas.length === 0) {
    return <EmptyState mensaje="No hay etapas registradas para este procedimiento." />
  }

  // Índice de la última etapa completada (la más reciente por índice en el array)
  const ultimaCompletadaIdx = etapas.reduce<number>(
    (last, e, i) => (e.estado === 'completado' ? i : last),
    -1
  )

  return (
    <>
      <div className="space-y-3">
        {etapas.map((etapa, idx) => {
          const tieneEvidenciaBloqueante = etapa.evidencias?.some(
            (ev) =>
              evidenciaSigueVigente(ev, etapa.evidencias ?? []) &&
              (ev.validacionEstado ?? 'pendiente') !== 'validada'
          ) ?? false
          const estadosNoCompletables: string[] = ['completado', 'completado_propuesto']
          const puedeCompletar =
            (esAT || esAdministrador) &&
            !estadosNoCompletables.includes(etapa.estado) &&
            !etapa.noAplica &&
            !tieneEvidenciaBloqueante
          const puedeValidar =
            esGestor &&
            etapa.estado === 'completado_propuesto'
          const puedeProponer =
            esGestor &&
            etapa.estado !== 'completado' &&
            etapa.estado !== 'completado_propuesto' &&
            !etapa.noAplica
          const puedeResponder =
            (esAT || esAdministrador) && etapa.estado === 'fecha_propuesta'
          const puedeSobreescribir = esGestor && etapa.estado === 'fecha_rechazada'
          const puedeObservacion = (esAT || esGestor) && !etapa.noAplica
          const puedeSubirEvidencia = esAT && !etapa.noAplica
          const puedeValidarEvidencia = tieneRol('administrador', 'adquisiciones')
          const puedeNoAplica =
            esGestor &&
            etapa.estado !== 'completado' &&
            etapa.estado !== 'completado_propuesto'
          const puedeRevertir =
            tieneRol('administrador', 'adquisiciones') &&
            etapa.estado === 'completado' &&
            idx === ultimaCompletadaIdx

          return (
            <div
              key={etapa._id}
              className={`rounded-lg border px-4 py-4 transition-colors ${
                etapa.noAplica
                  ? 'border-gray-200 bg-gray-50/60 opacity-60'
                  : etapa.estado === 'completado'
                  ? 'border-green-200 bg-green-50/40'
                  : etapa.estado === 'completado_propuesto'
                  ? 'border-purple-200 bg-purple-50/40'
                  : etapa.estado === 'vencido'
                  ? 'border-red-200 bg-red-50/40'
                  : etapa.estado === 'fecha_propuesta'
                  ? 'border-yellow-200 bg-yellow-50/40'
                  : etapa.estado === 'fecha_rechazada'
                  ? 'border-orange-200 bg-orange-50/40'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex flex-col md:flex-row items-start justify-between gap-3">
                {/* Numero de orden + info */}
                <div className="flex items-start gap-3 min-w-0 w-full">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-sm ${etapa.noAplica ? 'text-gray-400 line-through' : 'text-gray-900'} wrap-break-word`}>
                        {etapa.nombre}
                      </p>
                      {etapa.noAplica ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                          No aplica
                        </span>
                      ) : (
                        <EstadoEtapaBadge estado={etapa.estado} />
                      )}
                      {!etapa.obligatoria && !etapa.noAplica && (
                        <span className="text-xs text-gray-400">(Opcional)</span>
                      )}
                    </div>

                    <div className="flex gap-3 md:gap-4 mt-1.5 text-xs text-gray-500 flex-wrap">
                      {etapa.fechaPlaneada && (
                        <span>
                          <span className="font-medium">Planeada:</span>{' '}
                          {formatearFecha(etapa.fechaPlaneada)}
                        </span>
                      )}
                      {etapa.fechaReal && (
                        <span>
                          <span className="font-medium">Real:</span>{' '}
                          {formatearFecha(etapa.fechaReal)}
                        </span>
                      )}
                      {etapa.fechaPropuesta && etapa.estado === 'fecha_propuesta' && (
                        <span className="text-yellow-700">
                          <span className="font-medium">Propuesta:</span>{' '}
                          {formatearFecha(etapa.fechaPropuesta)}
                        </span>
                      )}
                      {etapa.motivoRechazo && (
                        <span className="text-orange-700">
                          <span className="font-medium">Rechazo:</span> {etapa.motivoRechazo}
                        </span>
                      )}
                      {etapa.completadoPor && (
                        <span>
                          <span className="font-medium">Completado por:</span>{' '}
                          {etapa.completadoPor.nombre} {etapa.completadoPor.apellidos}
                        </span>
                      )}
                      {etapa.propuestoPor && etapa.estado === 'completado_propuesto' && (
                        <span>
                          <span className="font-medium">Propuso conclusión:</span>{' '}
                          {etapa.propuestoPor.nombre} {etapa.propuestoPor.apellidos}
                          {etapa.propuestoEn ? ` · ${formatearFechaHora(etapa.propuestoEn)}` : ''}
                        </span>
                      )}
                      {etapa.validadoPorConclusion && etapa.resultadoValidacionConclusion === 'aceptada' && (
                        <span className="text-green-700">
                          <span className="font-medium">Validó conclusión:</span>{' '}
                          {nombreCompletoUsuario(etapa.validadoPorConclusion.nombre, etapa.validadoPorConclusion.apellidos)}
                          {etapa.validadaEnConclusion ? ` · ${formatearFechaHora(etapa.validadaEnConclusion)}` : ''}
                        </span>
                      )}
                      {etapa.validadoPorConclusion && etapa.resultadoValidacionConclusion === 'rechazada' && (
                        <span className="text-rose-700">
                          <span className="font-medium">Rechazó conclusión:</span>{' '}
                          {nombreCompletoUsuario(etapa.validadoPorConclusion.nombre, etapa.validadoPorConclusion.apellidos)}
                          {etapa.validadaEnConclusion ? ` · ${formatearFechaHora(etapa.validadaEnConclusion)}` : ''}
                        </span>
                      )}
                      {etapa.motivoRechazoConclusion && (
                        <span className="text-rose-700">
                          <span className="font-medium">Motivo rechazo conclusión:</span> {etapa.motivoRechazoConclusion}
                        </span>
                      )}
                      {etapa.observaciones.length > 0 && (
                        <span className="text-blue-600">
                          {etapa.observaciones.length} observacion(es)
                        </span>
                      )}
                    </div>
                    {etapa.evidencias && etapa.evidencias.filter((ev) => evidenciaSigueVigente(ev, etapa.evidencias ?? [])).length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-1.5">
                        {etapa.evidencias
                          .filter((ev) => evidenciaSigueVigente(ev, etapa.evidencias ?? []))
                          .map((ev) => {

                          return (
                          <div key={ev._id} className="flex w-full sm:w-88 max-w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                              <button
                                onClick={async () => {
                                  try {
                                    const url = await etapasService.obtenerEvidencia(procedimiento._id, etapa._id, ev._id)
                                    window.open(url, '_blank')
                                  } catch { /* ignore */ }
                                }}
                                className="inline-flex min-w-0 items-center gap-1 text-left text-xs text-blue-700 hover:text-blue-900 underline"
                                title={ev.nombre}
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                </svg>
                                <span className="min-w-0 wrap-break-word sm:truncate">{ev.nombre}</span>
                              </button>
                              {(ev.validacionEstado ?? 'pendiente') === 'rechazada' ? (
                                <button
                                  type="button"
                                  onClick={() => abrirModal({ tipo: 'motivoEvidencia', evidencia: ev })}
                                  className={`inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASE_EVIDENCIA.rechazada}`}
                                >
                                  Rechazada
                                </button>
                              ) : (
                                <span
                                  className={`inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASE_EVIDENCIA[(ev.validacionEstado ?? 'pendiente') as 'pendiente' | 'validada' | 'rechazada']}`}
                                >
                                  {ETIQUETA_EVIDENCIA[(ev.validacionEstado ?? 'pendiente') as 'pendiente' | 'validada' | 'rechazada']}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                              {ev.cargadoPor && (
                                <span>
                                  <span className="font-medium">Cargó:</span>{' '}
                                  {nombreCompletoUsuario(ev.cargadoPor.nombre, ev.cargadoPor.apellidos)}
                                  {ev.cargadaEn ? ` · ${formatearFechaHora(ev.cargadaEn)}` : ''}
                                </span>
                              )}
                              {ev.validadoPor && (
                                <span>
                                  <span className="font-medium">
                                    {(ev.validacionEstado ?? 'pendiente') === 'rechazada' ? 'Rechazó:' : 'Validó:'}
                                  </span>{' '}
                                  {nombreCompletoUsuario(ev.validadoPor.nombre, ev.validadoPor.apellidos)}
                                  {ev.validadaEn ? ` · ${formatearFechaHora(ev.validadaEn)}` : ''}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {puedeValidarEvidencia && (ev.validacionEstado ?? 'pendiente') === 'pendiente' && (
                                <button
                                  onClick={() => abrirModal({ tipo: 'validarEvidencia', etapa, evidencia: ev })}
                                  className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                                >
                                  Validar evidencia
                                </button>
                              )}
                              {esAT && (ev.validacionEstado ?? 'pendiente') === 'rechazada' && (
                                <button
                                  type="button"
                                  onClick={() => abrirModal({ tipo: 'subirEvidencia', etapa, evidenciaOriginal: ev })}
                                  className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                                >
                                  Reemplazar archivo
                                </button>
                              )}
                            </div>
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-1.5 shrink-0 flex-wrap justify-start md:justify-end w-full md:w-auto mt-3 md:mt-0 relative">
                  {puedeCompletar && (
                    <button
                      onClick={() => abrirModal({ tipo: 'completar', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded transition-colors"
                    >
                      Proponer conclusión
                    </button>
                  )}
                  {puedeValidar && (
                    <button
                      onClick={() => abrirModal({ tipo: 'validar', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                    >
                      Validar
                    </button>
                  )}
                  {puedeRevertir && (
                    <button
                      onClick={() => abrirModal({ tipo: 'revertir', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-100 hover:bg-rose-200 rounded transition-colors"
                    >
                      Revertir conclusión
                    </button>
                  )}
                  {puedeProponer && (
                    <button
                      onClick={() => abrirModal({ tipo: 'proponer', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                    >
                      Proponer fecha
                    </button>
                  )}
                  {puedeResponder && (
                    <button
                      onClick={() => abrirModal({ tipo: 'responder', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded transition-colors"
                    >
                      Responder
                    </button>
                  )}
                  {puedeSobreescribir && (
                    <button
                      onClick={() => abrirModal({ tipo: 'sobreescribir', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded transition-colors"
                    >
                      Sobreescribir
                    </button>
                  )}
                  {puedeObservacion && (
                    <button
                      onClick={() => abrirModal({ tipo: 'observacion', etapa })}
                      className="hidden md:inline-flex px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      + Observacion
                    </button>
                  )}
                  {puedeSubirEvidencia && (
                    <button
                      onClick={() => abrirModal({ tipo: 'subirEvidencia', etapa })}
                      className="hidden md:inline-flex px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-100 hover:bg-indigo-200 rounded transition-colors"
                    >
                      Subir evidencia
                    </button>
                  )}
                  {puedeNoAplica && (
                    <button
                      onClick={() => abrirModal({ tipo: 'noAplica', etapa })}
                      className={`hidden md:inline-flex px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                        etapa.noAplica
                          ? 'text-gray-600 bg-gray-200 hover:bg-gray-300'
                          : 'text-gray-500 bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {etapa.noAplica ? 'Reactivar' : 'No aplica'}
                    </button>
                  )}
                  {etapa.historialFechas.length > 0 && (
                    <button
                      onClick={() => abrirModal({ tipo: 'historial', etapa })}
                      className="hidden md:inline-flex px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Historial
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      if (descargandoReporteId === etapa._id) return
                      setDescargandoReporteId(etapa._id)
                      try {
                        await etapasService.descargarReporte(
                          procedimiento._id,
                          etapa._id,
                          `SSA-${procedimiento.numeroProcedimiento || procedimiento._id}-etapa-${idx + 1}.pdf`
                        )
                      } finally {
                        setDescargandoReporteId(null)
                      }
                    }}
                    className="hidden md:inline-flex px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                  >
                    {descargandoReporteId === etapa._id ? 'Generando...' : 'Descargar reporte'}
                  </button>
                  {/* Menú móvil para acciones secundarias */}
                  <div className="md:hidden">
                    <button
                      onClick={() => setMenuAcciones((m) => (m === etapa._id ? null : etapa._id))}
                      className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      Más
                    </button>
                    {menuAcciones === etapa._id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                        <div className="py-1">
                          {puedeObservacion && (
                            <button
                              onClick={() => {
                                setMenuAcciones(null)
                                abrirModal({ tipo: 'observacion', etapa })
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              + Observacion
                            </button>
                          )}
                          {puedeSubirEvidencia && (
                            <button
                              onClick={() => {
                                setMenuAcciones(null)
                                abrirModal({ tipo: 'subirEvidencia', etapa })
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Subir evidencia
                            </button>
                          )}
                          {puedeNoAplica && (
                            <button
                              onClick={() => {
                                setMenuAcciones(null)
                                abrirModal({ tipo: 'noAplica', etapa })
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              {etapa.noAplica ? 'Reactivar' : 'No aplica'}
                            </button>
                          )}
                          {etapa.historialFechas.length > 0 && (
                            <button
                              onClick={() => {
                                setMenuAcciones(null)
                                abrirModal({ tipo: 'historial', etapa })
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Historial
                            </button>
                          )}
                          {puedeRevertir && (
                            <button
                              onClick={() => {
                                setMenuAcciones(null)
                                abrirModal({ tipo: 'revertir', etapa })
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                            >
                              Revertir conclusión
                            </button>
                          )}
                          <button
                            onClick={async () => {
                              setMenuAcciones(null)
                              if (descargandoReporteId === etapa._id) return
                              setDescargandoReporteId(etapa._id)
                              try {
                                await etapasService.descargarReporte(
                                  procedimiento._id,
                                  etapa._id,
                                  `SSA-${procedimiento.numeroProcedimiento || procedimiento._id}-etapa-${idx + 1}.pdf`
                                )
                              } finally {
                                setDescargandoReporteId(null)
                              }
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {descargandoReporteId === etapa._id ? 'Generando reporte...' : 'Descargar reporte'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- Modales ---- */}

      {/* Proponer conclusión (AT) */}
      {modal?.tipo === 'completar' && (
        <Modal titulo="Proponer conclusión de etapa" onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-4">
            ¿Confirmas que la etapa <strong>"{modal.etapa.nombre}"</strong> ha sido concluida?
            El integrante de adquisiciones deberá validar esta acción antes de que se refleje como completada.
          </p>
          <p className="text-xs text-gray-500 mb-4">
            La conclusión solo se puede proponer cuando no hay evidencia o toda la evidencia de la etapa ya fue validada.
          </p>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => ejecutar(() => etapasService.completar(procedimiento._id, modal.etapa._id))}
              disabled={enviando}
              className="flex-1 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Proponer
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Validar conclusión (IA) */}
      {modal?.tipo === 'validar' && (
        <Modal titulo="Validar conclusión de etapa" onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-1">
            El asesor técnico indicó que la etapa{' '}
            <strong>"{modal.etapa.nombre}"</strong> ha concluido.
          </p>
          {modal.etapa.propuestoPor && (
            <p className="text-xs text-gray-400 mb-2">
              Propuesto por: {modal.etapa.propuestoPor.nombre} {modal.etapa.propuestoPor.apellidos}
            </p>
          )}
          {modal.etapa.evidencias && modal.etapa.evidencias.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-md">
              <p className="text-xs font-medium text-blue-700 mb-1.5">Evidencia adjunta:</p>
              <div className="flex gap-2 flex-wrap">
                {modal.etapa.evidencias.map((ev) => (
                  <button
                    key={ev._id}
                    onClick={async () => {
                      try {
                        const url = await etapasService.obtenerEvidencia(procedimiento._id, modal.etapa._id, ev._id)
                        window.open(url, '_blank')
                      } catch { /* ignore */ }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-blue-700 underline hover:text-blue-900"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                    </svg>
                    {ev.nombre}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-sm font-medium text-gray-800 mb-3">¿Se concluyó con la actividad?</p>
          <div className="flex flex-col gap-1 mb-4">
            <label className="text-sm font-medium text-gray-700">
              Observaciones <span className="text-gray-400 font-normal">(obligatorias si rechazas)</span>
            </label>
            <textarea
              rows={3}
              value={motivoInput}
              onChange={(e) => setMotivoInput(e.target.value)}
              className={INPUT}
              placeholder="Motivo del rechazo o comentarios de validación..."
            />
          </div>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() => etapasService.validarCompletado(procedimiento._id, modal.etapa._id, 'si'))
              }
              disabled={enviando}
              className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Sí
            </button>
            <button
              onClick={() =>
                !motivoInput.trim()
                  ? setErrorModal('Debes capturar el motivo de rechazo')
                  : ejecutar(() => etapasService.validarCompletado(
                    procedimiento._id,
                    modal.etapa._id,
                    'no',
                    motivoInput.trim()
                  ))
              }
              disabled={enviando}
              className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              No
            </button>
          </div>
        </Modal>
      )}

      {modal?.tipo === 'subirEvidencia' && (
        <Modal titulo={modal.evidenciaOriginal ? 'Reemplazar evidencia de etapa' : 'Subir evidencia de etapa'} onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-4">
            {modal.evidenciaOriginal
              ? <>Carga la versión corregida para reemplazar el archivo rechazado de la etapa <strong>"{modal.etapa.nombre}"</strong>.</>
              : <>Carga una imagen o PDF como respaldo de la etapa <strong>"{modal.etapa.nombre}"</strong>.</>}
          </p>
          <div className="flex flex-col gap-1 mb-4">
            <label className="text-sm font-medium text-gray-700">
              Archivo <span className="text-gray-400 font-normal">(PDF o imagen)</span>
            </label>
            <input
              type="file"
              accept={ACEPTA_EVIDENCIA}
              onChange={(e) => setArchivoEvidencia(e.target.files?.[0] ?? null)}
              className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-indigo-100 file:text-indigo-700 hover:file:bg-indigo-200"
            />
            {archivoEvidencia && <p className="text-xs text-gray-500 mt-0.5">{archivoEvidencia.name}</p>}
          </div>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                archivoEvidencia
                  ? ejecutar(() => etapasService.subirEvidencia(
                    procedimiento._id,
                    modal.etapa._id,
                    archivoEvidencia,
                    modal.evidenciaOriginal?._id
                  ))
                  : setErrorModal('Selecciona una imagen o un archivo PDF')
              }
              disabled={enviando}
              className="flex-1 py-2 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Subir
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {modal?.tipo === 'validarEvidencia' && (
        <Modal titulo="Validar evidencia" onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-2">
            Revisa la evidencia cargada para la etapa <strong>"{modal.etapa.nombre}"</strong>.
          </p>
          <button
            type="button"
            onClick={async () => {
              try {
                const url = await etapasService.obtenerEvidencia(procedimiento._id, modal.etapa._id, modal.evidencia._id)
                window.open(url, '_blank')
              } catch { /* ignore */ }
            }}
            className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 underline hover:text-blue-900"
          >
            Abrir archivo: {modal.evidencia.nombre}
          </button>
          <div className="flex flex-col gap-1 mb-4">
            <label className="text-sm font-medium text-gray-700">Comentario <span className="text-gray-400 font-normal">(obligatorio si rechazas)</span></label>
            <textarea
              rows={3}
              value={comentarioEvidencia}
              onChange={(e) => setComentarioEvidencia(e.target.value)}
              className={INPUT}
              placeholder="Observaciones de la validación..."
            />
          </div>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() =>
                  etapasService.validarEvidencia(
                    procedimiento._id,
                    modal.etapa._id,
                    modal.evidencia._id,
                    'aceptar',
                    comentarioEvidencia || undefined
                  )
                )
              }
              disabled={enviando}
              className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Aceptar
            </button>
            <button
              onClick={() =>
                !comentarioEvidencia.trim()
                  ? setErrorModal('Debes capturar el motivo de rechazo')
                  : ejecutar(() =>
                    etapasService.validarEvidencia(
                      procedimiento._id,
                      modal.etapa._id,
                      modal.evidencia._id,
                      'rechazar',
                      comentarioEvidencia.trim()
                    )
                  )
              }
              disabled={enviando}
              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Rechazar
            </button>
          </div>
        </Modal>
      )}

      {modal?.tipo === 'motivoEvidencia' && (
        <Modal titulo="Motivo de rechazo" onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-2">
            Esta evidencia fue rechazada durante la validación.
          </p>
          {modal.evidencia.validadoPor && (
            <p className="text-xs text-gray-500 mb-2">
              Rechazó: {nombreCompletoUsuario(modal.evidencia.validadoPor.nombre, modal.evidencia.validadoPor.apellidos)}
              {modal.evidencia.validadaEn ? ` · ${formatearFechaHora(modal.evidencia.validadaEn)}` : ''}
            </p>
          )}
          <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-3 text-sm text-rose-800">
            {modal.evidencia.comentarioValidacion ?? 'Sin motivo registrado.'}
          </div>
          <button onClick={cerrarModal} className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cerrar
          </button>
        </Modal>
      )}

      {/* Proponer fecha */}
      {modal?.tipo === 'proponer' && (
        <Modal titulo="Proponer nueva fecha" onClose={cerrarModal}>
          <div className="space-y-3 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Nueva fecha</label>
              <input
                type="date"
                value={fechaInput}
                onChange={(e) => setFechaInput(e.target.value)}
                className={INPUT}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Motivo (opcional)</label>
              <textarea
                rows={2}
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                className={INPUT}
                placeholder="Razon del cambio de fecha..."
              />
            </div>
          </div>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() =>
                  etapasService.proponerFecha(
                    procedimiento._id,
                    modal.etapa._id,
                    fechaInput,
                    motivoInput || undefined
                  )
                )
              }
              disabled={enviando || !fechaInput}
              className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Proponer
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Responder fecha */}
      {modal?.tipo === 'responder' && (
        <Modal titulo="Responder propuesta de fecha" onClose={cerrarModal}>
          <p className="text-sm text-gray-500 mb-3">
            Fecha propuesta:{' '}
            <strong>
              {modal.etapa.fechaPropuesta ? formatearFecha(modal.etapa.fechaPropuesta) : '—'}
            </strong>
          </p>
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setRespuestaInput('aceptar')}
              className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                respuestaInput === 'aceptar'
                  ? 'bg-green-700 text-white border-green-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Aceptar
            </button>
            <button
              onClick={() => setRespuestaInput('rechazar')}
              className={`flex-1 py-2 text-sm font-medium rounded-md border transition-colors ${
                respuestaInput === 'rechazar'
                  ? 'bg-red-600 text-white border-red-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Rechazar
            </button>
          </div>
          {respuestaInput === 'rechazar' && (
            <div className="flex flex-col gap-1 mb-3">
              <label className="text-sm font-medium text-gray-700">Motivo de rechazo<span className="text-red-500">*</span></label>
              <textarea
                rows={2}
                value={motivoInput}
                onChange={(e) => setMotivoInput(e.target.value)}
                className={INPUT}
                placeholder="Explique el motivo..."
              />
            </div>
          )}
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <button
            onClick={() =>
              ejecutar(() =>
                etapasService.responderFecha(
                  procedimiento._id,
                  modal.etapa._id,
                  respuestaInput as 'aceptar' | 'rechazar',
                  respuestaInput === 'rechazar' ? motivoInput : undefined
                )
              )
            }
            disabled={
              enviando ||
              !respuestaInput ||
              (respuestaInput === 'rechazar' && !motivoInput)
            }
            className="w-full py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
          >
            {enviando && <Spinner className="h-4 w-4 text-white" />}
            Confirmar respuesta
          </button>
        </Modal>
      )}

      {/* Sobreescribir fecha */}
      {modal?.tipo === 'sobreescribir' && (
        <Modal titulo="Sobreescribir fecha" onClose={cerrarModal}>
          <p className="text-sm text-gray-500 mb-3">
            El AT rechazo la propuesta de fecha. Puede establecer una nueva fecha definitiva.
          </p>
          <div className="space-y-3 mb-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Nueva fecha<span className="text-red-500">*</span></label>
              <input
                type="date"
                value={fechaInput}
                onChange={(e) => setFechaInput(e.target.value)}
                className={INPUT}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Motivo (opcional)</label>
              <textarea rows={2} value={motivoInput} onChange={(e) => setMotivoInput(e.target.value)} className={INPUT} />
            </div>
          </div>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() =>
                  etapasService.sobreescribirFecha(
                    procedimiento._id,
                    modal.etapa._id,
                    fechaInput,
                    motivoInput || undefined
                  )
                )
              }
              disabled={enviando || !fechaInput}
              className="flex-1 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-orange-300 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Sobreescribir
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Agregar observacion */}
      {modal?.tipo === 'observacion' && (
        <Modal titulo="Agregar observacion" onClose={cerrarModal}>
          <div className="flex flex-col gap-1 mb-4">
            <label className="text-sm font-medium text-gray-700">Observacion<span className="text-red-500">*</span></label>
            <textarea
              rows={3}
              value={observacionInput}
              onChange={(e) => setObservacionInput(e.target.value)}
              className={INPUT}
              placeholder="Escriba su observacion..."
              autoFocus
            />
          </div>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() =>
                  etapasService.agregarObservacion(
                    procedimiento._id,
                    modal.etapa._id,
                    observacionInput
                  )
                )
              }
              disabled={enviando || !observacionInput.trim()}
              className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Guardar
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Revertir conclusión */}
      {modal?.tipo === 'revertir' && (
        <Modal titulo="Revertir conclusión de etapa" onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-3">
            ¿Confirmas que deseas revertir la conclusión de la etapa{' '}
            <strong>"{modal.etapa.nombre}"</strong>?
          </p>
          <p className="text-xs text-gray-500 mb-4">
            La etapa volverá al estado <strong>activo</strong>. Si el procedimiento había avanzado
            de sección por haberse completado todas sus etapas, también se revertirá ese avance.
          </p>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() => etapasService.revertirCompletado(procedimiento._id, modal.etapa._id))
              }
              disabled={enviando}
              className="flex-1 py-2 bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Revertir
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* No aplica / Reactivar */}
      {modal?.tipo === 'noAplica' && (
        <Modal
          titulo={modal.etapa.noAplica ? 'Reactivar etapa' : 'Marcar como "No aplica"'}
          onClose={cerrarModal}
        >
          <p className="text-sm text-gray-600 mb-4">
            {modal.etapa.noAplica ? (
              <>
                ¿Deseas reactivar la etapa <strong>"{modal.etapa.nombre}"</strong>? Volvera a su estado pendiente.
              </>
            ) : (
              <>
                ¿Confirmas que la etapa <strong>"{modal.etapa.nombre}"</strong> no aplica para este procedimiento? Se
                omitira del flujo sin bloquear las siguientes etapas.
              </>
            )}
          </p>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() =>
                  etapasService.marcarNoAplica(procedimiento._id, modal.etapa._id, !modal.etapa.noAplica)
                )
              }
              disabled={enviando}
              className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-400 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              {modal.etapa.noAplica ? 'Reactivar' : 'Confirmar'}
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
        </Modal>
      )}

      {/* Historial de fechas */}
      {modal?.tipo === 'historial' && (
        <Modal titulo={`Historial — ${modal.etapa.nombre}`} onClose={cerrarModal} className="max-w-lg">
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {modal.etapa.historialFechas.map((h, i) => (
              <div key={i} className="text-sm border-l-2 border-gray-200 pl-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold uppercase ${
                      h.accion === 'aceptada'
                        ? 'text-green-700'
                        : h.accion === 'rechazada'
                        ? 'text-red-600'
                        : h.accion === 'sobreescrita'
                        ? 'text-orange-600'
                        : 'text-blue-700'
                    }`}
                  >
                    {h.accion}
                  </span>
                  <span className="text-gray-400 text-xs">{formatearFecha(h.timestamp)}</span>
                </div>
                {h.fechaNueva && (
                  <p className="text-gray-600 mt-0.5">
                    Fecha: {formatearFecha(h.fechaNueva)}
                  </p>
                )}
                {h.motivo && <p className="text-gray-500 mt-0.5">{h.motivo}</p>}
                {h.realizadoPor && (
                  <p className="text-gray-400 text-xs mt-0.5">
                    Por: {(h.realizadoPor as any).nombre ?? ''} {(h.realizadoPor as any).apellidos ?? ''}
                  </p>
                )}
              </div>
            ))}
          </div>
          <button onClick={cerrarModal} className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cerrar
          </button>
        </Modal>
      )}
    </>
  )
}
