import {tanstackStart} from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [
    // The Start plugin must come before the React plugin.
    tanstackStart(),
    viteReact(),
  ],
})
