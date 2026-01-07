import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // @ts-expect-error -- envFile is supported by Vite inline config but missing from the type defs
  envFile: false,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
  },
})


