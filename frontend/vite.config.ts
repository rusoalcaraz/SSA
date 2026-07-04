import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const puertoFrontend = Number.parseInt(env.VITE_PORT || '3000', 10)
  const targetBackend = env.VITE_API_TARGET || 'http://localhost:4000'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: puertoFrontend,
      proxy: {
        '/api': {
          target: targetBackend,
          changeOrigin: true,
        },
      },
    },
  }
})
