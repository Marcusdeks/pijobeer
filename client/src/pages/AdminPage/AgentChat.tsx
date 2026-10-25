/**
 * Chat con el agente de "juego admin".
 *
 * La API de Claude no recuerda nada entre peticiones: cada vez se le manda
 * la conversación entera (solo los textos). El primer saludo es solo
 * decorativo y no se envía.
 */
import type { AgentMessage, GameModifiers } from '@pijobeer/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../api/endpoints';
import { useErrorMessage } from '../../api/useErrorMessage';
import { Button } from '../../components/ui/Button';
import { Panel } from '../../components/ui/Panel';
import styles from './AdminPage.module.css';

interface AgentChatProps {
  onModifiersChange: (modifiers: GameModifiers) => void;
}

export function AgentChat({ onModifiersChange }: AgentChatProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Mantiene visible el último mensaje
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages, isThinking]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isThinking) return;

    const conversation: AgentMessage[] = [...messages, { role: 'user', content }];
    setMessages(conversation);
    setDraft('');
    setError(null);
    setIsThinking(true);

    try {
      const res = await adminApi.askAgent({ messages: conversation });
      setMessages([...conversation, { role: 'assistant', content: res.reply }]);
      onModifiersChange(res.modifiers);
    } catch (err) {
      setError(errorMessage(err));
      // Se quita el mensaje que ha fallado para poder reenviarlo sin duplicarlo
      setMessages(messages);
      setDraft(content);
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <Panel variant="accent" className={styles.card}>
      <h3>{t('admin.agentTitle')}</h3>

      <div className={styles.chatLog} ref={logRef} aria-live="polite">
        <p className={`${styles.bubble} ${styles.assistant}`}>{t('admin.agentHello')}</p>
        {messages.map((message, i) => (
          <p key={i} className={`${styles.bubble} ${styles[message.role]}`}>
            {message.content}
          </p>
        ))}
        {isThinking && (
          <p className={`${styles.bubble} ${styles.assistant}`}>{t('admin.thinking')}</p>
        )}
        {error && <p className={`${styles.bubble} ${styles.error}`}>{error}</p>}
      </div>

      <form onSubmit={handleSubmit} className={styles.chatForm}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('admin.agentPlaceholder')}
          maxLength={2000}
          aria-label={t('admin.agentPlaceholder')}
        />
        <Button type="submit" disabled={isThinking || !draft.trim()}>
          {t('admin.send')}
        </Button>
      </form>
    </Panel>
  );
}
