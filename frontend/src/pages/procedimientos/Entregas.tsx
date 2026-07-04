import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { Procedimiento, Entrega, EvidenciaArchivo } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { entregasService, type CrearEntregaPayload, type ActualizarEntregaPayload } from '../../services/entregas.service'
import { mensajeDeError } from '../../services/api'
import { formatearFecha, formatearFechaHora } from '../../utils/formato'

interface ContextoDetalle {
  procedimiento: Procedimiento
  recargar: () => void
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------
const ESTADO_ETIQUETA: Record<Entrega['estado'], string> = {
  pendiente: 'Pendiente',
  recibida: 'Recibida',
  rechazada: 'Rechazada',
  recibida_propuesta: 'Pend. validación',
}

const ESTADO_CLASE: Record<Entrega['estado'], string> = {
  pendiente: 'bg-gray-100 text-gray-600',
  recibida: 'bg-green-100 text-green-700',
  rechazada: 'bg-red-100 text-red-700',
  recibida_propuesta: 'bg-purple-100 text-purple-800',
}

const TIPO_ETIQUETA: Record<Entrega['tipo'], string> = {
  parcial: 'Parcial',
  total: 'Total',
}

const DOC_TIPO_ETIQUETA: Record<string, string> = {
  constancia_recepcion: 'Constancia de recepcion',
  hoja_aceptacion: 'Hoja de aceptacion',
  otro: 'Otro',
}

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

// -------------------------------------------------------
// Sub-modal: crear entrega
// -------------------------------------------------------
function ModalCrearEntrega({
  procedimientoId,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<CrearEntregaPayload>({
    descripcion: '',
    tipo: 'parcial',
    fechaEstimada: '',
    observaciones: '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      const payload: CrearEntregaPayload = {
        descripcion: form.descripcion,
        tipo: form.tipo,
        ...(form.fechaEstimada ? { fechaEstimada: form.fechaEstimada } : {}),
        ...(form.observaciones ? { observaciones: form.observaciones } : {}),
      }
      await entregasService.crear(procedimientoId, payload)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Nueva entrega" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as Entrega['tipo'] }))}
          >
            <option value="parcial">Parcial</option>
            <option value="total">Total</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada</label>
          <input
            type="date"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.fechaEstimada ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, fechaEstimada: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.observaciones ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
          />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------
// Sub-modal: editar entrega
// -------------------------------------------------------
function ModalEditarEntrega({
  procedimientoId,
  entrega,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  entrega: Entrega
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState<ActualizarEntregaPayload>({
    descripcion: entrega.descripcion,
    tipo: entrega.tipo,
    fechaEstimada: entrega.fechaEstimada?.split('T')[0] ?? '',
    fechaReal: entrega.fechaReal?.split('T')[0] ?? '',
    estado: entrega.estado,
    observaciones: entrega.observaciones ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      const payload: ActualizarEntregaPayload = {
        descripcion: form.descripcion,
        tipo: form.tipo,
        estado: form.estado,
        ...(form.fechaEstimada ? { fechaEstimada: form.fechaEstimada } : {}),
        ...(form.fechaReal ? { fechaReal: form.fechaReal } : {}),
        ...(form.observaciones ? { observaciones: form.observaciones } : {}),
      }
      await entregasService.actualizar(procedimientoId, entrega._id, payload)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Editar entrega" onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
          <textarea
            rows={3}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.descripcion ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as Entrega['tipo'] }))}
            >
              <option value="parcial">Parcial</option>
              <option value="total">Total</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.estado}
              onChange={(e) =>
                setForm((f) => ({ ...f, estado: e.target.value as Entrega['estado'] }))
              }
            >
              <option value="pendiente">Pendiente</option>
              <option value="recibida">Recibida</option>
              <option value="rechazada">Rechazada</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha estimada</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.fechaEstimada ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, fechaEstimada: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha real</label>
            <input
              type="date"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.fechaReal ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, fechaReal: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observaciones</label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.observaciones ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
          />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------
// Sub-modal: subir documento a una entrega
// -------------------------------------------------------
function ModalSubirDocumento({
  procedimientoId,
  entregaId,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  entregaId: string
  onGuardado: () => void
  onClose: () => void
}) {
  const [tipo, setTipo] = useState<'constancia_recepcion' | 'hoja_aceptacion' | 'otro'>(
    'constancia_recepcion'
  )
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) {
      setErrorMsg('Selecciona un archivo PDF.')
      return
    }
    setSubiendo(true)
    setErrorMsg(null)
    try {
      await entregasService.subirDocumento(procedimientoId, entregaId, tipo, archivo)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal titulo="Subir documento" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de documento <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={tipo}
            onChange={(e) =>
              setTipo(e.target.value as 'constancia_recepcion' | 'hoja_aceptacion' | 'otro')
            }
          >
            <option value="constancia_recepcion">Constancia de recepcion</option>
            <option value="hoja_aceptacion">Hoja de aceptacion</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivo PDF <span className="text-red-500">*</span>
          </label>
          <input
            type="file"
            accept="application/pdf"
            required
            className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-900 hover:file:bg-blue-100"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={subiendo}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors"
          >
            {subiendo ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------
// Sub-modal: proponer recibida (AT) con carga de evidencia
// -------------------------------------------------------
function ModalProponerRecibida({
  procedimientoId,
  entrega,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  entrega: Entrega
  onGuardado: () => void
  onClose: () => void
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setErrorMsg(null)
    try {
      await entregasService.proponerRecibida(procedimientoId, entrega._id, archivo ?? undefined)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Proponer entrega recibida" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <p className="text-sm text-gray-600 mb-4">
          ¿Confirmas que la entrega <strong>"{entrega.descripcion}"</strong> fue recibida?
          El integrante de adquisiciones deberá validarlo.
        </p>
        <div className="flex flex-col gap-1 mb-4">
          <label className="text-sm font-medium text-gray-700">
            Cargar evidencia <span className="text-gray-400 font-normal">(PDF, opcional)</span>
          </label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-600 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200"
          />
          {archivo && <p className="text-xs text-gray-500 mt-0.5">{archivo.name}</p>}
        </div>
        {errorMsg && <p className="text-sm text-red-600 mb-3">{errorMsg}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={enviando}
            className="flex-1 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
          >
            {enviando && <Spinner className="h-4 w-4 text-white" />}
            Proponer
          </button>
          <button type="button" onClick={onClose} disabled={enviando} className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------
// Modal de validación IA
// -------------------------------------------------------
function ModalValidarEntrega({
  procedimientoId,
  entrega,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  entrega: Entrega
  onGuardado: () => void
  onClose: () => void
}) {
  const [validando, setValidando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function responder(respuesta: 'si' | 'no') {
    setValidando(true)
    setErrorMsg(null)
    try {
      await entregasService.validarEntrega(procedimientoId, entrega._id, respuesta)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setValidando(false)
    }
  }

  return (
    <Modal titulo="Validar entrega" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-1">
        El asesor técnico indicó que la entrega{' '}
        <strong className="text-gray-800">"{entrega.descripcion}"</strong> fue recibida.
      </p>
      {entrega.propuestoPor && (
        <p className="text-xs text-gray-400 mb-2">
          Propuesto por: {entrega.propuestoPor.nombre} {entrega.propuestoPor.apellidos}
        </p>
      )}
      {entrega.evidencias && entrega.evidencias.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-md">
          <p className="text-xs font-medium text-blue-700 mb-1.5">Evidencia adjunta:</p>
          <div className="flex gap-2 flex-wrap">
            {entrega.evidencias.map((ev) => (
              <button
                key={ev._id}
                type="button"
                onClick={async () => {
                  try {
                    const url = await entregasService.obtenerEvidencia(procedimientoId, entrega._id, ev._id)
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
      {errorMsg && <p className="text-sm text-red-600 mb-3">{errorMsg}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => responder('si')}
          disabled={validando}
          className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {validando && <Spinner className="h-4 w-4 text-white" />}
          Sí
        </button>
        <button
          type="button"
          onClick={() => responder('no')}
          disabled={validando}
          className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {validando && <Spinner className="h-4 w-4 text-white" />}
          No
        </button>
      </div>
    </Modal>
  )
}

function ModalSubirEvidenciaEntrega({
  procedimientoId,
  entrega,
  evidenciaOriginal,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  entrega: Entrega
  evidenciaOriginal?: EvidenciaArchivo
  onGuardado: () => void
  onClose: () => void
}) {
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!archivo) {
      setErrorMsg('Selecciona una imagen o un archivo PDF.')
      return
    }
    setSubiendo(true)
    setErrorMsg(null)
    try {
      await entregasService.subirEvidencia(procedimientoId, entrega._id, archivo, evidenciaOriginal?._id)
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal titulo={evidenciaOriginal ? 'Reemplazar evidencia' : 'Subir evidencia'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {evidenciaOriginal
            ? <>Carga la versión corregida para reemplazar el archivo rechazado de la entrega <strong>"{entrega.descripcion}"</strong>.</>
            : <>Carga una imagen o PDF como respaldo de la entrega <strong>"{entrega.descripcion}"</strong>.</>}
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Archivo <span className="text-gray-400 font-normal">(PDF o imagen)</span>
          </label>
          <input
            type="file"
            accept={ACEPTA_EVIDENCIA}
            className="w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-900 hover:file:bg-indigo-100"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
          />
        </div>
        {archivo && <p className="text-xs text-gray-500 -mt-2">{archivo.name}</p>}
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={subiendo}
            className="px-4 py-2 text-sm rounded-md bg-indigo-700 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {subiendo ? 'Subiendo...' : 'Subir evidencia'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ModalValidarEvidenciaEntrega({
  procedimientoId,
  entregaId,
  evidencia,
  onGuardado,
  onClose,
}: {
  procedimientoId: string
  entregaId: string
  evidencia: EvidenciaArchivo
  onGuardado: () => void
  onClose: () => void
}) {
  const [comentario, setComentario] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function responder(respuesta: 'aceptar' | 'rechazar') {
    if (respuesta === 'rechazar' && !comentario.trim()) {
      setErrorMsg('Debes capturar el motivo de rechazo')
      return
    }
    setGuardando(true)
    setErrorMsg(null)
    try {
      await entregasService.validarEvidencia(
        procedimientoId,
        entregaId,
        evidencia._id,
        respuesta,
        comentario.trim() || undefined
      )
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo="Validar evidencia" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-3">
        Revisa el archivo cargado y confirma si la evidencia es correcta.
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            const url = await entregasService.obtenerEvidencia(procedimientoId, entregaId, evidencia._id)
            window.open(url, '_blank')
          } catch { /* ignore */ }
        }}
        className="mb-4 inline-flex items-center gap-1 text-sm text-blue-700 underline hover:text-blue-900"
      >
        Abrir archivo: {evidencia.nombre}
      </button>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Comentario <span className="text-gray-400 font-normal">(obligatorio si rechazas)</span></label>
        <textarea
          rows={3}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
          placeholder="Observaciones de la validación..."
        />
      </div>
      {errorMsg && <p className="text-sm text-red-600 mt-3">{errorMsg}</p>}
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => responder('aceptar')}
          disabled={guardando}
          className="flex-1 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-medium rounded-md transition-colors"
        >
          {guardando ? 'Guardando...' : 'Aceptar'}
        </button>
        <button
          type="button"
          onClick={() => responder('rechazar')}
          disabled={guardando}
          className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-md transition-colors"
        >
          {guardando ? 'Guardando...' : 'Rechazar'}
        </button>
      </div>
    </Modal>
  )
}

// -------------------------------------------------------
// Fila de entrega expandible
// -------------------------------------------------------
function FilaEntrega({
  entrega,
  procedimientoId,
  puedeEditar,
  puedeSubirDoc,
  puedeProponer,
  puedeValidar,
  puedeSubirEvidencia,
  puedeValidarEvidencia,
  onActualizar,
}: {
  entrega: Entrega
  procedimientoId: string
  puedeEditar: boolean
  puedeSubirDoc: boolean
  puedeProponer: boolean
  puedeValidar: boolean
  puedeSubirEvidencia: boolean
  puedeValidarEvidencia: boolean
  onActualizar: () => void
}) {
  const [expandida, setExpandida] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [modalDocumento, setModalDocumento] = useState<string | null>(null)
  const [modalValidar, setModalValidar] = useState(false)
  const [modalProponer, setModalProponer] = useState(false)
  const [modalSubirEvidencia, setModalSubirEvidencia] = useState(false)
  const [evidenciaPorValidar, setEvidenciaPorValidar] = useState<EvidenciaArchivo | null>(null)
  const [evidenciaPorMotivo, setEvidenciaPorMotivo] = useState<EvidenciaArchivo | null>(null)
  const [evidenciaPorReemplazar, setEvidenciaPorReemplazar] = useState<EvidenciaArchivo | null>(null)

  return (
    <>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Cabecera */}
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
          onClick={() => setExpandida((v) => !v)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ESTADO_CLASE[entrega.estado]}`}
            >
              {ESTADO_ETIQUETA[entrega.estado]}
            </span>
            <span
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700"
            >
              {TIPO_ETIQUETA[entrega.tipo]}
            </span>
            <span className="text-sm text-gray-800 truncate">{entrega.descripcion}</span>
          </div>
          <div className="flex items-center gap-3 ml-3 shrink-0">
            {entrega.fechaEstimada && (
              <span className="text-xs text-gray-400">
                Est. {formatearFecha(entrega.fechaEstimada)}
              </span>
            )}
            {entrega.fechaReal && (
              <span className="text-xs text-gray-500 font-medium">
                Real: {formatearFecha(entrega.fechaReal)}
              </span>
            )}
            <span className="text-gray-400 text-xs">{expandida ? '▲' : '▼'}</span>
          </div>
        </button>

        {/* Detalle expandido */}
        {expandida && (
          <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
            {entrega.observaciones && (
              <p className="text-sm text-gray-600">{entrega.observaciones}</p>
            )}

            {/* Documentos */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Documentos ({entrega.documentos.length})
              </p>
              {entrega.documentos.length === 0 ? (
                <p className="text-xs text-gray-400">Sin documentos adjuntos.</p>
              ) : (
                <ul className="space-y-1">
                  {entrega.documentos.map((doc) => (
                    <li key={doc._id} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700">
                        {DOC_TIPO_ETIQUETA[doc.tipo] ?? doc.tipo} — {doc.nombre}
                      </span>
                      <span className="text-gray-400">{formatearFecha(doc.fechaCarga)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Evidencias */}
            {entrega.evidencias && entrega.evidencias.filter((ev) => evidenciaSigueVigente(ev, entrega.evidencias ?? [])).length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  Evidencias ({entrega.evidencias.filter((ev) => evidenciaSigueVigente(ev, entrega.evidencias ?? [])).length})
                </p>
                <div className="flex gap-2 flex-wrap">
                  {entrega.evidencias
                    .filter((ev) => evidenciaSigueVigente(ev, entrega.evidencias ?? []))
                    .map((ev) => (
                    <div key={ev._id} className="flex w-full sm:w-88 max-w-full flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const url = await entregasService.obtenerEvidencia(procedimientoId, entrega._id, ev._id)
                              window.open(url, '_blank')
                            } catch { /* ignore */ }
                          }}
                          className="inline-flex min-w-0 items-center gap-1 text-left text-xs text-blue-700 underline hover:text-blue-900"
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
                            onClick={() => setEvidenciaPorMotivo(ev)}
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
                            type="button"
                            onClick={() => setEvidenciaPorValidar(ev)}
                            className="text-xs font-medium text-emerald-700 hover:text-emerald-900"
                          >
                            Validar evidencia
                          </button>
                        )}
                        {puedeSubirEvidencia && (ev.validacionEstado ?? 'pendiente') === 'rechazada' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEvidenciaPorReemplazar(ev)
                              setModalSubirEvidencia(true)
                            }}
                            className="text-xs font-medium text-indigo-700 hover:text-indigo-900"
                          >
                            Reemplazar archivo
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex gap-2 pt-1 flex-wrap">
              {puedeProponer && entrega.estado === 'pendiente' && (
                <button
                  type="button"
                  onClick={() => setModalProponer(true)}
                  className="px-3 py-1.5 text-xs rounded border border-purple-200 text-purple-800 hover:bg-purple-50 transition-colors"
                >
                  Proponer recibida
                </button>
              )}
              {puedeValidar && entrega.estado === 'recibida_propuesta' && (
                <button
                  type="button"
                  onClick={() => setModalValidar(true)}
                  className="px-3 py-1.5 text-xs rounded border border-green-200 text-green-800 hover:bg-green-50 transition-colors"
                >
                  Validar
                </button>
              )}
              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => setModalEditar(true)}
                  className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-white transition-colors"
                >
                  Editar
                </button>
              )}
              {puedeSubirDoc && (
                <button
                  type="button"
                  onClick={() => setModalDocumento(entrega._id)}
                  className="px-3 py-1.5 text-xs rounded border border-blue-200 text-blue-800 hover:bg-blue-50 transition-colors"
                >
                  Subir documento
                </button>
              )}
              {puedeSubirEvidencia && (
                <button
                  type="button"
                  onClick={() => {
                    setEvidenciaPorReemplazar(null)
                    setModalSubirEvidencia(true)
                  }}
                  className="px-3 py-1.5 text-xs rounded border border-indigo-200 text-indigo-800 hover:bg-indigo-50 transition-colors"
                >
                  Subir evidencia
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {modalProponer && (
        <ModalProponerRecibida
          procedimientoId={procedimientoId}
          entrega={entrega}
          onGuardado={() => {
            setModalProponer(false)
            onActualizar()
          }}
          onClose={() => setModalProponer(false)}
        />
      )}
      {modalEditar && (
        <ModalEditarEntrega
          procedimientoId={procedimientoId}
          entrega={entrega}
          onGuardado={() => {
            setModalEditar(false)
            onActualizar()
          }}
          onClose={() => setModalEditar(false)}
        />
      )}
      {modalDocumento && (
        <ModalSubirDocumento
          procedimientoId={procedimientoId}
          entregaId={modalDocumento}
          onGuardado={() => {
            setModalDocumento(null)
            onActualizar()
          }}
          onClose={() => setModalDocumento(null)}
        />
      )}
      {modalValidar && (
        <ModalValidarEntrega
          procedimientoId={procedimientoId}
          entrega={entrega}
          onGuardado={() => {
            setModalValidar(false)
            onActualizar()
          }}
          onClose={() => setModalValidar(false)}
        />
      )}
      {modalSubirEvidencia && (
        <ModalSubirEvidenciaEntrega
          procedimientoId={procedimientoId}
          entrega={entrega}
          evidenciaOriginal={evidenciaPorReemplazar ?? undefined}
          onGuardado={() => {
            setModalSubirEvidencia(false)
            setEvidenciaPorReemplazar(null)
            onActualizar()
          }}
          onClose={() => {
            setModalSubirEvidencia(false)
            setEvidenciaPorReemplazar(null)
          }}
        />
      )}
      {evidenciaPorValidar && (
        <ModalValidarEvidenciaEntrega
          procedimientoId={procedimientoId}
          entregaId={entrega._id}
          evidencia={evidenciaPorValidar}
          onGuardado={() => {
            setEvidenciaPorValidar(null)
            onActualizar()
          }}
          onClose={() => setEvidenciaPorValidar(null)}
        />
      )}
      {evidenciaPorMotivo && (
        <Modal titulo="Motivo de rechazo" onClose={() => setEvidenciaPorMotivo(null)}>
          <p className="text-sm text-gray-600 mb-2">
            Esta evidencia fue rechazada durante la validación.
          </p>
          {evidenciaPorMotivo.validadoPor && (
            <p className="text-xs text-gray-500 mb-2">
              Rechazó: {nombreCompletoUsuario(evidenciaPorMotivo.validadoPor.nombre, evidenciaPorMotivo.validadoPor.apellidos)}
              {evidenciaPorMotivo.validadaEn ? ` · ${formatearFechaHora(evidenciaPorMotivo.validadaEn)}` : ''}
            </p>
          )}
          <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-3 text-sm text-rose-800">
            {evidenciaPorMotivo.comentarioValidacion ?? 'Sin motivo registrado.'}
          </div>
          <button
            onClick={() => setEvidenciaPorMotivo(null)}
            className="mt-4 w-full py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cerrar
          </button>
        </Modal>
      )}
    </>
  )
}

// -------------------------------------------------------
// Vista principal Entregas
// -------------------------------------------------------
export function Entregas() {
  const { procedimiento, recargar } = useOutletContext<ContextoDetalle>()
  const { tieneRol, usuario } = useAuth()
  const [modalCrear, setModalCrear] = useState(false)

  const puedeEditar = tieneRol('administrador', 'adquisiciones', 'subdirector')
  const puedeSubirDoc = puedeEditar
  const puedeValidar = tieneRol('administrador', 'adquisiciones', 'subdirector')
  const puedeValidarEvidencia = tieneRol('administrador', 'adquisiciones')

  const esAT =
    tieneRol('asesor_tecnico') &&
    (procedimiento.asesorTitular?._id === usuario?._id ||
      procedimiento.asesorSuplente?._id === usuario?._id)
  const puedeProponer = esAT || tieneRol('administrador')
  const puedeSubirEvidencia = esAT

  const entregas = procedimiento.entregas

  return (
    <div>
      {/* Cabecera de seccion */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">
          {entregas.length} {entregas.length === 1 ? 'entrega registrada' : 'entregas registradas'}
        </h2>
        {puedeEditar && (
          <button
            type="button"
            onClick={() => setModalCrear(true)}
            className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
          >
            Nueva entrega
          </button>
        )}
      </div>

      {/* Lista */}
      {entregas.length === 0 ? (
        <div className="py-12 text-center text-sm text-gray-400">
          Sin entregas registradas para este procedimiento.
        </div>
      ) : (
        <div className="space-y-3">
          {entregas.map((entrega) => (
            <FilaEntrega
              key={entrega._id}
              entrega={entrega}
              procedimientoId={procedimiento._id}
              puedeEditar={puedeEditar}
              puedeSubirDoc={puedeSubirDoc}
              puedeProponer={puedeProponer}
              puedeValidar={puedeValidar}
              puedeSubirEvidencia={puedeSubirEvidencia}
              puedeValidarEvidencia={puedeValidarEvidencia}
              onActualizar={recargar}
            />
          ))}
        </div>
      )}

      {modalCrear && (
        <ModalCrearEntrega
          procedimientoId={procedimiento._id}
          onGuardado={() => {
            setModalCrear(false)
            recargar()
          }}
          onClose={() => setModalCrear(false)}
        />
      )}
    </div>
  )
}
