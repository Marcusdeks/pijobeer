/**
 * JUEGO ADMIN: sección solo para administradores.
 *
 * Dos formas de cambiar los trucos de las partidas de prueba, que comparten
 * el mismo estado (lo que hace una se ve al momento en la otra):
 *   - ModifiersPanel: el panel manual, con sus casillas y deslizadores.
 *   - AgentChat: un chat con el agente de IA, al que se le piden los cambios
 *     en lenguaje natural ("bájame los enemigos a 2").
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
import { AgentChat } from './AgentChat';
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
  /** Sube cuando el agente cambia los trucos: el panel se vuelve a montar con los valores nuevos. */
  const [agentVersion, setAgentVersion] = useState(0);

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
      <div className={styles.columns}>
        <ModifiersPanel key={agentVersion} modifiers={modifiers} onChange={setModifiers} />
        <AgentChat
          onModifiersChange={(updated) => {
            setModifiers(updated);
            setAgentVersion((version) => version + 1);
          }}
        />
      </div>
    </>
  );
}
