import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className={styles.footer}>
      {/* El año se calcula: no hay que acordarse de cambiarlo cada enero */}
      <p>{t('footer.copyright', { year: new Date().getFullYear() })}</p>
    </footer>
  );
}
