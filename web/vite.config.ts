import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// `npm run dev:https` serves over https with a self-signed certificate, so phones on the same Wi-Fi get a
// secure address — browsers only allow copying pictures and sharing files on https (or localhost).
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'https' ? [basicSsl()] : [])],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
}))
