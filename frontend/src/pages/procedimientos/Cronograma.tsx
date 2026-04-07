import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ListaEtapas } from '../../components/layout/ListaEtapas'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { procedimientosService } from '../../services/procedimientos.service'
import { mensajeDeError } from '../../services/api'
import { useAuth } from '../../hooks/useAuth'
import type { Procedimiento, InfoCronograma } from '../../types'

interface ContextoDetalle {
  procedimiento: Procedimiento
  recargar: () => void
}

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

function campoVacio(val: string | number | boolean | null | undefined): boolean {
  return val === undefined || val === null || val === ''
}

function Campo({ label, valor }: { label: string; valor?: string | number | boolean | null }) {
  const vacio = campoVacio(valor)
  const texto =
    typeof valor === 'boolean'
      ? valor
        ? 'Sí'
        : 'No'
      : vacio
      ? '—'
      : String(valor)
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm mt-0.5 ${vacio ? 'text-gray-300 italic' : 'text-gray-800 font-medium'}`}>{texto}</p>
    </div>
  )
}

export function Cronograma() {
  const { procedimiento, recargar } = useOutletContext<ContextoDetalle>()
  const { tieneRol } = useAuth()

  const info = procedimiento.infoCronograma ?? {}
  const [modalAbierto, setModalAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado del formulario
  const [form, setForm] = useState<InfoCronograma>({})

  function abrirModal() {
    setForm({ ...info })
    setError(null)
    setModalAbierto(true)
  }

  function cerrarModal() {
    if (!enviando) setModalAbierto(false)
  }

  function set(campo: keyof InfoCronograma, valor: string | number | boolean | null) {
    setForm((prev) => ({ ...prev, [campo]: valor }))
  }

  async function guardar() {
    setError(null)
    setEnviando(true)
    try {
      await procedimientosService.actualizarInfoCronograma(procedimiento._id, form)
      recargar()
      setModalAbierto(false)
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  const puedeEditar = tieneRol('superadmin', 'area_contratante', 'asesor_tecnico')

  const tieneInfo = Object.values(info).some((v) => !campoVacio(v))

  return (
    <div className="space-y-5">
      {/* Panel de información de cabecera */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-100 bg-blue-50">
          <h3 className="text-sm font-semibold text-blue-900">Datos generales del cronograma</h3>
          {puedeEditar && (
            <button
              onClick={abrirModal}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors"
            >
              {tieneInfo ? 'Editar' : '+ Capturar datos'}
            </button>
          )}
        </div>

        {tieneInfo ? (
          <div className="px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            <Campo label="Organismo" valor={info.organismo} />
            <Campo label="Fecha" valor={info.fecha ? new Date(info.fecha).toLocaleDateString('es-MX') : undefined} />
            <Campo label="Asesor tecnico" valor={info.asesorTecnico} />
            <Campo label="Fuente de financiamiento" valor={info.fuenteFinanciamiento} />
            <Campo label="Telefono celular" valor={info.telefonoCelular} />
            <Campo label="Extension satelital" valor={info.extensionSatelital} />
            <Campo label="Nombre del procedimiento" valor={info.nombreProcedimientoContratacion} />
            <Campo label="No. de partidas" valor={info.numeroPartidas} />
            <Campo label="No. de articulos" valor={info.numeroArticulos} />
            <Campo label="Capitulo de gasto" valor={info.capituloGasto} />
            <Campo label="Requiere anualidad" valor={info.requiereAnualidad} />
            <Campo label="No. oficio plurianualidad" valor={info.numeroOficioPlurianualidad} />
            <Campo label="Clave de cartera" valor={info.claveCartera} />
            <Campo label="No. de clave de cartera" valor={info.numeroClaveCartera} />
          </div>
        ) : (
          <p className="px-4 py-5 text-sm text-gray-400 italic">
            {puedeEditar
              ? 'Aun no se han capturado los datos generales. Haz clic en "+ Capturar datos" para comenzar.'
              : 'Los datos generales aun no han sido capturados.'}
          </p>
        )}
      </div>

      {/* Lista de etapas */}
      <ListaEtapas
        procedimiento={procedimiento}
        etapas={procedimiento.cronograma}
        onActualizar={recargar}
      />

      {/* Modal de edicion */}
      {modalAbierto && (
        <Modal titulo="Datos generales del cronograma" onClose={cerrarModal} className="max-w-2xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Organismo</label>
              <input className={INPUT} value={form.organismo ?? ''} onChange={(e) => set('organismo', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Fecha</label>
              <input
                type="date"
                className={INPUT}
                value={form.fecha ? form.fecha.split('T')[0] : ''}
                onChange={(e) => set('fecha', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Asesor tecnico</label>
              <input className={INPUT} value={form.asesorTecnico ?? ''} onChange={(e) => set('asesorTecnico', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Fuente de financiamiento</label>
              <input className={INPUT} value={form.fuenteFinanciamiento ?? ''} onChange={(e) => set('fuenteFinanciamiento', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Telefono celular (asesor tecnico)</label>
              <input className={INPUT} value={form.telefonoCelular ?? ''} onChange={(e) => set('telefonoCelular', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Extension satelital</label>
              <input className={INPUT} value={form.extensionSatelital ?? ''} onChange={(e) => set('extensionSatelital', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Nombre del procedimiento de contratacion</label>
              <input className={INPUT} value={form.nombreProcedimientoContratacion ?? ''} onChange={(e) => set('nombreProcedimientoContratacion', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>No. de partidas</label>
              <input
                type="number"
                min={0}
                className={INPUT}
                value={form.numeroPartidas ?? ''}
                onChange={(e) => set('numeroPartidas', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>No. de articulos</label>
              <input
                type="number"
                min={0}
                className={INPUT}
                value={form.numeroArticulos ?? ''}
                onChange={(e) => set('numeroArticulos', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>Capitulo de gasto</label>
              <input className={INPUT} value={form.capituloGasto ?? ''} onChange={(e) => set('capituloGasto', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Requiere anualidad</label>
              <select
                className={INPUT}
                value={form.requiereAnualidad === true ? 'si' : form.requiereAnualidad === false ? 'no' : ''}
                onChange={(e) =>
                  set('requiereAnualidad', e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)
                }
              >
                <option value="">— Seleccionar —</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>No. de oficio autorizando la plurianualidad (o "NO APLICA")</label>
              <input
                className={INPUT}
                placeholder="Ej. DN-123/2026 o NO APLICA"
                value={form.numeroOficioPlurianualidad ?? ''}
                onChange={(e) => set('numeroOficioPlurianualidad', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Clave de cartera</label>
              <input className={INPUT} value={form.claveCartera ?? ''} onChange={(e) => set('claveCartera', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>No. de clave de cartera</label>
              <input className={INPUT} value={form.numeroClaveCartera ?? ''} onChange={(e) => set('numeroClaveCartera', e.target.value)} />
            </div>
          </div>

          {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

          <div className="flex gap-3 mt-5">
            <button
              onClick={guardar}
              disabled={enviando}
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
    </div>
  )
}
