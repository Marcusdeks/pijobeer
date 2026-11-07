/**
 * Protege una página solo para administradores (Juego admin, Animaciones).
 *
 * Primero pide sesión (RequireAuth) y después que el usuario sea admin; si no
 * lo es, un aviso de error en lugar del contenido. Como RequireAuth, es solo
 * comodidad visual: la seguridad real la pone el servidor.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '../../components/ui/Alert';
import { RequireAuth } from './RequireAuth';
import { useAuth } from './useAuth';

export function RequireAdmin({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AdminOnly>{children}</AdminOnly>
    </RequireAuth>
  );
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user?.isAdmin) return <Alert type="error">{t('errors.FORBIDDEN')}</Alert>;
  return <>{children}</>;
}
