import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { patchNotesLocalApiPlugin } from './vite-plugins/patchNotesLocalApiPlugin.ts'
import { backupProjectsLocalApiPlugin } from './vite-plugins/backupProjectsLocalApiPlugin.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    patchNotesLocalApiPlugin(),
    backupProjectsLocalApiPlugin(),
  ],
})
