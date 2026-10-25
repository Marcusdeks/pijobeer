import { useTranslation } from 'react-i18next';
import { Panel } from '../components/ui/Panel';

/** CRÉDITOS (antes creditos.htm). */
export function CreditsPage() {
  const { t } = useTranslation();

  return (
    <Panel variant="accent">
      <h2>{t('credits.title')}</h2>
      <p>{t('credits.design')}</p>
      <p>{t('credits.music')}</p>
      <p>{t('credits.stack')}</p>
      <p>{t('credits.translations')}</p>
    </Panel>
  );
}
