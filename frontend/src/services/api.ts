import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const BASE_URL = '/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // incluir cookie HttpOnly del refresh token
})

// -------------------------------------------------------
// Interceptor de solicitud: inyecta el Authorization header
// -------------------------------------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// -------------------------------------------------------
// Interceptor de respuesta: maneja token expirado (401)
// -------------------------------------------------------
let estaRefrescando = false
let colaEnEspera: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const solicitudOriginal = error.config as InternalAxiosRequestConfig & { _reintentado?: boolean }

    if (
      error.response?.status === 401 &&
      !solicitudOriginal._reintentado &&
      !solicitudOriginal.url?.includes('/auth/refresh') &&
      !solicitudOriginal.url?.includes('/auth/login')
    ) {
      solicitudOriginal._reintentado = true

      if (estaRefrescando) {
        // Encolar la solicitud hasta que el refresh termine
        return new Promise((resolve, reject) => {
          colaEnEspera.push({ resolve, reject })
        }).then((nuevoToken) => {
          solicitudOriginal.headers.Authorization = `Bearer ${nuevoToken}`
          return api(solicitudOriginal)
        })
      }

      estaRefrescando = true

      try {
        const { data } = await api.post<{ success: boolean; data: { accessToken: string } }>(
          '/auth/refresh'
        )
        const nuevoToken = data.data.accessToken
        setAccessToken(nuevoToken)

        colaEnEspera.forEach(({ resolve }) => resolve(nuevoToken))
        colaEnEspera = []

        solicitudOriginal.headers.Authorization = `Bearer ${nuevoToken}`
        return api(solicitudOriginal)
      } catch (errRefresh) {
        colaEnEspera.forEach(({ reject }) => reject(errRefresh))
        colaEnEspera = []
        // Forzar logout — guardar razon para mostrarla en login
        clearAccessToken()
        const codigoError = (errRefresh as AxiosError<{ error?: { code?: string } }>)?.response?.data?.error?.code
        if (codigoError === 'SESION_INACTIVA') {
          sessionStorage.setItem('sesion_cerrada_por', 'inactividad')
        }
        window.location.href = '/login'
        return Promise.reject(errRefresh)
      } finally {
        estaRefrescando = false
      }
    }

    return Promise.reject(error)
  }
)

// -------------------------------------------------------
// Gestion del access token en memoria (no localStorage)
// -------------------------------------------------------
let _accessToken: string | null = null

export function getAccessToken(): string | null {
  return _accessToken
}

export function setAccessToken(token: string): void {
  _accessToken = token
}

export function clearAccessToken(): void {
  _accessToken = null
}

// -------------------------------------------------------
// Helper: extrae el mensaje de un error de Axios
// -------------------------------------------------------
export function mensajeDeError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? error.message
  }
  if (error instanceof Error) return error.message
  return 'Error desconocido'
}
