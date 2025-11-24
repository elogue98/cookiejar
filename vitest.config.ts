import { defineConfig } from 'vitest/config'

export default defineConfig({
  // @ts-expect-error -- envFile is supported by Vite inline config but missing from the type defs
  envFile: false,
  test: {
    environment: 'node',
  },
})


