/**
 * MAPA DE PÁGINAS: qué componente se pinta para cada URL.
 *
 * Todas cuelgan de <Layout>, que pone la cabecera, el menú y el pie.
 * La ruta "*" atrapa cualquier URL que no exista y muestra la página 404.
 *
 * Al cambiar de página NO se recarga nada: React Router cambia el
 * componente y la URL del navegador (los botones atrás/adelante funcionan).
 */
import { createBrowserRouter } from 'react-router';
import { Layout } from './components/layout/Layout';
import { AdminPage } from './pages/AdminPage/AdminPage';
import { ControlsPage } from './pages/ControlsPage';
import { CreditsPage } from './pages/CreditsPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlayPage } from './pages/PlayPage/PlayPage';
import { ProfilePage } from './pages/ProfilePage';
import { ScoresPage } from './pages/ScoresPage/ScoresPage';
import { StoryPage } from './pages/StoryPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { ROUTES } from './routes';

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.story, element: <StoryPage /> },
      { path: ROUTES.play, element: <PlayPage /> },
      { path: ROUTES.controls, element: <ControlsPage /> },
      { path: ROUTES.credits, element: <CreditsPage /> },
      { path: ROUTES.login, element: <LoginPage /> },
      { path: ROUTES.verifyEmail, element: <VerifyEmailPage /> },
      { path: ROUTES.profile, element: <ProfilePage /> },
      { path: ROUTES.scores, element: <ScoresPage /> },
      { path: ROUTES.admin, element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
