import { useState, useEffect } from 'react'
import { useParams, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { procedimientosService } from '../../services/procedimientos.service'
import type { Procedimiento } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { ETIQUETA_ETAPA, ETIQUETA_TIPO_LARGO, formatearMonto, formatearFecha } from '../../utils/formato'

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
                  URGENTE
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
        </div>

        {/* Grilla de metadatos */}
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tipo</dt>
            <dd className="mt-0.5 text-gray-800">{ETIQUETA_TIPO_LARGO[procedimiento.tipoProcedimiento]}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">DG</dt>
            <dd className="mt-0.5 text-gray-800">
              {procedimiento.direccionGeneral?.siglas} — {procedimiento.direccionGeneral?.nombre}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">AT Titular</dt>
            <dd className="mt-0.5 text-gray-800">
              {procedimiento.asesorTitular
                ? `${procedimiento.asesorTitular.nombre} ${procedimiento.asesorTitular.apellidos}`
                : '—'}
            </dd>
          </div>
          {procedimiento.asesorSuplente && (
            <div>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">AT Suplente</dt>
              <dd className="mt-0.5 text-gray-800">
                {procedimiento.asesorSuplente.nombre} {procedimiento.asesorSuplente.apellidos}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Anio fiscal</dt>
            <dd className="mt-0.5 text-gray-800">{procedimiento.anioFiscal}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Bien / Servicio</dt>
            <dd className="mt-0.5 text-gray-800">
              {procedimiento.bienServicio
                ? `${procedimiento.bienServicio.clave} — ${procedimiento.bienServicio.descripcion}`
                : '—'}
            </dd>
          </div>
          {procedimiento.montoEstimado && (
            <div>
              <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Monto estimado</dt>
              <dd className="mt-0.5 text-gray-800">
                {formatearMonto(procedimiento.montoEstimado, procedimiento.moneda)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide">Creado</dt>
            <dd className="mt-0.5 text-gray-800">{formatearFecha(procedimiento.createdAt)}</dd>
          </div>
        </dl>

        {/* Justificacion urgente */}
        {procedimiento.urgente && procedimiento.justificacionUrgencia && (
          <div className="mt-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            <span className="font-medium">Justificacion de urgencia: </span>
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
    </div>
  )
}
