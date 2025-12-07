import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  server: {
    proxy: {
      '/api/osm-proxy': {
        target: 'https://minftvflekxdoiubeujy.supabase.co/functions/v1/osm-proxy',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/osm-proxy/, '')
      }
    }
  }
})