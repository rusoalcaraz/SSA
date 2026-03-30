import { useNavigate } from 'react-router-dom'

export function SinAcceso() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
      <h1 className="text-3xl font-bold text-gray-800">403</h1>
      <p className="text-gray-500">No tiene permisos para acceder a esta seccion.</p>
      <button
        onClick={() => navigate(-1)}
        className="px-4 py-2 text-sm bg-blue-900 text-white rounded-md hover:bg-blue-800 transition-colors"
      >
        Volver
      </button>
    </div>
  )
}
