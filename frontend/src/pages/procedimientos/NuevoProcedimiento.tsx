import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { procedimientosService, type CrearProcedimientoPayload } from '../../services/procedimientos.service'
import { catalogosService } from '../../services/catalogos.service'
import { usuariosService } from '../../services/usuarios.service'
import { mensajeDeError } from '../../services/api'
import type { DireccionGeneral, BienServicio, UsuarioResumen, TipoProcedimiento } from '../../types'
import { Spinner } from '../../components/ui/Spinner'
import { ETIQUETA_TIPO_LARGO } from '../../utils/formato'

const TIPOS_PROCEDIMIENTO: TipoProcedimiento[] = [
  'licitacion_publica_nacional',
  'licitacion_publica_internacional_libre',
  'licitacion_publica_internacional_tratados',
  'invitacion_tres_personas',
  'adjudicacion_directa',
]

const TIPOS_CON_EXCEPCION: TipoProcedimiento[] = [
  'invitacion_tres_personas',
  'adjudicacion_directa',
]

// Supuestos del Art. 54 LAASSP (simplificado)
const SUPUESTOS_EXCEPCION = [
  { value: 'fraccion_I', label: 'Art. 54 Frac. I' },
  { value: 'fraccion_II', label: 'Art. 54 Frac. II' },
  { value: 'fraccion_III', label: 'Art. 54 Frac. III' },
  { value: 'fraccion_IV', label: 'Art. 54 Frac. IV' },
  { value: 'fraccion_V', label: 'Art. 54 Frac. V' },
  { value: 'fraccion_VI', label: 'Art. 54 Frac. VI' },
  { value: 'fraccion_VII', label: 'Art. 54 Frac. VII' },
  { value: 'fraccion_VIII', label: 'Art. 54 Frac. VIII' },
  { value: 'fraccion_IX', label: 'Art. 54 Frac. IX' },
  { value: 'fraccion_X', label: 'Art. 54 Frac. X (Consultoria)' },
]

function Campo({
  label,
  requerido,
  children,
  ayuda,
}: {
  label: string
  requerido?: boolean
  children: React.ReactNode
  ayuda?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">
        {label}
        {requerido && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {ayuda && <p className="text-xs text-gray-400">{ayuda}</p>}
    </div>
  )
}

const INPUT = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50'
const SELECT = INPUT

export function NuevoProcedimiento() {
  const navigate = useNavigate()

  // Datos de catalogos
  const [dgs, setDGs] = useState<DireccionGeneral[]>([])
  const [bienesServicios, setBienesServicios] = useState<BienServicio[]>([])
  const [asesores, setAsesores] = useState<UsuarioResumen[]>([])
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true)

  // Campos del formulario
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [anioFiscal, setAnioFiscal] = useState(new Date().getFullYear())
  const [bienServicio, setBienServicio] = useState('')
  const [descripcionEspecifica, setDescripcionEspecifica] = useState('')
  const [montoEstimado, setMontoEstimado] = useState('')
  const [direccionGeneral, setDireccionGeneral] = useState('')
  const [asesorTitular, setAsesorTitular] = useState('')
  const [asesorSuplente, setAsesorSuplente] = useState('')
  const [tipoProcedimiento, setTipoProcedimiento] = useState<TipoProcedimiento | ''>('')
  const [supuestoExcepcion, setSupuestoExcepcion] = useState('')
  const [tipoConsultoria, setTipoConsultoria] = useState('')
  const [justificacionTipo, setJustificacionTipo] = useState('')
  const [urgente, setUrgente] = useState(false)
  const [justificacionUrgencia, setJustificacionUrgencia] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function cargar() {
      try {
        const [dgData, bsData, asData] = await Promise.all([
          catalogosService.listarDGs(),
          catalogosService.listarBienesServicios(),
          usuariosService.listarAsesores(),
        ])
        setDGs(dgData)
        setBienesServicios(bsData)
        setAsesores(asData)
      } catch {
        setError('No se pudieron cargar los catalogos. Recargue la pagina.')
      } finally {
        setCargandoCatalogos(false)
      }
    }
    cargar()
  }, [])

  const requiereExcepcion = tipoProcedimiento !== '' && TIPOS_CON_EXCEPCION.includes(tipoProcedimiento as TipoProcedimiento)
  const requiereConsultoria = supuestoExcepcion === 'fraccion_X'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!tipoProcedimiento) {
      setError('Seleccione el tipo de procedimiento.')
      return
    }
    setError(null)
    setEnviando(true)

    const payload: CrearProcedimientoPayload = {
      titulo,
      descripcion: descripcion || undefined,
      anioFiscal,
      bienServicio,
      descripcionEspecifica: descripcionEspecifica || undefined,
      montoEstimado: montoEstimado ? Number(montoEstimado) : undefined,
      direccionGeneral,
      asesorTitular,
      asesorSuplente: asesorSuplente || undefined,
      tipoProcedimiento: tipoProcedimiento as TipoProcedimiento,
      supuestoExcepcion: supuestoExcepcion || undefined,
      tipoConsultoria: tipoConsultoria || undefined,
      justificacionTipo: justificacionTipo || undefined,
      urgente,
      justificacionUrgencia: urgente ? justificacionUrgencia : undefined,
    }

    try {
      const nuevo = await procedimientosService.crear(payload)
      navigate(`/procedimientos/${nuevo._id}`, { replace: true })
    } catch (err) {
      setError(mensajeDeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (cargandoCatalogos) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="text-blue-900" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Nuevo Procedimiento</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Complete los datos del procedimiento de adquisicion.
        </p>
      </div>

      {error && (
        <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-8">

        {/* Seccion: Identificacion */}
        <section className="bg-white rounded-lg border border-gray-200 px-6 py-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 pb-1 border-b border-gray-100">
            Identificacion
          </h2>

          <Campo label="Titulo del procedimiento" requerido>
            <input
              type="text"
              required
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className={INPUT}
              placeholder="Nombre descriptivo del bien o servicio a adquirir"
              disabled={enviando}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Anio fiscal" requerido>
              <input
                type="number"
                required
                min={2020}
                max={2099}
                value={anioFiscal}
                onChange={(e) => setAnioFiscal(Number(e.target.value))}
                className={INPUT}
                disabled={enviando}
              />
            </Campo>
            <Campo label="Direccion General" requerido>
              <select
                required
                value={direccionGeneral}
                onChange={(e) => setDireccionGeneral(e.target.value)}
                className={SELECT}
                disabled={enviando}
              >
                <option value="">Seleccionar DG</option>
                {dgs.map((dg) => (
                  <option key={dg._id} value={dg._id}>
                    {dg.siglas} — {dg.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo label="Descripcion" ayuda="Opcional. Contexto adicional sobre el procedimiento.">
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              className={INPUT}
              disabled={enviando}
            />
          </Campo>
        </section>

        {/* Seccion: Bien o servicio */}
        <section className="bg-white rounded-lg border border-gray-200 px-6 py-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 pb-1 border-b border-gray-100">
            Bien o Servicio
          </h2>

          <Campo label="Catalogo de bienes y servicios" requerido>
            <select
              required
              value={bienServicio}
              onChange={(e) => setBienServicio(e.target.value)}
              className={SELECT}
              disabled={enviando}
            >
              <option value="">Seleccionar bien o servicio</option>
              {bienesServicios.map((bs) => (
                <option key={bs._id} value={bs._id}>
                  {bs.clave} — {bs.descripcion}
                </option>
              ))}
            </select>
          </Campo>

          <Campo label="Descripcion especifica" ayuda="Detalle particular de esta adquisicion.">
            <textarea
              value={descripcionEspecifica}
              onChange={(e) => setDescripcionEspecifica(e.target.value)}
              rows={2}
              className={INPUT}
              disabled={enviando}
            />
          </Campo>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Monto estimado (MXN)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={montoEstimado}
                onChange={(e) => setMontoEstimado(e.target.value)}
                className={INPUT}
                placeholder="0.00"
                disabled={enviando}
              />
            </Campo>
          </div>
        </section>

        {/* Seccion: Asesores tecnicos */}
        <section className="bg-white rounded-lg border border-gray-200 px-6 py-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 pb-1 border-b border-gray-100">
            Asesores Tecnicos
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="AT Titular" requerido>
              <select
                required
                value={asesorTitular}
                onChange={(e) => setAsesorTitular(e.target.value)}
                className={SELECT}
                disabled={enviando}
              >
                <option value="">Seleccionar asesor</option>
                {asesores.map((at) => (
                  <option key={at.id} value={at.id}>
                    {at.nombre} {at.apellidos}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="AT Suplente" ayuda="Opcional.">
              <select
                value={asesorSuplente}
                onChange={(e) => setAsesorSuplente(e.target.value)}
                className={SELECT}
                disabled={enviando}
              >
                <option value="">Sin suplente</option>
                {asesores
                  .filter((at) => at.id !== asesorTitular)
                  .map((at) => (
                    <option key={at.id} value={at.id}>
                      {at.nombre} {at.apellidos}
                    </option>
                  ))}
              </select>
            </Campo>
          </div>
        </section>

        {/* Seccion: Tipo y justificacion */}
        <section className="bg-white rounded-lg border border-gray-200 px-6 py-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 pb-1 border-b border-gray-100">
            Tipo de Procedimiento y Justificacion Legal
          </h2>

          <Campo label="Tipo de procedimiento" requerido>
            <select
              required
              value={tipoProcedimiento}
              onChange={(e) => {
                setTipoProcedimiento(e.target.value as TipoProcedimiento)
                setSupuestoExcepcion('')
                setTipoConsultoria('')
              }}
              className={SELECT}
              disabled={enviando}
            >
              <option value="">Seleccionar tipo</option>
              {TIPOS_PROCEDIMIENTO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_LARGO[t]}
                </option>
              ))}
            </select>
          </Campo>

          {requiereExcepcion && (
            <Campo
              label="Supuesto de excepcion (Art. 54 LAASSP)"
              requerido
              ayuda="Seleccione la fraccion aplicable a este procedimiento."
            >
              <select
                required
                value={supuestoExcepcion}
                onChange={(e) => {
                  setSupuestoExcepcion(e.target.value)
                  if (e.target.value !== 'fraccion_X') setTipoConsultoria('')
                }}
                className={SELECT}
                disabled={enviando}
              >
                <option value="">Seleccionar supuesto</option>
                {SUPUESTOS_EXCEPCION.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {requiereConsultoria && (
            <Campo
              label="Tipo de consultoria"
              requerido
              ayuda="Art. 109 Frac. IX del Reglamento de la LAASSP."
            >
              <select
                required
                value={tipoConsultoria}
                onChange={(e) => setTipoConsultoria(e.target.value)}
                className={SELECT}
                disabled={enviando}
              >
                <option value="">Seleccionar tipo</option>
                <option value="estandarizado">Estandarizado</option>
                <option value="personalizado">Personalizado</option>
                <option value="especializado">Especializado</option>
              </select>
            </Campo>
          )}

          <Campo
            label="Justificacion (fundamento legal)"
            ayuda="Referencia al articulo aplicable de la LAASSP y su Reglamento (Art. 108 Reglamento)."
          >
            <textarea
              value={justificacionTipo}
              onChange={(e) => setJustificacionTipo(e.target.value)}
              rows={3}
              className={INPUT}
              disabled={enviando}
              placeholder="Con fundamento en el articulo..."
            />
          </Campo>
        </section>

        {/* Seccion: Urgencia */}
        <section className="bg-white rounded-lg border border-gray-200 px-6 py-5 space-y-4">
          <h2 className="text-base font-semibold text-gray-800 pb-1 border-b border-gray-100">
            Urgencia
          </h2>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={urgente}
              onChange={(e) => {
                setUrgente(e.target.checked)
                if (!e.target.checked) setJustificacionUrgencia('')
              }}
              className="h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-500"
              disabled={enviando}
            />
            <span className="text-sm text-gray-700">
              Marcar este procedimiento como <strong>urgente</strong>
            </span>
          </label>

          {urgente && (
            <Campo label="Justificacion de urgencia" requerido>
              <textarea
                required
                value={justificacionUrgencia}
                onChange={(e) => setJustificacionUrgencia(e.target.value)}
                rows={2}
                className={INPUT}
                disabled={enviando}
                placeholder="Describa la razon de urgencia..."
              />
            </Campo>
          )}
        </section>

        {/* Acciones */}
        <div className="flex items-center gap-3 pb-8">
          <button
            type="submit"
            disabled={enviando || !titulo || !bienServicio || !direccionGeneral || !asesorTitular || !tipoProcedimiento}
            className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center gap-2"
          >
            {enviando && <Spinner className="text-white h-4 w-4" />}
            {enviando ? 'Creando...' : 'Crear procedimiento'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={enviando}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
