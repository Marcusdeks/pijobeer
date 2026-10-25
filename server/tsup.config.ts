/**
 * Configuración del empaquetado para producción (npm run build).
 *
 * tsup (basado en esbuild) convierte el TypeScript en un único JavaScript
 * en dist/index.js, listo para ejecutarse con "node".
 *
 * "noExternal" mete DENTRO del paquete final el código de @pijobeer/shared:
 * ese paquete se distribuye como TypeScript sin compilar, así que Node no
 * podría importarlo directamente en producción.
 */
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@pijobeer/shared'],
});
