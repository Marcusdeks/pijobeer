import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN_HTML,
} from '@pijobeer/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../../api/endpoints';
import { useErrorMessage } from '../../api/useErrorMessage';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormField } from '../../components/ui/FormField';
import forms from '../../styles/forms.module.css';

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

const EMPTY_FORM = { username: '', email: '', password: '', passwordConfirm: '' };

type Result = { type: 'error'; text: string } | { type: 'success'; text: string; devUrl?: string };

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState<Result | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Actualiza un solo campo del formulario sin tocar los demás. */
  function update(field: keyof typeof EMPTY_FORM, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Aviso inmediato; el servidor lo vuelve a comprobar por si alguien se salta este código
    if (form.password !== form.passwordConfirm) {
      setResult({ type: 'error', text: t('auth.passwordsMismatch') });
      return;
    }

    setIsSubmitting(true);
    try {
      const { devVerificationUrl } = await authApi.register(form);
      setResult({ type: 'success', text: t('auth.registered'), devUrl: devVerificationUrl });
      // Limpiamos el formulario para no dejar la contraseña escrita en pantalla
      setForm(EMPTY_FORM);
    } catch (err) {
      setResult({ type: 'error', text: errorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h2 className={forms.title}>{t('auth.registerTitle')}</h2>

      {result && (
        <Alert type={result.type}>
          {result.text}
          {/* SOLO EN DESARROLLO: el servidor manda el enlace porque no se envían
              correos reales. En producción nunca llega, así que esto no se pinta. */}
          {result.type === 'success' && result.devUrl && (
            <>
              <br />
              <br />
              <a href={result.devUrl}>{t('auth.devVerifyLink')}</a>
            </>
          )}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        {/* Las reglas (minLength, pattern...) vienen del paquete compartido:
            son exactamente las mismas que comprueba el servidor */}
        <FormField
          label={t('auth.username')}
          hint={t('auth.usernameHint', { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })}
          value={form.username}
          onChange={(e) => update('username', e.target.value)}
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          pattern={USERNAME_PATTERN_HTML}
          autoComplete="username"
          required
        />
        <FormField
          label={t('auth.email')}
          type="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          autoComplete="email"
          required
        />
        <FormField
          label={t('auth.password')}
          hint={t('auth.passwordHint', { min: PASSWORD_MIN_LENGTH })}
          type="password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          required
        />
        <FormField
          label={t('auth.passwordRepeat')}
          type="password"
          value={form.passwordConfirm}
          onChange={(e) => update('passwordConfirm', e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          required
        />
        <Button type="submit" fullWidth className={forms.submit} disabled={isSubmitting}>
          {t('auth.registerSubmit')}
        </Button>
      </form>

      <p className={forms.secondary}>
        {t('auth.haveAccount')}{' '}
        <button type="button" className={forms.linkButton} onClick={onSwitchToLogin}>
          {t('auth.goLogin')}
        </button>
      </p>
    </>
  );
}
