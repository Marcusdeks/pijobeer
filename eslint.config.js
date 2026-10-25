/**
 * ESLint: revisa el código en busca de errores y malas prácticas ANTES de
 * ejecutarlo (variables sin usar, promesas sin esperar, hooks de React mal
 * usados...). Se lanza con:  npm run lint
 *
 * Una sola configuración para todo el monorepo, con reglas extra según la carpeta.
 * El formato (comillas, sangrías...) NO lo decide ESLint sino Prettier.
 */
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist', '**/coverage', '**/node_modules', 'server/prisma/migrations'] },

  // Reglas base de JavaScript y TypeScript para todo
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // Variables que empiezan por "_" se pueden dejar sin usar a propósito
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Obliga a "import type" cuando solo se importan tipos (desaparecen al compilar)
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  // ---- Servidor: código Node ----
  {
    files: ['server/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      // En el servidor se usa el logger (pino), nunca console.log suelto
      'no-console': ['error', { allow: ['error'] }],
    },
  },
  {
    // Scripts de terminal (semilla de la BBDD): escriben por consola, es su función
    files: ['server/prisma/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  {
    // "namespace Express" es la forma oficial de ampliar los tipos de Express
    files: ['server/src/types/**/*.d.ts'],
    rules: { '@typescript-eslint/no-namespace': 'off' },
  },

  // ---- Scripts de herramientas del cliente (p. ej. generar sprites): se ejecutan en Node ----
  {
    files: ['client/scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
  },

  // ---- Cliente: código React en el navegador ----
  {
    files: ['client/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      // Las dos reglas de oro de los hooks: no llamarlos dentro de if/bucles y declarar bien sus dependencias
      ...reactHooks.configs.recommended.rules,
      // Para que la recarga en caliente funcione, los archivos de componentes solo exportan componentes
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
);
