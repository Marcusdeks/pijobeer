/**
 * JUEGO ADMIN: sección solo para administradores, con el panel de trucos de
 * sus partidas de prueba (ver ModifiersPanel).
 */
import type { GameModifiers } from '@pijobeer/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/endpoints';
import { useErrorMessage } from '../../api/useErrorMessage';
import { Alert } from '../../components/ui/Alert';
import { Panel } from '../../components/ui/Panel';
import { RequireAuth } from '../../features/auth/RequireAuth';
import { useAuth } from '../../features/auth/useAuth';
import styles from './AdminPage.module.css';
import { ModifiersPanel } from './ModifiersPanel';

export function AdminPage() {
  return (
    <RequireAuth>
      <AdminOnly />
    </RequireAuth>
  );
}

function AdminOnly() {
  const { t } = useTranslation();
  const { user } = useAuth();
  if (!user?.isAdmin) return <Alert type="error">{t('errors.FORBIDDEN')}</Alert>;
  return <AdminContent />;
}

function AdminContent() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [modifiers, setModifiers] = useState<GameModifiers | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .getModifiers()
      .then((res) => setModifiers(res.modifiers))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [errorMessage]);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!modifiers) return <p>{t('common.loading')}</p>;

  return (
    <>
      <Panel variant="accent">
        <h2>{t('admin.title')}</h2>
        <p className={styles.intro}>{t('admin.intro')}</p>
      </Panel>
      <ModifiersPanel modifiers={modifiers} onChange={setModifiers} />
    </>
  );
}
