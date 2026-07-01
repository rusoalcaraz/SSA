import { useState, useEffect } from 'react'
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { procedimientosService } from '../../services/procedimientos.service'
import { usuariosService } from '../../services/usuarios.service'
import { mensajeDeError } from '../../services/api'
import type { Procedimiento, InfoCronograma, InfoHojaDeTrabajo, UsuarioResumen } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { ETIQUETA_ETAPA, formatearMonto } from '../../utils/formato'

const FUENTES_FINANCIAMIENTO = [
  'Subsidio Federal',
  'Ingresos Propios',
  'Fondo Sectorial CONAHCYT',
  'Fondo Institucional',
  'Crédito Externo',
  'Convenio de Colaboración',
]

const CAPITULOS_GASTO = [
  '1000 - Servicios Personales',
  '2000 - Materiales y Suministros',
  '3000 - Servicios Generales',
  '4000 - Transferencias, Asignaciones y Subsidios',
  '5000 - Bienes Muebles, Inmuebles e Intangibles',
  '6000 - Inversión Pública',
]

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
  const [formHoja, setFormHoja] = useState<Pick<InfoHojaDeTrabajo, 'techoPresupuestal'>>({})
  const [formAsesores, setFormAsesores] = useState<{ asesorTitular: string; asesorSuplente: string }>({ asesorTitular: '', asesorSuplente: '' })
  const [asesores, setAsesores] = useState<UsuarioResumen[]>([])
  const [enviandoInfo, setEnviandoInfo] = useState(false)
  const [errorInfo, setErrorInfo] = useState<string | null>(null)

  function abrirModalInfo() {
    setFormInfo({ ...(procedimiento?.infoCronograma ?? {}) })
    setFormHoja({ techoPresupuestal: procedimiento?.infoHojaDeTrabajo?.techoPresupuestal })
    const titularId = typeof procedimiento?.asesorTitular === 'object' && procedimiento?.asesorTitular
      ? (procedimiento.asesorTitular as UsuarioResumen)._id
      : (procedimiento?.asesorTitular as string | undefined) ?? ''
    const suplenteId = typeof procedimiento?.asesorSuplente === 'object' && procedimiento?.asesorSuplente
      ? (procedimiento.asesorSuplente as UsuarioResumen)._id
      : (procedimiento?.asesorSuplente as string | undefined) ?? ''
    setFormAsesores({ asesorTitular: titularId, asesorSuplente: suplenteId })
    setErrorInfo(null)
    setModalInfo(true)
    if (procedimiento?.seccion) {
      const seccionId = typeof procedimiento.seccion === 'object'
        ? procedimiento.seccion._id
        : procedimiento.seccion
      usuariosService.listarAsesoresPorSeccion(seccionId).then(setAsesores).catch(() => setAsesores([]))
    }
  }

  function setInfoField(campo: keyof InfoCronograma, valor: string | number | boolean | null) {
    setFormInfo((prev) => ({ ...prev, [campo]: valor }))
  }

  function setHojaField(campo: keyof typeof formHoja, valor: number | undefined) {
    setFormHoja((prev) => ({ ...prev, [campo]: valor }))
  }

  async function guardarInfo() {
    if (!procedimiento) return
    setErrorInfo(null)
    setEnviandoInfo(true)
    try {
      const promesas: Promise<unknown>[] = [
        procedimientosService.actualizarInfoCronograma(procedimiento._id, formInfo),
        procedimientosService.actualizarInfoHojaDeTrabajo(procedimiento._id, formHoja),
      ]
      if (puedeAsignarAsesores) {
        promesas.push(
          procedimientosService.actualizarAsesores(procedimiento._id, {
            asesorTitular: formAsesores.asesorTitular || null,
            asesorSuplente: formAsesores.asesorSuplente || null,
          })
        )
      }
      await Promise.all(promesas)
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

  const puedeEditarInfo = tieneRol('administrador', 'adquisiciones', 'subdirector', 'asesor_tecnico')
  const puedeAsignarAsesores = tieneRol('administrador', 'adquisiciones', 'subdirector')
  const puedeVerCronograma = tieneRol(
    'administrador',
    'adquisiciones',
    'subdirector',
    'jefe_seccion',
    'asesor_tecnico'
  )
  const puedeVerHoja = puedeVerCronograma
  const puedeVerEntregas = puedeVerCronograma

  const tabs = [
    puedeVerCronograma && { to: 'cronograma', label: `Cronograma (${procedimiento.cronograma.length})` },
    puedeVerHoja && { to: 'hoja-trabajo', label: `Hoja de Trabajo (${procedimiento.hojaDeTrabajoEtapas.length})` },
    puedeVerEntregas && { to: 'entregas', label: `Entregas (${procedimiento.entregas.length})` },
  ].filter(Boolean) as { to: string; label: string }[]

  const TAB = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap'
  const TAB_ACTIVO = 'border-blue-900 text-blue-900'
  const TAB_INACTIVO = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

  const tieneInfo =
    Object.values(procedimiento.infoCronograma ?? {}).some((v) => !campoVacio(v)) ||
    typeof procedimiento.infoHojaDeTrabajo?.techoPresupuestal === 'number' ||
    !!procedimiento.asesorTitular ||
    !!procedimiento.asesorSuplente

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
              {tieneInfo ? 'Editar datos' : '+ Capturar datos'}
            </button>
          )}
        </div>

        {/* Datos generales del cronograma */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          {(() => {
            const info = procedimiento.infoCronograma ?? {}
            const techoPresupuestal =
              typeof procedimiento.infoHojaDeTrabajo?.techoPresupuestal === 'number'
                ? formatearMonto(procedimiento.infoHojaDeTrabajo.techoPresupuestal, procedimiento.moneda)
                : undefined
            return (
              <>
                <CampoInfo label="Subdirección" valor={typeof procedimiento.subdireccion === 'object' && procedimiento.subdireccion ? (procedimiento.subdireccion as { nombre: string }).nombre : undefined} />
                <CampoInfo label="Sección" valor={typeof procedimiento.seccion === 'object' && procedimiento.seccion ? (procedimiento.seccion as { nombre: string }).nombre : undefined} />
                <CampoInfo label="Fecha" valor={info.fecha ? new Date(info.fecha).toLocaleDateString('es-MX') : undefined} />
                <CampoInfo label="Asesor técnico" valor={typeof procedimiento.asesorTitular === 'object' && procedimiento.asesorTitular ? `${(procedimiento.asesorTitular as UsuarioResumen).nombre} ${(procedimiento.asesorTitular as UsuarioResumen).apellidos}` : undefined} />
                <CampoInfo label="Asesor técnico adjunto" valor={typeof procedimiento.asesorSuplente === 'object' && procedimiento.asesorSuplente ? `${(procedimiento.asesorSuplente as UsuarioResumen).nombre} ${(procedimiento.asesorSuplente as UsuarioResumen).apellidos}` : undefined} />
                <CampoInfo label="Fuente de financiamiento" valor={info.fuenteFinanciamiento} />
                <CampoInfo label="Telefono celular" valor={info.telefonoCelular} />
                <CampoInfo label="Extension satelital" valor={info.extensionSatelital} />
                <CampoInfo label="Nombre del procedimiento" valor={info.nombreProcedimientoContratacion} />
                <CampoInfo label="Techo presupuestal" valor={techoPresupuestal} />
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
            {/* Asesores técnicos — solo para roles con permiso */}
            {puedeAsignarAsesores && (
              <>
                <div>
                  <label className={LABEL}>Asesor técnico titular</label>
                  <select
                    className={INPUT}
                    value={formAsesores.asesorTitular}
                    onChange={(e) => setFormAsesores((p) => ({ ...p, asesorTitular: e.target.value }))}
                  >
                    <option value="">— Sin asignar —</option>
                    {asesores.map((a) => (
                      <option key={a._id} value={a._id}>{a.nombre} {a.apellidos}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Asesor técnico adjunto</label>
                  <select
                    className={INPUT}
                    value={formAsesores.asesorSuplente}
                    onChange={(e) => setFormAsesores((p) => ({ ...p, asesorSuplente: e.target.value }))}
                  >
                    <option value="">— Sin asignar —</option>
                    {asesores.map((a) => (
                      <option key={a._id} value={a._id}>{a.nombre} {a.apellidos}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

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
              <label className={LABEL}>Fuente de financiamiento</label>
              <select
                className={INPUT}
                value={formInfo.fuenteFinanciamiento ?? ''}
                onChange={(e) => setInfoField('fuenteFinanciamiento', e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {FUENTES_FINANCIAMIENTO.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Teléfono celular (asesor técnico)</label>
              <input className={INPUT} value={formInfo.telefonoCelular ?? ''} onChange={(e) => setInfoField('telefonoCelular', e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Extensión satelital</label>
              <input className={INPUT} value={formInfo.extensionSatelital ?? ''} onChange={(e) => setInfoField('extensionSatelital', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL}>Nombre del procedimiento de contratación</label>
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
              <label className={LABEL}>No. de artículos</label>
              <input
                type="number"
                min={0}
                className={INPUT}
                value={formInfo.numeroArticulos ?? ''}
                onChange={(e) => setInfoField('numeroArticulos', e.target.value === '' ? 0 : Number(e.target.value))}
              />
            </div>
            <div>
              <label className={LABEL}>Capítulo de gasto</label>
              <select
                className={INPUT}
                value={formInfo.capituloGasto ?? ''}
                onChange={(e) => setInfoField('capituloGasto', e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {CAPITULOS_GASTO.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
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
            <div>
              <label className={LABEL}>Techo presupuestal</label>
              <input
                type="number"
                min={0}
                className={INPUT}
                placeholder="0.00"
                value={formHoja.techoPresupuestal ?? ''}
                onChange={(e) =>
                  setHojaField('techoPresupuestal', e.target.value === '' ? undefined : Number(e.target.value))
                }
              />
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
