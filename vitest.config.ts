import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    env: {
      DATABASE_URL: 'postgres://user:pass@localhost/test',
      EVOLUTION_API_URL: 'https://example.com',
      EVOLUTION_API_KEY: 'test-key',
      EVOLUTION_INSTANCE: 'test-instance',
    },
  },
})
