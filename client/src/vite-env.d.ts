/// <reference types="vite/client" />

/**
 * Tipos de los CSS Modules: "import styles from './X.module.css'" devuelve
 * un objeto { nombreDeClase: 'nombreDeClase_hash' }. Vite añade el hash para
 * que las clases de cada componente sean únicas en toda la aplicación.
 * (vite/client ya lo declara; esta referencia lo activa en TypeScript).
 */
