/**
 * MENÚ PRINCIPAL.
 *
 * NavLink (de React Router) sabe en qué página estamos y le pone la clase
 * "activa" al enlace correspondiente. En el original, cada .htm llevaba el
 * class="active" escrito a mano en su copia del menú.
 *
 * Los apartados con `private: true` solo se muestran con sesión iniciada
 * (equivale a la lista "menusPrivados" de sesion.js).
 */
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { useAuth } from '../../features/auth/useAuth';
import { ROUTES } from '../../routes';
import styles from './NavMenu.module.css';

/**
 * Quién ve cada apartado: todo el mundo, solo con sesión iniciada, o solo
 * administradores. (Ocultarlo es comodidad visual: la seguridad real la pone
 * el servidor, que rechaza las peticiones de quien no tiene permiso.)
 */
type Audience = 'everyone' | 'user' | 'admin';

const ITEMS: ReadonlyArray<{ to: string; label: TranslationKey; audience: Audience }> = [
  { to: ROUTES.home, label: 'nav.home', audience: 'everyone' },
  { to: ROUTES.story, label: 'nav.story', audience: 'everyone' },
  { to: ROUTES.play, label: 'nav.play', audience: 'everyone' },
  { to: ROUTES.scores, label: 'nav.scores', audience: 'user' },
  { to: ROUTES.admin, label: 'nav.admin', audience: 'admin' },
  { to: ROUTES.controls, label: 'nav.controls', audience: 'everyone' },
  { to: ROUTES.credits, label: 'nav.credits', audience: 'everyone' },
];

type TranslationKey =
  | 'nav.home'
  | 'nav.story'
  | 'nav.play'
  | 'nav.scores'
  | 'nav.admin'
  | 'nav.controls'
  | 'nav.credits';

export function NavMenu() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const canSee = (audience: Audience) =>
    audience === 'everyone' || (audience === 'user' ? !!user : !!user?.isAdmin);

  return (
    <nav className={styles.menu} aria-label={t('nav.mainMenu')}>
      {ITEMS.filter((item) => canSee(item.audience)).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          // "end": la portada "/" solo cuenta como activa si estamos exactamente en "/"
          end={item.to === ROUTES.home}
          className={({ isActive }) => (isActive ? `${styles.item} ${styles.active}` : styles.item)}
        >
          {t(item.label)}
        </NavLink>
      ))}
    </nav>
  );
}
