import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Las variables mínimas para que config/env.ts valide sin un .env real.
    // Los tests NO tocan PostgreSQL: usan repositorios en memoria (ver tests/helpers).
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      JWT_SECRET: 'test-secret-de-al-menos-32-caracteres-de-largo',
      CLIENT_URL: 'http://localhost:5173',
      LOG_LEVEL: 'silent',
    },
  },
});
