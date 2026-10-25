import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { ROUTES } from '../routes';
import styles from './HomePage.module.css';

/** PORTADA (antes index.htm). */
export function HomePage() {
  const { t } = useTranslation();

  return (
    <Panel className={styles.intro}>
      <h1 className={styles.title}>{t('home.title')}</h1>
      <p className={styles.description}>{t('home.description')}</p>
      <Button as="link" to={ROUTES.play}>
        {t('home.cta')}
      </Button>
    </Panel>
  );
}
