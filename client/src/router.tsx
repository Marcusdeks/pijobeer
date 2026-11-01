/**
 * MAPA DE PÁGINAS: qué componente se pinta para cada URL.
 *
 * Todas cuelgan de <Layout>, que pone la cabecera, el menú y el pie.
 * La ruta "*" atrapa cualquier URL que no exista y muestra la página 404.
 *
 * Al cambiar de página NO se recarga nada: React Router cambia el
 * componente y la URL del navegador (los botones atrás/adelante funcionan).
 *
 * DIVISIÓN DEL CÓDIGO (code splitting): cada página, salvo Inicio y la 404,
 * se carga con `lazy` solo cuando alguien la visita. Vite la compila en un
 * archivo JS aparte, así que quien entra en Inicio no se descarga el motor del
 * juego, los sprites ni el panel de admin. React Router espera a tener el
 * archivo antes de cambiar de página, por eso no hace falta <Suspense>.
 * Inicio y la 404 van en el paquete principal: la primera es por donde entra
 * casi todo el mundo y la segunda es diminuta.
 */
import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ROUTES } from './routes';

/**
 * Adapta un import dinámico al formato que pide `lazy` ({ Component }).
 * @param load - el import() de la página (Vite lo convierte en un archivo aparte)
 * @param name - el nombre con el que el módulo exporta el componente
 */
function lazyPage<Name extends string>(
  load: () => Promise<Record<Name, ComponentType>>,
  name: Name,
) {
  return async () => ({ Component: (await load())[name] });
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    // Lo que se ve si se entra directamente por la URL de una página que aún no
    // ha llegado: nada, son unos milisegundos (y evita un aviso de React Router)
    HydrateFallback: () => null,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.story, lazy: lazyPage(() => import('./pages/StoryPage'), 'StoryPage') },
      { path: ROUTES.play, lazy: lazyPage(() => import('./pages/PlayPage/PlayPage'), 'PlayPage') },
      {
        path: ROUTES.controls,
        lazy: lazyPage(() => import('./pages/ControlsPage'), 'ControlsPage'),
      },
      { path: ROUTES.credits, lazy: lazyPage(() => import('./pages/CreditsPage'), 'CreditsPage') },
      {
        path: ROUTES.login,
        lazy: lazyPage(() => import('./pages/LoginPage/LoginPage'), 'LoginPage'),
      },
      {
        path: ROUTES.verifyEmail,
        lazy: lazyPage(() => import('./pages/VerifyEmailPage'), 'VerifyEmailPage'),
      },
      { path: ROUTES.profile, lazy: lazyPage(() => import('./pages/ProfilePage'), 'ProfilePage') },
      {
        path: ROUTES.scores,
        lazy: lazyPage(() => import('./pages/ScoresPage/ScoresPage'), 'ScoresPage'),
      },
      {
        path: ROUTES.admin,
        lazy: lazyPage(() => import('./pages/AdminPage/AdminPage'), 'AdminPage'),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
