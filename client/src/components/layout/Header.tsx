/**
 * CABECERA: logo, zona de sesión y selector de idioma.
 *
 * La zona de sesión es la evolución de aplicarEstadoSesion() de sesion.js:
 *   - Sin sesión -> enlace "Iniciar Sesión"
 *   - Con sesión -> "Mi Perfil" + botón "Salir"
 * Pero ahora no hay que reescribir innerHTML a mano: el componente dice QUÉ
 * se ve según el estado, y React se encarga de actualizarlo cuando cambia.
 */
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { BRAND } from '../../brand';
import { useAuth } from '../../features/auth/useAuth';
import { ROUTES } from '../../routes';
import styles from './Header.module.css';
import { LanguageSelector } from './LanguageSelector';

export function Header() {
  const { t } = useTranslation();
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const headerRef = useRef<HTMLElement>(null);

  /* La cabecera se queda fija arriba (sticky) y tapa esa parte de la ventana.
     Su altura real se publica en la variable CSS --header-height para que las
     páginas puedan descontarla (p. ej. PlayPage, al centrar el juego en la zona
     visible). Cambia con el ancho de la pantalla, por eso se vigila con un
     ResizeObserver en vez de escribirla a mano. */
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() =>
      root.style.setProperty('--header-height', `${header.offsetHeight}px`),
    );
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  async function handleLogout() {
    await logout();
    // A la portada: si estábamos en "Puntuación" o "Perfil", sin sesión no tienen sentido
    navigate(ROUTES.home);
  }

  return (
    <header ref={headerRef} className={styles.header}>
      <div className={styles.container}>
        <Link to={ROUTES.home} className={styles.logo}>
          {BRAND.game}
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

          <LanguageSelector />
        </div>
      </div>
    </header>
  );
}
