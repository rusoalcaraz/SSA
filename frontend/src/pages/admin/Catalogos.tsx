import { useState, useEffect, useCallback } from 'react'
import type { BienServicio, CatalogoEtapa, TipoProcedimiento } from '../../types'
import { catalogosService } from '../../services/catalogos.service'
import { mensajeDeError } from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { ETIQUETA_TIPO } from '../../utils/formato'

const TIPOS_PROCEDIMIENTO: TipoProcedimiento[] = [
  'licitacion_publica_nacional',
  'licitacion_publica_internacional_libre',
  'licitacion_publica_internacional_tratados',
  'invitacion_tres_personas',
  'adjudicacion_directa',
]

// -------------------------------------------------------
// Tab: Bienes y Servicios
// -------------------------------------------------------
function ModalBienServicio({
  item,
  onGuardado,
  onClose,
}: {
  item?: BienServicio
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    clave: item?.clave ?? '',
    descripcion: item?.descripcion ?? '',
    tipo: item?.tipo ?? 'bien' as BienServicio['tipo'],
    unidadMedida: item?.unidadMedida ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      if (item) {
        await catalogosService.actualizarBienServicio(item._id, {
          clave: form.clave,
          descripcion: form.descripcion,
          tipo: form.tipo,
          unidadMedida: form.unidadMedida || undefined,
        })
      } else {
        await catalogosService.crearBienServicio({
          clave: form.clave,
          descripcion: form.descripcion,
          tipo: form.tipo,
          unidadMedida: form.unidadMedida || undefined,
        })
      }
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={item ? 'Editar bien / servicio' : 'Nuevo bien / servicio'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Clave <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.clave}
              onChange={(e) => setForm((f) => ({ ...f, clave: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo <span className="text-red-500">*</span></label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as BienServicio['tipo'] }))}
            >
              <option value="bien">Bien</option>
              <option value="servicio">Servicio</option>
              <option value="bien_y_servicio">Bien y Servicio</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Descripcion <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unidad de medida</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.unidadMedida}
            onChange={(e) => setForm((f) => ({ ...f, unidadMedida: e.target.value }))}
          />
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors">
            {guardando ? 'Guardando...' : item ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TabBienesServicios() {
  const [items, setItems] = useState<BienServicio[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<BienServicio | null | 'nuevo'>(null)
  const [desactivando, setDesactivando] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    catalogosService
      .listarTodosBienesServicios()
      .then(setItems)
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleDesactivar(item: BienServicio) {
    if (!confirm(`¿Desactivar "${item.clave} — ${item.descripcion}"?`)) return
    setDesactivando(item._id)
    try {
      await catalogosService.desactivarBienServicio(item._id)
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDesactivando(null)
    }
  }

  const TIPO_LABEL: Record<BienServicio['tipo'], string> = {
    bien: 'Bien',
    servicio: 'Servicio',
    bien_y_servicio: 'Bien y Servicio',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{items.length} registros</p>
        <button
          type="button"
          onClick={() => setModal('nuevo')}
          className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nuevo
        </button>
      </div>
      {errorMsg && <p className="text-sm text-red-600 mb-3">{errorMsg}</p>}
      {cargando ? (
        <div className="flex justify-center py-12"><Spinner className="text-blue-900" /></div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Clave</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Descripcion</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Unidad</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((item) => (
              <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                <td className="py-2.5 pr-4 font-mono text-xs text-gray-700">{item.clave}</td>
                <td className="py-2.5 pr-4 text-gray-800">{item.descripcion}</td>
                <td className="py-2.5 pr-4 text-gray-500">{TIPO_LABEL[item.tipo]}</td>
                <td className="py-2.5 pr-4 text-gray-400 text-xs">{item.unidadMedida ?? '—'}</td>
                <td className="py-2.5 pr-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="py-2.5">
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setModal(item)} className="text-xs text-blue-700 hover:underline">Editar</button>
                    {item.activo && (
                      <button type="button" disabled={desactivando === item._id} onClick={() => handleDesactivar(item)} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                        {desactivando === item._id ? '...' : 'Desactivar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(modal === 'nuevo' || (modal && modal !== 'nuevo')) && (
        <ModalBienServicio
          item={modal !== 'nuevo' ? (modal as BienServicio) : undefined}
          onGuardado={() => { setModal(null); cargar() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------
// Tab: Etapas del catalogo
// -------------------------------------------------------
function ModalEtapa({
  etapa,
  onGuardado,
  onClose,
}: {
  etapa?: CatalogoEtapa
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nombre: etapa?.nombre ?? '',
    descripcion: etapa?.descripcion ?? '',
    tipo: etapa?.tipo ?? 'cronograma' as CatalogoEtapa['tipo'],
    obligatoria: etapa?.obligatoria ?? false,
    aplicaA: etapa?.aplicaA ?? [] as TipoProcedimiento[],
    orden: etapa?.orden ?? 1,
    diasAlertaUrgente: etapa?.diasAlertaUrgente?.toString() ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function toggleAplicaA(tipo: TipoProcedimiento) {
    setForm((f) => ({
      ...f,
      aplicaA: f.aplicaA.includes(tipo)
        ? f.aplicaA.filter((t) => t !== tipo)
        : [...f.aplicaA, tipo],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      const payload = {
        nombre: form.nombre,
        descripcion: form.descripcion || undefined,
        tipo: form.tipo,
        obligatoria: form.obligatoria,
        aplicaA: form.aplicaA,
        orden: Number(form.orden),
        diasAlertaUrgente: form.diasAlertaUrgente ? Number(form.diasAlertaUrgente) : undefined,
      }
      if (etapa) {
        await catalogosService.actualizarEtapa(etapa._id, payload)
      } else {
        await catalogosService.crearEtapa(payload)
      }
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={etapa ? 'Editar etapa' : 'Nueva etapa'} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descripcion</label>
          <textarea
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo <span className="text-red-500">*</span></label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as CatalogoEtapa['tipo'] }))}
            >
              <option value="cronograma">Cronograma</option>
              <option value="hoja_de_trabajo">Hoja de Trabajo</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Orden <span className="text-red-500">*</span></label>
            <input
              type="number"
              required
              min={1}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.orden}
              onChange={(e) => setForm((f) => ({ ...f, orden: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dias alerta urg.</label>
            <input
              type="number"
              min={1}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
              value={form.diasAlertaUrgente}
              onChange={(e) => setForm((f) => ({ ...f, diasAlertaUrgente: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="obligatoria"
            checked={form.obligatoria}
            onChange={(e) => setForm((f) => ({ ...f, obligatoria: e.target.checked }))}
            className="rounded border-gray-300 text-blue-900 focus:ring-blue-900"
          />
          <label htmlFor="obligatoria" className="text-sm text-gray-700">Obligatoria (requiere fecha anterior para avanzar)</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Aplica a</label>
          <p className="text-xs text-gray-400 mb-2">Sin seleccion = aplica a todos los tipos.</p>
          <div className="space-y-1.5">
            {TIPOS_PROCEDIMIENTO.map((tipo) => (
              <label key={tipo} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.aplicaA.includes(tipo)}
                  onChange={() => toggleAplicaA(tipo)}
                  className="rounded border-gray-300 text-blue-900 focus:ring-blue-900"
                />
                {ETIQUETA_TIPO[tipo]}
              </label>
            ))}
          </div>
        </div>
        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 disabled:opacity-50 transition-colors">
            {guardando ? 'Guardando...' : etapa ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function TabEtapas() {
  const [etapas, setEtapas] = useState<CatalogoEtapa[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<CatalogoEtapa | null | 'nueva'>(null)
  const [desactivando, setDesactivando] = useState<string | null>(null)
  const [filtroTipo, setFiltroTipo] = useState<'' | 'cronograma' | 'hoja_de_trabajo'>('')

  const cargar = useCallback(() => {
    setCargando(true)
    catalogosService
      .listarTodasEtapas()
      .then(setEtapas)
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleDesactivar(etapa: CatalogoEtapa) {
    if (!confirm(`¿Desactivar "${etapa.nombre}"?`)) return
    setDesactivando(etapa._id)
    try {
      await catalogosService.desactivarEtapa(etapa._id)
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDesactivando(null)
    }
  }

  const etapasFiltradas = filtroTipo
    ? etapas.filter((e) => e.tipo === filtroTipo)
    : etapas

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <select
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as typeof filtroTipo)}
          >
            <option value="">Todas</option>
            <option value="cronograma">Cronograma</option>
            <option value="hoja_de_trabajo">Hoja de Trabajo</option>
          </select>
          <span className="text-sm text-gray-400">{etapasFiltradas.length} etapas</span>
        </div>
        <button
          type="button"
          onClick={() => setModal('nueva')}
          className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nueva etapa
        </button>
      </div>
      {errorMsg && <p className="text-sm text-red-600 mb-3">{errorMsg}</p>}
      {cargando ? (
        <div className="flex justify-center py-12"><Spinner className="text-blue-900" /></div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase w-10">Ord.</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Oblig.</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Aplica a</th>
              <th className="pb-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {etapasFiltradas
              .sort((a, b) => a.orden - b.orden)
              .map((etapa) => (
                <tr key={etapa._id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 pr-3 text-gray-400 text-xs font-mono">{etapa.orden}</td>
                  <td className="py-2.5 pr-4 text-gray-800">{etapa.nombre}</td>
                  <td className="py-2.5 pr-4 text-gray-500 text-xs">
                    {etapa.tipo === 'cronograma' ? 'Cronograma' : 'Hoja de Trabajo'}
                  </td>
                  <td className="py-2.5 pr-4">
                    {etapa.obligatoria ? (
                      <span className="text-green-600 text-xs font-medium">Si</span>
                    ) : (
                      <span className="text-gray-400 text-xs">No</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4 text-xs text-gray-500">
                    {etapa.aplicaA.length === 0
                      ? 'Todos'
                      : etapa.aplicaA.map((t) => ETIQUETA_TIPO[t]).join(', ')}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${etapa.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {etapa.activa ? 'Activa' : 'Inactiva'}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setModal(etapa)} className="text-xs text-blue-700 hover:underline">Editar</button>
                      {etapa.activa && (
                        <button type="button" disabled={desactivando === etapa._id} onClick={() => handleDesactivar(etapa)} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                          {desactivando === etapa._id ? '...' : 'Desactivar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {(modal === 'nueva' || (modal && modal !== 'nueva')) && (
        <ModalEtapa
          etapa={modal !== 'nueva' ? (modal as CatalogoEtapa) : undefined}
          onGuardado={() => { setModal(null); cargar() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------
// Pagina principal
// -------------------------------------------------------
export function Catalogos() {
  const [tab, setTab] = useState<'bienes' | 'etapas'>('bienes')

  const TAB = 'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors'
  const TAB_ACTIVO = 'border-blue-900 text-blue-900'
  const TAB_INACTIVO = 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-6">Catalogos</h1>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="flex border-b border-gray-200 px-2">
          <button
            type="button"
            className={`${TAB} ${tab === 'bienes' ? TAB_ACTIVO : TAB_INACTIVO}`}
            onClick={() => setTab('bienes')}
          >
            Bienes y Servicios
          </button>
          <button
            type="button"
            className={`${TAB} ${tab === 'etapas' ? TAB_ACTIVO : TAB_INACTIVO}`}
            onClick={() => setTab('etapas')}
          >
            Etapas del catalogo
          </button>
        </div>
        <div className="p-5 overflow-x-auto">
          {tab === 'bienes' ? <TabBienesServicios /> : <TabEtapas />}
        </div>
      </div>
    </div>
  )
}
