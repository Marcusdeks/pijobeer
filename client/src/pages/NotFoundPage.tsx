import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { ROUTES } from '../routes';
import forms from '../styles/forms.module.css';

/** 404: cualquier URL que no corresponde a ninguna página. */
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Panel size="narrow">
      <h2 className={forms.title}>{t('notFound.title')}</h2>
      <Button as="link" to={ROUTES.home} fullWidth>
        {t('notFound.back')}
      </Button>
    </Panel>
  );
}
