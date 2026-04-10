import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'

import { Login } from './pages/Login'
import { SinAcceso } from './pages/SinAcceso'
import { Dashboard } from './pages/Dashboard'

import { ListaProcedimientos } from './pages/procedimientos/ListaProcedimientos'
import { NuevoProcedimiento } from './pages/procedimientos/NuevoProcedimiento'
import { DetalleProcedimiento } from './pages/procedimientos/DetalleProcedimiento'
import { Cronograma } from './pages/procedimientos/Cronograma'
import { HojaTrabajo } from './pages/procedimientos/HojaTrabajo'
import { Entregas } from './pages/procedimientos/Entregas'

import { Reportes } from './pages/Reportes'
import { Usuarios } from './pages/admin/Usuarios'
import { DireccionesGenerales } from './pages/admin/DireccionesGenerales'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Publica */}
          <Route path="/login" element={<Login />} />
          <Route path="/sin-acceso" element={<SinAcceso />} />

          {/* Protegidas: requieren autenticacion */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>

              {/* Redireccion raiz */}
              <Route index element={<Navigate to="/procedimientos" replace />} />

              {/* Dashboard — gerencial y superadmin */}
              <Route
                path="dashboard"
                element={<ProtectedRoute roles={['superadmin', 'gerencial']} />}
              >
                <Route index element={<Dashboard />} />
              </Route>

              {/* Procedimientos */}
              <Route
                path="procedimientos"
                element={
                  <ProtectedRoute
                    roles={['superadmin', 'gerencial', 'area_contratante', 'asesor_tecnico', 'dgt']}
                  />
                }
              >
                <Route index element={<ListaProcedimientos />} />
                <Route
                  path="nuevo"
                  element={<ProtectedRoute roles={['superadmin', 'area_contratante']} />}
                >
                  <Route index element={<NuevoProcedimiento />} />
                </Route>
                {/* DetalleProcedimiento actua como layout: renderiza header + tabs via <Outlet context> */}
                <Route path=":id" element={<DetalleProcedimiento />}>
                  <Route index element={<Navigate to="cronograma" replace />} />
                  <Route path="cronograma" element={<Cronograma />} />
                  <Route path="hoja-trabajo" element={<HojaTrabajo />} />
                  <Route path="entregas" element={<Entregas />} />
                </Route>
              </Route>

              {/* Mis procedimientos — vista propia para roles operativos */}
              <Route
                path="mis-procedimientos"
                element={
                  <ProtectedRoute
                    roles={['superadmin', 'area_contratante', 'asesor_tecnico', 'dgt']}
                  />
                }
              >
                <Route index element={<ListaProcedimientos />} />
              </Route>

              {/* Reportes — superadmin, gerencial, area_contratante */}
              <Route
                path="reportes"
                element={
                  <ProtectedRoute roles={['superadmin', 'gerencial', 'area_contratante']} />
                }
              >
                <Route index element={<Reportes />} />
              </Route>

              {/* Admin — solo superadmin */}
              <Route
                path="admin"
                element={<ProtectedRoute roles={['superadmin']} />}
              >
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="direcciones-generales" element={<DireccionesGenerales />} />
              </Route>

            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
