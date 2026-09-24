import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pwaRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../pwa')

function servePwa() {
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
  }

  const middleware = (req, res, next) => {
    if (!req.url?.startsWith('/pwa/')) return next()
    const requested = req.url.slice('/pwa/'.length).split('?')[0] || 'index.html'
    const filePath = path.resolve(pwaRoot, requested)
    if (!filePath.startsWith(pwaRoot) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return next()
    res.setHeader('Content-Type', contentTypes[path.extname(filePath)] || 'application/octet-stream')
    res.end(fs.readFileSync(filePath))
  }

  return {
    name: 'serve-existing-pwa',
    configureServer(server) { server.middlewares.use(middleware) },
    configurePreviewServer(server) { server.middlewares.use(middleware) },
  }
}

export default defineConfig({
  plugins: [react(), servePwa()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    }
  }
})
