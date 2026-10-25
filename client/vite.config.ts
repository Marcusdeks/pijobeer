/**
 * Configuración de Vite: el servidor de desarrollo y el empaquetador del cliente.
 *
 *   npm run dev    -> http://localhost:5173 con recarga instantánea al guardar
 *   npm run build  -> genera client/dist, la versión optimizada para producción
 */
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    /* PROXY: el navegador habla SOLO con localhost:5173, y Vite reenvía al
       servidor (localhost:3000) todo lo que empiece por /api.

       Por qué: para el navegador, cliente y API están en el mismo origen.
       Así la cookie de sesión funciona sin configurar CORS, igual que
       funcionará en producción, donde el servidor Node sirve ambas cosas. */
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },

  test: {
    // Los tests del motor del juego no necesitan navegador: es TypeScript puro
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
