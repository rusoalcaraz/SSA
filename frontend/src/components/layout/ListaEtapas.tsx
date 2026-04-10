import { useRef, useState } from 'react'
import type { EtapaProcedimiento, Procedimiento } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { etapasService } from '../../services/etapas.service'
import { mensajeDeError } from '../../services/api'
import { EstadoEtapaBadge } from '../ui/EstadoEtapaBadge'
import { Modal } from '../ui/Modal'
import { Spinner } from '../ui/Spinner'
import { EmptyState } from '../ui/EmptyState'
import { formatearFecha } from '../../utils/formato'

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
  | { tipo: 'observacion'; etapa: EtapaProcedimiento }
  | { tipo: 'historial'; etapa: EtapaProcedimiento }
  | { tipo: 'noAplica'; etapa: EtapaProcedimiento }
  | null

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

  function abrirModal(accion: AccionModal) {
    setModal(accion)
    setErrorModal(null)
    setFechaInput('')
    setMotivoInput('')
    setRespuestaInput('')
    setObservacionInput('')
    const cont = document.getElementById('app-scroll')
    scrollYRef.current = cont ? cont.scrollTop : window.scrollY
  }

  function cerrarModal() {
    if (!enviando) setModal(null)
  }

  async function ejecutar(fn: () => Promise<void>) {
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
    (procedimiento.asesorTitular?._id === usuario?.id ||
      procedimiento.asesorSuplente?._id === usuario?.id)
  const esAC = tieneRol('area_contratante', 'superadmin')
  const esSuperadmin = tieneRol('superadmin')

  if (etapas.length === 0) {
    return <EmptyState mensaje="No hay etapas registradas para este procedimiento." />
  }

  return (
    <>
      <div className="space-y-3">
        {etapas.map((etapa, idx) => {
          const puedeCompletar = (esAT || esSuperadmin) && etapa.estado !== 'completado' && !etapa.noAplica
          const puedeProponer = esAC && etapa.estado !== 'completado' && !etapa.noAplica
          const puedeResponder =
            (esAT || esSuperadmin) && etapa.estado === 'fecha_propuesta'
          const puedeSobreescribir = esAC && etapa.estado === 'fecha_rechazada'
          const puedeObservacion = (esAT || tieneRol('dgt') || esSuperadmin) && !etapa.noAplica
          const puedeNoAplica = esAC && etapa.estado !== 'completado'

          return (
            <div
              key={etapa._id}
              className={`rounded-lg border px-4 py-4 transition-colors ${
                etapa.noAplica
                  ? 'border-gray-200 bg-gray-50/60 opacity-60'
                  : etapa.estado === 'completado'
                  ? 'border-green-200 bg-green-50/40'
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
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 text-gray-600 text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-sm ${etapa.noAplica ? 'text-gray-400 line-through' : 'text-gray-900'} break-words`}>
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
                      {etapa.observaciones.length > 0 && (
                        <span className="text-blue-600">
                          {etapa.observaciones.length} observacion(es)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex gap-1.5 flex-shrink-0 flex-wrap justify-start md:justify-end w-full md:w-auto mt-3 md:mt-0 relative">
                  {puedeCompletar && (
                    <button
                      onClick={() => abrirModal({ tipo: 'completar', etapa })}
                      className="px-2.5 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                    >
                      Completar
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
                  {/* Menú móvil para acciones secundarias */}
                  {(puedeObservacion || puedeNoAplica || etapa.historialFechas.length > 0) && (
                    <div className="md:hidden">
                      <button
                        onClick={() => setMenuAcciones((m) => (m === etapa._id ? null : etapa._id))}
                        className="px-2.5 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                      >
                        Más
                      </button>
                      {menuAcciones === etapa._id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
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
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ---- Modales ---- */}

      {/* Completar */}
      {modal?.tipo === 'completar' && (
        <Modal titulo="Completar etapa" onClose={cerrarModal}>
          <p className="text-sm text-gray-600 mb-4">
            Confirma que la etapa <strong>"{modal.etapa.nombre}"</strong> ha sido completada.
          </p>
          {errorModal && <p className="text-sm text-red-600 mb-3">{errorModal}</p>}
          <div className="flex gap-3">
            <button
              onClick={() =>
                ejecutar(() => etapasService.completar(procedimiento._id, modal.etapa._id))
              }
              disabled={enviando}
              className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviando && <Spinner className="h-4 w-4 text-white" />}
              Confirmar
            </button>
            <button onClick={cerrarModal} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
              Cancelar
            </button>
          </div>
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
