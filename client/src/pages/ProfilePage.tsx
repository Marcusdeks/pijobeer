/**
 * MI PERFIL (antes perfil.htm + perfil.js): cambiar nombre y/o contraseña.
 *
 * Siempre se pide la contraseña actual para confirmar (lo exige el servidor).
 * El aviso de resultado recibe el foco y desaparece a los 5 segundos.
 */
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_PATTERN_HTML,
  type UpdateProfileResponse,
  type UserDto,
} from '@pijobeer/shared';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { usersApi } from '../api/endpoints';
import { useErrorMessage } from '../api/useErrorMessage';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { FormField } from '../components/ui/FormField';
import { Panel } from '../components/ui/Panel';
import { RequireAuth } from '../features/auth/RequireAuth';
import { useAuth } from '../features/auth/useAuth';
import forms from '../styles/forms.module.css';

const MESSAGE_DURATION_MS = 5000;

export function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}

function ProfileForm() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuth();
  const errorMessage = useErrorMessage();

  // RequireAuth garantiza que aquí siempre hay usuario; el "as" se lo indica a TypeScript
  const current = user as UserDto;

  const [username, setUsername] = useState(current.username);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* Una frase entera por caso, en vez de pegar trozos: en español el
     participio concuerda en género ("nombre cambiadO", "contraseña cambiadA")
     y otros idiomas tienen sus propias reglas. */
  function successText(changed: UpdateProfileResponse['changed']): string {
    if (changed.length === 2) return t('profile.updated.both');
    return changed[0] === 'username'
      ? t('profile.updated.username')
      : t('profile.updated.password');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== newPasswordConfirm) {
      setMessage({ type: 'error', text: t('profile.passwordsMismatch') });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await usersApi.updateProfile({
        currentPassword,
        username,
        newPassword,
        newPasswordConfirm,
      });

      // Actualizamos la sesión global: cualquier sitio que muestre el nombre se entera al momento
      updateUser(result.user);
      setMessage({ type: 'success', text: successText(result.changed) });

      // No dejamos contraseñas escritas en pantalla
      setNewPassword('');
      setNewPasswordConfirm('');
      setCurrentPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: errorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Panel size="narrow">
      <h2 className={forms.title}>{t('profile.title')}</h2>

      {message && (
        <Alert
          type={message.type}
          autoDismissMs={MESSAGE_DURATION_MS}
          onDismiss={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <FormField
          label={t('profile.username')}
          hint={t('auth.usernameHint', { min: USERNAME_MIN_LENGTH, max: USERNAME_MAX_LENGTH })}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={USERNAME_MIN_LENGTH}
          maxLength={USERNAME_MAX_LENGTH}
          pattern={USERNAME_PATTERN_HTML}
          autoComplete="username"
          required
        />
        {/* El email se enseña pero no se puede cambiar: exigiría volver a verificarlo */}
        <FormField
          label={t('profile.email')}
          type="email"
          value={current.email}
          disabled
          readOnly
        />

        <hr className={forms.separator} />
        <p className={forms.note}>{t('profile.passwordNote')}</p>

        <FormField
          label={t('profile.newPassword')}
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
        />
        <FormField
          label={t('profile.newPasswordRepeat')}
          type="password"
          value={newPasswordConfirm}
          onChange={(e) => setNewPasswordConfirm(e.target.value)}
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
        />

        <hr className={forms.separator} />

        <FormField
          label={t('profile.currentPassword')}
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <Button type="submit" fullWidth className={forms.submit} disabled={isSubmitting}>
          {t('profile.save')}
        </Button>
      </form>
    </Panel>
  );
}
