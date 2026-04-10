import { useState, useEffect } from 'react'
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { procedimientosService } from '../../services/procedimientos.service'
import { mensajeDeError } from '../../services/api'
import type { Procedimiento, InfoCronograma } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { ETIQUETA_ETAPA } from '../../utils/formato'

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500'
const LABEL = 'block text-xs font-medium text-gray-600 mb-1'

function campoVacio(val: string | number | boolean | null | undefined): boolean {
  return val === undefined || val === null || val === ''
}

function CampoInfo({ label, valor }: { label: string; valor?: string | number | boolean | null }) {
  const vacio = campoVacio(valor)
  const texto =
    typeof valor === 'boolean'
      ? valor ? 'Sí' : 'No'
      : vacio ? '—' : String(valor)
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-sm mt-0.5 ${vacio ? 'text-gray-300 italic' : 'text-gray-800 font-medium'}`}>{texto}</p>
    </div>
  )
}

// El procedimiento se pasa por contexto a las tabs hijas via outlet context
export function DetalleProcedimiento() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { tieneRol } = useAuth()

  const [procedimiento, setProcedimiento] = useState<Procedimiento | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [contador, setContador] = useState(0)

  const recargar = () => setContador((c) => c + 1)

  // Modal edición datos generales
  const [modalInfo, setModalInfo] = useState(false)
  const [formInfo, setFormInfo] = useState<InfoCronograma>({})
  const [enviandoInfo, setEnviandoInfo] = useState(false)
  const [errorInfo, setErrorInfo] = useState<string | null>(null)

  function abrirModalInfo() {
    setFormInfo({ ...(procedimiento?.infoCronograma ?? {}) })
    setErrorInfo(null)
    setModalInfo(true)
  }

  function setInfoField(campo: keyof InfoCronograma, valor: string | number | boolean | null) {
    setFormInfo((prev) => ({ ...prev, [campo]: valor }))
  }

  async function guardarInfo() {
    if (!procedimiento) return
    setErrorInfo(null)
    setEnviandoInfo(true)
    try {
      await procedimientosService.actualizarInfoCronograma(procedimiento._id, formInfo)
      recargar()
      setModalInfo(false)
    } catch (err) {
      setErrorInfo(mensajeDeError(err))
    } finally {
      setEnviandoInfo(false)
    }
  }

  useEffect(() => {
    if (!id) return
    setCargando(true)
    procedimientosService
      .obtener(id)
      .then(setProcedimiento)
      .catch(() => setError('No se pudo cargar el procedimiento.'))
      .finally(() => setCargando(false))
  }, [id, contador])

  if (cargando) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-blue-900" />
      </div>
    )
  }

  if (error || !procedimiento) {
    return (
      <div className="py-10 text-center text-sm text-red-600">
        {error ?? 'Procedimiento no encontrado.'}
      </div>
    )
  }

  const puedeEditarInfo = tieneRol('superadmin', 'area_contratante', 'asesor_tecnico')
  const puedeVerCronograma = tieneRol('superadmin', 'area_contratante', 'asesor_tecnico', 'dgt', 'gerencial')
  const puedeVerHoja = puedeVerCronograma
  const puedeVerEntregas = tieneRol('superadmin', 'area_contratante', 'asesor_tecnico', 'dgt', 'gerencial', 'inspeccion')

  const tabs = [
    puedeVerCronograma && { to: 'cronograma', label: `Cronograma (${procedimiento.cronograma.length})` },
    puedeVerHoja && { to: 'hoja-trabajo', label: `Hoja de Trabajo (${procedimiento.hojaDeTrabajoEtapas.length})` },
    puedeVerEntregas && { to: 'entregas', label: `Entregas (${procedimiento.entregas.length})` },
  ].filter(Boolean) as { to: string; label: string }[]

  const TAB = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
  const TAB_ACTIVO = 'border-blue-900 text-blue-900'
  const TAB_INACTIVO = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

  return (
    <div>
      {/* Boton volver */}
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1 transition-colors"
      >
        ← Volver
      </button>

      {/* Header del procedimiento */}
      <div className="bg-white rounded-lg border border-gray-200 px-6 py-5 mb-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {procedimiento.urgente && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">
                  TIEMPOS REDUCIDOS
                </span>
              )}
              <span className="text-xs text-gray-400 font-mono">
                {procedimiento.numeroProcedimiento ?? 'Sin numero'}
              </span>
              <Badge etapa={procedimiento.etapaActual}>
                {ETIQUETA_ETAPA[procedimiento.etapaActual]}
              </Badge>
            </div>
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{procedimiento.titulo}</h1>
            {procedimiento.descripcion && (
              <p className="text-sm text-gray-500 mt-1">{procedimiento.descripcion}</p>
            )}
          </div>
          {puedeEditarInfo && (
            <button
              onClick={abrirModalInfo}
              className="text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors shrink-0"
            >
              {Object.values(procedimiento.infoCronograma ?? {}).some((v) => !campoVacio(v))
                ? 'Editar datos'
                : '+ Capturar datos'}
            </button>
          )}
        </div>

        {/* Datos generales del cronograma */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {(() => {
            const info = procedimiento.infoCronograma ?? {}
            return (
              <>
                <CampoInfo label="Organismo" valor={info.organismo} />
                <CampoInfo label="Fecha" valor={info.fecha ? new Date(info.fecha).toLocaleDateString('es-MX') : undefined} />
                <CampoInfo label="Asesor tecnico" valor={info.asesorTecnico} />
                <CampoInfo label="Fuente de financiamiento" valor={info.fuenteFinanciamiento} />
                <CampoInfo label="Telefono celular" valor={info.telefonoCelular} />
                <CampoInfo label="Extension satelital" valor={info.extensionSatelital} />
                <CampoInfo label="Nombre del procedimiento" valor={info.nombreProcedimientoContratacion} />
                <CampoInfo label="No. de partidas" valor={info.numeroPartidas} />
                <CampoInfo label="No. de articulos" valor={info.numeroArticulos} />
                <CampoInfo label="Capitulo de gasto" valor={info.capituloGasto} />
                <CampoInfo label="Requiere anualidad" valor={info.requiereAnualidad} />
                <CampoInfo label="No. oficio plurianualidad" valor={info.numeroOficioPlurianualidad} />
                <CampoInfo label="Clave de cartera" valor={info.claveCartera} />
                <CampoInfo label="No. de clave de cartera" valor={info.numeroClaveCartera} />
                <CampoInfo label="Tiempos reducidos" valor={procedimiento.urgente} />
              </>
            )
          })()}
        </div>

        {/* Justificacion de tiempos reducidos */}
        {procedimiento.urgente && procedimiento.justificacionUrgencia && (
          <div className="mt-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            <span className="font-medium">Justificacion de tiempos reducidos: </span>
            {procedimiento.justificacionUrgencia}
          </div>
        )}
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 px-2 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `${TAB} ${isActive ? TAB_ACTIVO : TAB_INACTIVO}`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </div>
          <div className="p-5">
            <Outlet context={{ procedimiento, recargar }} />
          </div>
        </div>
      )}

      {/* Modal edición datos generales del cronograma */}
      {modalInfo && (
        <Modal titulo="Datos generales del cronograma" onClose={() => !enviandoInfo && setModalInfo(false)} className="max-w-2xl">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>Organismo</label>
              <input className={INPUT} value={formInfo.organismo ?? ''} onChange={(e) => setInfoField('organismo', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Fecha</label>
              <input
                type="date"
                className={INPUT}
                value={formInfo.fecha ? formInfo.fecha.split('T')[0] : ''}
                onChange={(e) => setInfoField('fecha', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Asesor tecnico</label>
              <input className={INPUT} value={formInfo.asesorTecnico ?? ''} onChange={(e) => setInfoField('asesorTecnico', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Fuente de financiamiento</label>
              <input className={INPUT} value={formInfo.fuenteFinanciamiento ?? ''} onChange={(e) => setInfoField('fuenteFinanciamiento', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Telefono celular (asesor tecnico)</label>
              <input className={INPUT} value={formInfo.telefonoCelular ?? ''} onChange={(e) => setInfoField('telefonoCelular', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Extension satelital</label>
              <input className={INPUT} value={formInfo.extensionSatelital ?? ''} onChange={(e) => setInfoField('extensionSatelital', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Nombre del procedimiento de contratacion</label>
              <input className={INPUT} value={formInfo.nombreProcedimientoContratacion ?? ''} onChange={(e) => setInfoField('nombreProcedimientoContratacion', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>No. de partidas</label>
              <input
                type="number"
                min={0}
                className={INPUT}
                value={formInfo.numeroPartidas ?? ''}
                onChange={(e) => setInfoField('numeroPartidas', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>No. de articulos</label>
              <input
                type="number"
                min={0}
                className={INPUT}
                value={formInfo.numeroArticulos ?? ''}
                onChange={(e) => setInfoField('numeroArticulos', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>Capitulo de gasto</label>
              <input className={INPUT} value={formInfo.capituloGasto ?? ''} onChange={(e) => setInfoField('capituloGasto', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Requiere anualidad</label>
              <select
                className={INPUT}
                value={formInfo.requiereAnualidad === true ? 'si' : formInfo.requiereAnualidad === false ? 'no' : ''}
                onChange={(e) =>
                  setInfoField('requiereAnualidad', e.target.value === 'si' ? true : e.target.value === 'no' ? false : null)
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
                value={formInfo.numeroOficioPlurianualidad ?? ''}
                onChange={(e) => setInfoField('numeroOficioPlurianualidad', e.target.value)}
              />
            </div>
            <div>
              <label className={LABEL}>Clave de cartera</label>
              <input className={INPUT} value={formInfo.claveCartera ?? ''} onChange={(e) => setInfoField('claveCartera', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>No. de clave de cartera</label>
              <input className={INPUT} value={formInfo.numeroClaveCartera ?? ''} onChange={(e) => setInfoField('numeroClaveCartera', e.target.value)} />
            </div>
          </div>

          {errorInfo && <p className="text-sm text-red-600 mt-4">{errorInfo}</p>}

          <div className="flex gap-3 mt-5">
            <button
              onClick={guardarInfo}
              disabled={enviandoInfo}
              className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {enviandoInfo && <Spinner className="h-4 w-4 text-white" />}
              Guardar
            </button>
            <button
              onClick={() => setModalInfo(false)}
              disabled={enviandoInfo}
              className="flex-1 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
