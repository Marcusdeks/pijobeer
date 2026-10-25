/**
 * Protege una página que solo tiene sentido con sesión (Perfil, Puntuación).
 *
 *   <RequireAuth hint={t('scores.hint')}>
 *     <ScoresContent />
 *   </RequireAuth>
 *
 * - Mientras se comprueba la sesión: "Cargando...".
 * - Sin sesión: el aviso "Necesitas iniciar sesión" con su enlace.
 * - Con sesión: el contenido.
 *
 * Importante: esto es solo COMODIDAD visual. La seguridad real está en el
 * servidor (requireAuth): aunque alguien se saltara este componente, la API
 * respondería 401 y no le daría ningún dato.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Panel } from '../../components/ui/Panel';
import { ROUTES } from '../../routes';
import styles from './RequireAuth.module.css';
import { useAuth } from './useAuth';

interface RequireAuthProps {
  children: ReactNode;
  /** Explicación extra bajo el título (opcional). */
  hint?: string;
}

export function RequireAuth({ children, hint }: RequireAuthProps) {
  const { t } = useTranslation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (!user) {
    return (
      <Panel size="narrow">
        <h2 className={styles.title}>{t('guard.title')}</h2>
        <p className={styles.text}>
          {hint && <>{hint} </>}
          <Link to={ROUTES.login}>{t('guard.link')}</Link>
        </p>
      </Panel>
    );
  }

  return <>{children}</>;
}
