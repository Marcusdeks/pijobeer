/**
 * PUNTO DE ENTRADA DEL CLIENTE.
 *
 * Monta la aplicación React dentro de <div id="root"> (index.html) con sus
 * "proveedores": piezas que envuelven toda la app para dar servicio a
 * cualquier componente de dentro.
 *
 *   StrictMode     -> solo en desarrollo: avisa de malas prácticas
 *   AuthProvider   -> la sesión del jugador (useAuth)
 *   RouterProvider -> qué página toca según la URL
 *
 * El orden importa: AuthProvider va FUERA del router para que la sesión
 * no se pierda al cambiar de página.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './features/auth/AuthProvider';
import './i18n'; // inicializa i18next antes de pintar nada
import { router } from './router';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('No se encuentra el elemento #root en index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
