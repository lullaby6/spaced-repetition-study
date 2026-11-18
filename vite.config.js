import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Public path of the built site. GitHub Pages serves it under /<repo>/ (set by the workflow via
// VITE_BASE); otherwise relative paths, so the build works from any folder.
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react(), tailwindcss()],
})
