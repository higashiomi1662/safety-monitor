import { defineConfig } from 'vitest/config'

process.env.TZ = 'Asia/Tokyo'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
