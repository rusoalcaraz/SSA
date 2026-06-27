import { useState, useEffect, useCallback } from 'react'
import type { Subdireccion, Seccion } from '../../types'
import { catalogosService } from '../../services/catalogos.service'
import { mensajeDeError } from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useAuth } from '../../hooks/useAuth'

// ===========================================================
// Helpers
// ===========================================================

function BadgeEstado({ activa }: { activa: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {activa ? 'Activa' : 'Inactiva'}
    </span>
  )
}

// ===========================================================
// Modal Subdireccion
// ===========================================================

function ModalSubdireccion({
  sub,
  onGuardado,
  onClose,
}: {
  sub?: Subdireccion
  onGuardado: () => void
  onClose: () => void
}) {
  const [nombre, setNombre] = useState(sub?.nombre ?? '')
  const [esAdquisiciones, setEsAdquisiciones] = useState(sub?.esAdquisiciones ?? false)
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      if (sub) {
        await catalogosService.actualizarSubdireccion(sub._id, { nombre, esAdquisiciones })
      } else {
        await catalogosService.crearSubdireccion({ nombre })
      }
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={sub ? 'Editar subdirección' : 'Nueva subdirección'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        </div>
        {sub && (
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="esAdquisiciones"
              checked={esAdquisiciones}
              onChange={(e) => setEsAdquisiciones(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-900 focus:ring-blue-900"
            />
            <div>
              <label htmlFor="esAdquisiciones" className="text-sm font-medium text-gray-700 cursor-pointer">
                Subdirección de Adquisiciones
              </label>
              <p className="text-xs text-gray-400 mt-0.5">
                Los usuarios de esta subdirección tendrán permisos de adquisiciones (validar etapas, entregas, etc.). Solo puede haber una.
              </p>
            </div>
          </div>
        )}
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
            {guardando ? 'Guardando...' : sub ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ===========================================================
// Modal Seccion
// ===========================================================

function ModalSeccion({
  seccion,
  subdirecciones,
  subdireccionFija,
  onGuardado,
  onClose,
}: {
  seccion?: Seccion
  subdirecciones: Subdireccion[]
  subdireccionFija?: string
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nombre: seccion?.nombre ?? '',
    subdireccion: subdireccionFija ?? seccion?.subdireccion?._id ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subdireccion) {
      setErrorMsg('Selecciona una subdirección.')
      return
    }
    setGuardando(true)
    setErrorMsg(null)
    try {
      if (seccion) {
        await catalogosService.actualizarSeccion(seccion._id, { nombre: form.nombre })
      } else {
        await catalogosService.crearSeccion({ nombre: form.nombre, subdireccion: form.subdireccion })
      }
      onGuardado()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal titulo={seccion ? 'Editar sección' : 'Nueva sección'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {!subdireccionFija && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subdirección <span className="text-red-500">*</span>
            </label>
            <select
              required
              disabled={!!seccion}
              value={form.subdireccion}
              onChange={(e) => setForm((f) => ({ ...f, subdireccion: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900 disabled:bg-gray-50"
            >
              <option value="">Selecciona una subdirección</option>
              {subdirecciones.filter((s) => s.activa).map((s) => (
                <option key={s._id} value={s._id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {seccion && (
              <p className="mt-1 text-xs text-gray-400">La subdirección no puede cambiarse una vez creada.</p>
            )}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            autoFocus
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
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
            {guardando ? 'Guardando...' : seccion ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ===========================================================
// Tab: Subdirecciones (Admin)
// ===========================================================

function TabSubdirecciones() {
  const [subs, setSubs] = useState<Subdireccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<Subdireccion | null | 'nueva'>(null)
  const [desactivando, setDesactivando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    catalogosService
      .listarSubdirecciones(false)
      .then(setSubs)
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleDesactivar(sub: Subdireccion) {
    if (sub.activa) {
      if (!confirm(`¿Desactivar la subdirección "${sub.nombre}"? Las secciones asociadas permanecerán pero no podrán usarse en nuevos procedimientos.`)) return
    }
    setDesactivando(sub._id)
    try {
      if (sub.activa) {
        await catalogosService.desactivarSubdireccion(sub._id)
      } else {
        await catalogosService.actualizarSubdireccion(sub._id, { activa: true })
      }
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDesactivando(null)
    }
  }

  async function handleEliminar(sub: Subdireccion) {
    if (!confirm(`¿Eliminar permanentemente la subdirección "${sub.nombre}"?\n\nEsta acción no se puede deshacer.`)) return
    setEliminando(sub._id)
    try {
      await catalogosService.eliminarSubdireccion(sub._id)
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setEliminando(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">Subdirecciones registradas en el sistema.</p>
        <button
          type="button"
          onClick={() => setModal('nueva')}
          className="px-3 py-1.5 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nueva subdirección
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><Spinner className="text-blue-900" /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {subs.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Sin subdirecciones registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subs.map((sub) => (
                  <tr key={sub._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800 font-medium">{sub.nombre}</td>
                    <td className="px-4 py-3"><BadgeEstado activa={sub.activa} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => setModal(sub)} className="text-xs text-blue-700 hover:underline">
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={desactivando === sub._id}
                          onClick={() => handleDesactivar(sub)}
                          className="text-xs text-orange-600 hover:underline disabled:opacity-50"
                        >
                          {desactivando === sub._id ? '...' : sub.activa ? 'Desactivar' : 'Reactivar'}
                        </button>
                        <button
                          type="button"
                          disabled={eliminando === sub._id}
                          onClick={() => handleEliminar(sub)}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {eliminando === sub._id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal !== null && (
        <ModalSubdireccion
          sub={modal === 'nueva' ? undefined : modal}
          onGuardado={() => { setModal(null); cargar() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ===========================================================
// Tab: Secciones (Admin)
// ===========================================================

function TabSecciones() {
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [subdirecciones, setSubdirecciones] = useState<Subdireccion[]>([])
  const [filtroSub, setFiltroSub] = useState('')
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<Seccion | null | 'nueva'>(null)
  const [desactivando, setDesactivando] = useState<string | null>(null)
  const [eliminando, setEliminando] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    Promise.all([
      catalogosService.listarSecciones({ soloActivas: false }),
      catalogosService.listarSubdirecciones(false),
    ])
      .then(([secs, subs]) => {
        setSecciones(secs)
        setSubdirecciones(subs)
      })
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleDesactivar(sec: Seccion) {
    if (sec.activa) {
      if (!confirm(`¿Desactivar la sección "${sec.nombre}"?`)) return
    }
    setDesactivando(sec._id)
    try {
      if (sec.activa) {
        await catalogosService.desactivarSeccion(sec._id)
      } else {
        await catalogosService.actualizarSeccion(sec._id, { activa: true })
      }
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDesactivando(null)
    }
  }

  async function handleEliminar(sec: Seccion) {
    if (!confirm(`¿Eliminar permanentemente la sección "${sec.nombre}"?\n\nEsta acción no se puede deshacer.`)) return
    setEliminando(sec._id)
    try {
      await catalogosService.eliminarSeccion(sec._id)
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setEliminando(null)
    }
  }

  const seccionesFiltradas = filtroSub
    ? secciones.filter((s) => s.subdireccion?._id === filtroSub)
    : secciones

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">Secciones registradas en el sistema.</p>
          <select
            value={filtroSub}
            onChange={(e) => setFiltroSub(e.target.value)}
            className="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Todas las subdirecciones</option>
            {subdirecciones.map((s) => (
              <option key={s._id} value={s._id}>{s.nombre}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => setModal('nueva')}
          className="px-3 py-1.5 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nueva sección
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><Spinner className="text-blue-900" /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {seccionesFiltradas.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Sin secciones registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Subdirección</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seccionesFiltradas.map((sec) => (
                  <tr key={sec._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800 font-medium">{sec.nombre}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{sec.subdireccion?.nombre ?? '—'}</td>
                    <td className="px-4 py-3"><BadgeEstado activa={sec.activa} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button type="button" onClick={() => setModal(sec)} className="text-xs text-blue-700 hover:underline">
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={desactivando === sec._id}
                          onClick={() => handleDesactivar(sec)}
                          className="text-xs text-orange-600 hover:underline disabled:opacity-50"
                        >
                          {desactivando === sec._id ? '...' : sec.activa ? 'Desactivar' : 'Reactivar'}
                        </button>
                        <button
                          type="button"
                          disabled={eliminando === sec._id}
                          onClick={() => handleEliminar(sec)}
                          className="text-xs text-red-600 hover:underline disabled:opacity-50"
                        >
                          {eliminando === sec._id ? 'Eliminando...' : 'Eliminar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal !== null && (
        <ModalSeccion
          seccion={modal === 'nueva' ? undefined : modal}
          subdirecciones={subdirecciones}
          onGuardado={() => { setModal(null); cargar() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ===========================================================
// Vista Subdirector: gestión de sus secciones
// ===========================================================

function VistaSubdirector() {
  const { usuario } = useAuth()
  const subdireccionId = typeof usuario?.subdireccion === 'string'
    ? usuario.subdireccion
    : (usuario?.subdireccion as Subdireccion | null)?._id ?? null

  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [subdirNombre, setSubdirNombre] = useState<string>('')
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modal, setModal] = useState<Seccion | null | 'nueva'>(null)
  const [desactivando, setDesactivando] = useState<string | null>(null)
  const [reactivando, setReactivando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setErrorMsg(null)
    try {
      const secs = await catalogosService.listarSecciones({ soloActivas: false })
      setSecciones(secs)

      if (secs.length > 0) {
        setSubdirNombre(secs[0].subdireccion?.nombre ?? '')
      } else if (subdireccionId) {
        const subs = await catalogosService.listarSubdirecciones(false)
        const match = subs.find((s) => s._id === subdireccionId)
        if (match) setSubdirNombre(match.nombre)
      }
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setCargando(false)
    }
  }, [subdireccionId])

  useEffect(() => { cargar() }, [cargar])

  async function handleDesactivar(sec: Seccion) {
    if (!confirm(`¿Desactivar la sección "${sec.nombre}"?`)) return
    setDesactivando(sec._id)
    try {
      await catalogosService.desactivarSeccion(sec._id)
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDesactivando(null)
    }
  }

  async function handleReactivar(sec: Seccion) {
    setReactivando(sec._id)
    try {
      await catalogosService.actualizarSeccion(sec._id, { activa: true })
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setReactivando(null)
    }
  }

  if (!subdireccionId) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-6 text-center text-sm text-yellow-800">
        Tu cuenta no tiene una subdirección asignada. Contacta al administrador.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {subdirNombre ? `Subdirección ${subdirNombre}` : 'Mi Subdirección'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestiona las secciones de tu subdirección.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal('nueva')}
          className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nueva sección
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-16"><Spinner className="text-blue-900" /></div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {secciones.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-gray-500 mb-3">No hay secciones registradas aún.</p>
              <button
                type="button"
                onClick={() => setModal('nueva')}
                className="text-sm text-blue-700 hover:underline"
              >
                Agregar la primera sección
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Sección
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {secciones.map((sec) => (
                  <tr key={sec._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-800 font-medium">{sec.nombre}</td>
                    <td className="px-4 py-3"><BadgeEstado activa={sec.activa} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button
                          type="button"
                          onClick={() => setModal(sec)}
                          className="text-xs text-blue-700 hover:underline"
                        >
                          Editar
                        </button>
                        {sec.activa ? (
                          <button
                            type="button"
                            disabled={desactivando === sec._id}
                            onClick={() => handleDesactivar(sec)}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {desactivando === sec._id ? 'Desactivando...' : 'Desactivar'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={reactivando === sec._id}
                            onClick={() => handleReactivar(sec)}
                            className="text-xs text-emerald-600 hover:underline disabled:opacity-50"
                          >
                            {reactivando === sec._id ? 'Reactivando...' : 'Reactivar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modal !== null && subdireccionId && (
        <ModalSeccion
          seccion={modal === 'nueva' ? undefined : modal}
          subdirecciones={[]}
          subdireccionFija={subdireccionId}
          onGuardado={() => { setModal(null); cargar() }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}

// ===========================================================
// Vista Admin: tabs
// ===========================================================

type TabAdmin = 'subdirecciones' | 'secciones'

function VistaAdmin() {
  const [tab, setTab] = useState<TabAdmin>('subdirecciones')

  const tabs: { id: TabAdmin; label: string }[] = [
    { id: 'subdirecciones', label: 'Subdirecciones' },
    { id: 'secciones', label: 'Secciones' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Áreas</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-blue-900 text-blue-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'subdirecciones' && <TabSubdirecciones />}
      {tab === 'secciones' && <TabSecciones />}
    </div>
  )
}

// ===========================================================
// Página principal — despacha según rol
// ===========================================================

export function DireccionesGenerales() {
  const { tieneRol } = useAuth()

  if (tieneRol('subdirector')) {
    return <VistaSubdirector />
  }

  return <VistaAdmin />
}
