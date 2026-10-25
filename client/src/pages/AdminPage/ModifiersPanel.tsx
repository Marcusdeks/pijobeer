/**
 * Panel manual de trucos. Se edita una copia local ("borrador") y se guarda
 * con el botón: así mover un deslizador no lanza una petición por cada píxel.
 *
 * El padre lo monta con una `key` que cambia cuando el AGENTE cambia los
 * trucos: React crea entonces un panel nuevo y el borrador arranca con los
 * valores actualizados. (Al guardar desde el propio panel no hace falta: el
 * borrador ya tiene esos valores.)
 */
import {
  DEFAULT_GAME_MODIFIERS,
  GAME_MODIFIER_LIMITS as LIMITS,
  type GameModifiers,
} from '@pijobeer/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/endpoints';
import { useErrorMessage } from '../../api/useErrorMessage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import styles from './AdminPage.module.css';

interface ModifiersPanelProps {
  modifiers: GameModifiers;
  onChange: (modifiers: GameModifiers) => void;
}

/** Los tres multiplicadores, que se pintan igual (deslizador + valor). */
const MULTIPLIERS = ['enemySpeed', 'spawnRate', 'bossHealth'] as const;

export function ModifiersPanel({ modifiers, onChange }: ModifiersPanelProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState(modifiers);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function save(next: GameModifiers) {
    try {
      const res = await adminApi.updateModifiers(next);
      onChange(res.modifiers);
      setMessage({ type: 'success', text: t('admin.saved') });
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void save(draft);
  }

  return (
    <Panel variant="accent" className={styles.card}>
      <h3>{t('admin.panelTitle')}</h3>
      {message && (
        <Alert type={message.type} autoDismissMs={3000} onDismiss={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={draft.invincible}
            onChange={(e) => setDraft({ ...draft, invincible: e.target.checked })}
          />
          {t('admin.invincible')}
        </label>

        <label className={styles.field}>
          <span>{t('admin.killsToComplete')}</span>
          <input
            type="number"
            min={LIMITS.killsToComplete.min}
            max={LIMITS.killsToComplete.max}
            placeholder={t('admin.killsHint')}
            value={draft.killsToComplete ?? ''}
            onChange={(e) =>
              setDraft({
                ...draft,
                killsToComplete: e.target.value === '' ? null : Number(e.target.value),
              })
            }
          />
        </label>

        {MULTIPLIERS.map((key) => (
          <label key={key} className={styles.field}>
            <span>
              {t(`admin.${key}`)} <strong>×{draft[key].toFixed(2)}</strong>
            </span>
            <input
              type="range"
              min={LIMITS[key].min}
              max={LIMITS[key].max}
              step={0.05}
              value={draft[key]}
              onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
            />
          </label>
        ))}

        <div className={styles.actions}>
          <Button type="submit">{t('admin.save')}</Button>
          <Button variant="ghost" onClick={() => void save(DEFAULT_GAME_MODIFIERS)}>
            {t('admin.reset')}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
