import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './hooks/useAuth'
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

function InicioRedirect() {
  const { tieneRol } = useAuth()

  if (tieneRol('administrador', 'adquisiciones', 'subdirector', 'jefe_seccion')) {
    return <Navigate to="/dashboard" replace />
  }

  if (tieneRol('asesor_tecnico')) {
    return <Navigate to="/mis-procedimientos" replace />
  }

  return <Navigate to="/procedimientos" replace />
}

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
              <Route index element={<InicioRedirect />} />

              {/* Dashboard global */}
              <Route
                path="dashboard"
                element={<ProtectedRoute roles={['administrador', 'adquisiciones', 'subdirector', 'jefe_seccion']} />}
              >
                <Route index element={<Dashboard />} />
              </Route>

              {/* Procedimientos */}
              <Route
                path="procedimientos"
                element={
                  <ProtectedRoute
                    roles={[
                      'administrador',
                      'adquisiciones',
                      'subdirector',
                      'jefe_seccion',
                      'asesor_tecnico',
                    ]}
                  />
                }
              >
                <Route index element={<ListaProcedimientos />} />
                <Route
                  path="nuevo"
                  element={<ProtectedRoute roles={['administrador', 'adquisiciones', 'subdirector']} />}
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

              {/* Mis procedimientos — vista propia para asesores */}
              <Route
                path="mis-procedimientos"
                element={
                  <ProtectedRoute
                    roles={['asesor_tecnico']}
                  />
                }
              >
                <Route index element={<ListaProcedimientos />} />
              </Route>

              <Route
                path="linea-del-tiempo"
                element={<Navigate to="/procedimientos" replace />}
              />

              {/* Reportes */}
              <Route
                path="reportes"
                element={
                  <ProtectedRoute
                    roles={[
                      'administrador',
                      'adquisiciones',
                      'subdirector',
                      'jefe_seccion',
                    ]}
                  />
                }
              >
                <Route index element={<Reportes />} />
              </Route>

              {/* Administracion */}
              <Route path="admin" element={<ProtectedRoute />}>
                <Route
                  path="usuarios"
                  element={
                    <ProtectedRoute
                      roles={[
                        'administrador',
                        'adquisiciones',
                        'subdirector',
                        'jefe_seccion',
                      ]}
                    />
                  }
                >
                  <Route index element={<Usuarios />} />
                </Route>
                <Route
                  path="areas"
                  element={<ProtectedRoute roles={['administrador', 'subdirector']} />}
                >
                  <Route index element={<DireccionesGenerales />} />
                </Route>
                <Route
                  path="direcciones-generales"
                  element={<Navigate to="/admin/areas" replace />}
                />
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
