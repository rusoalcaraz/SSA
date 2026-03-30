import { useState, useEffect, useCallback } from 'react'
import type { DireccionGeneral } from '../../types'
import { catalogosService } from '../../services/catalogos.service'
import { mensajeDeError } from '../../services/api'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'

// -------------------------------------------------------
// Modal crear / editar DG
// -------------------------------------------------------
function ModalDG({
  dg,
  onGuardado,
  onClose,
}: {
  dg?: DireccionGeneral
  onGuardado: () => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    nombre: dg?.nombre ?? '',
    siglas: dg?.siglas ?? '',
    descripcion: dg?.descripcion ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setErrorMsg(null)
    try {
      if (dg) {
        await catalogosService.actualizarDG(dg._id, {
          nombre: form.nombre,
          siglas: form.siglas,
          descripcion: form.descripcion || undefined,
        })
      } else {
        await catalogosService.crearDG({
          nombre: form.nombre,
          siglas: form.siglas,
          descripcion: form.descripcion || undefined,
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
    <Modal titulo={dg ? 'Editar Direccion General' : 'Nueva Direccion General'} onClose={onClose}>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Siglas <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={10}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase focus:outline-none focus:ring-1 focus:ring-blue-900"
            value={form.siglas}
            onChange={(e) => setForm((f) => ({ ...f, siglas: e.target.value.toUpperCase() }))}
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
            {guardando ? 'Guardando...' : dg ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// -------------------------------------------------------
// Pagina principal
// -------------------------------------------------------
export function DireccionesGenerales() {
  const [dgs, setDgs] = useState<DireccionGeneral[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [modalDG, setModalDG] = useState<DireccionGeneral | null | 'nueva'>(null)
  const [desactivando, setDesactivando] = useState<string | null>(null)

  const cargar = useCallback(() => {
    setCargando(true)
    catalogosService
      .listarDGs(false)
      .then(setDgs)
      .catch((err) => setErrorMsg(mensajeDeError(err)))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => { cargar() }, [cargar])

  async function handleDesactivar(dg: DireccionGeneral) {
    if (!confirm(`¿Desactivar "${dg.nombre}"? Los usuarios DGT de esta DG quedaran sin asignacion.`)) return
    setDesactivando(dg._id)
    try {
      await catalogosService.desactivarDG(dg._id)
      cargar()
    } catch (err) {
      setErrorMsg(mensajeDeError(err))
    } finally {
      setDesactivando(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Direcciones Generales</h1>
        <button
          type="button"
          onClick={() => setModalDG('nueva')}
          className="px-4 py-2 text-sm rounded-md bg-blue-900 text-white hover:bg-blue-800 transition-colors"
        >
          Nueva DG
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {errorMsg}
        </div>
      )}

      {cargando ? (
        <div className="flex justify-center py-20">
          <Spinner className="text-blue-900" />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {dgs.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">Sin direcciones generales registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Siglas</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Descripcion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dgs.map((dg) => (
                  <tr key={dg._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-gray-800">{dg.siglas}</td>
                    <td className="px-4 py-3 text-gray-800">{dg.nombre}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{dg.descripcion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          dg.activa
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {dg.activa ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setModalDG(dg)}
                          className="text-xs text-blue-700 hover:underline"
                        >
                          Editar
                        </button>
                        {dg.activa && (
                          <button
                            type="button"
                            disabled={desactivando === dg._id}
                            onClick={() => handleDesactivar(dg)}
                            className="text-xs text-red-600 hover:underline disabled:opacity-50"
                          >
                            {desactivando === dg._id ? 'Desactivando...' : 'Desactivar'}
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

      {(modalDG === 'nueva' || (modalDG && modalDG !== 'nueva')) && (
        <ModalDG
          dg={modalDG !== 'nueva' ? (modalDG as DireccionGeneral) : undefined}
          onGuardado={() => {
            setModalDG(null)
            cargar()
          }}
          onClose={() => setModalDG(null)}
        />
      )}
    </div>
  )
}
