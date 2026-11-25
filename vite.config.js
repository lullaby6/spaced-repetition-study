import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages only serves files that exist: opening or reloading /progress would give its 404 page.
// This plugin copies the built index.html as 404.html, so any unknown path loads the app and React
// Router shows the right screen.
function spaFallback() {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    // After the build has written its files (index.html is only final at that point).
    closeBundle() {
      const index = path.join(outDir, 'index.html')
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(outDir, '404.html'))
    },
  }
}

// Public path of the built site. GitHub Pages serves it under /<repo>/ (set by the workflow via
// VITE_BASE); otherwise the root. It must be absolute: with routes like /progress, relative asset
// paths would break.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  // `npm run dev` and `npm run preview` both start on port 3000.
  server: { port: 3000 },
  preview: { port: 3000 },
})
