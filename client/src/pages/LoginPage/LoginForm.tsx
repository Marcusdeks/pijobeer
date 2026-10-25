import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useErrorMessage } from '../../api/useErrorMessage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import { useAuth } from '../../features/auth/useAuth';
import { ROUTES } from '../../routes';
import forms from '../../styles/forms.module.css';

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Desactiva el botón mientras se espera al servidor: evita envíos dobles
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // sin esto el navegador recargaría la página
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ identifier, password });
      // Sesión iniciada: a la portada. Sin recargar: la cabecera ya muestra "Mi Perfil"
      navigate(ROUTES.home);
    } catch (err) {
      setError(errorMessage(err));
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h2 className={forms.title}>{t('auth.loginTitle')}</h2>
      {error && <Alert type="error">{error}</Alert>}

      <form onSubmit={handleSubmit}>
        <FormField
          label={t('auth.identifier')}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
          required
        />
        <FormField
          label={t('auth.password')}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" fullWidth className={forms.submit} disabled={isSubmitting}>
          {t('auth.loginSubmit')}
        </Button>
      </form>

      <p className={forms.secondary}>
        {t('auth.noAccount')}{' '}
        <button type="button" className={forms.linkButton} onClick={onSwitchToRegister}>
          {t('auth.goRegister')}
        </button>
      </p>
    </>
  );
}
