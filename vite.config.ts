import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' + HashRouter → the build runs from any path, e.g. username.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
