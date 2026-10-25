/**
 * CABECERA: logo, zona de sesión y selector de idioma.
 *
 * La zona de sesión es la evolución de aplicarEstadoSesion() de sesion.js:
 *   - Sin sesión -> enlace "Iniciar Sesión"
 *   - Con sesión -> "Mi Perfil" + botón "Salir"
 * Pero ahora no hay que reescribir innerHTML a mano: el componente dice QUÉ
 * se ve según el estado, y React se encarga de actualizarlo cuando cambia.
 */
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { MusicToggle } from '../../audio/MusicToggle';
import { useAuth } from '../../features/auth/useAuth';
import { ROUTES } from '../../routes';
import styles from './Header.module.css';
import { LanguageSelector } from './LanguageSelector';

export function Header() {
  const { t } = useTranslation();
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    // A la portada: si estábamos en "Puntuación" o "Perfil", sin sesión no tienen sentido
    navigate(ROUTES.home);
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link to={ROUTES.home} className={styles.logo}>
          Pijo Beer
        </Link>

        <div className={styles.right}>
          {/* Mientras se consulta la sesión no pintamos nada, para evitar
              que "Iniciar Sesión" parpadee un instante antes de "Mi Perfil" */}
          {!isLoading &&
            (user ? (
              <>
                <Link to={ROUTES.profile} className={styles.navItem}>
                  {t('nav.profile')}
                </Link>
                <button type="button" className={styles.logout} onClick={handleLogout}>
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <Link to={ROUTES.login} className={styles.navItem}>
                {t('nav.login')}
              </Link>
            ))}

          <MusicToggle />
          <LanguageSelector />
        </div>
      </div>
    </header>
  );
}
