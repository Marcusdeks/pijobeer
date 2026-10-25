/**
 * VERIFICAR EMAIL: la página a la que lleva el enlace del correo.
 *
 * URL: /verify-email?token=XXXX
 * Al abrirse, manda el token al servidor y enseña el resultado.
 * (Antes era verificar-email.php, que devolvía un HTML suelto sin el
 * diseño del juego; ahora es una página más, con su cabecera y su idioma).
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { authApi } from '../api/endpoints';
import { useErrorMessage } from '../api/useErrorMessage';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Panel } from '../components/ui/Panel';
import { ROUTES } from '../routes';
import forms from '../styles/forms.module.css';

type State =
  | { status: 'loading' }
  | { status: 'success'; username: string }
  | { status: 'error'; message: string };

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [state, setState] = useState<State>(() =>
    token ? { status: 'loading' } : { status: 'error', message: t('verify.missingToken') },
  );

  /* En desarrollo, React (StrictMode) ejecuta los efectos DOS veces para
     detectar errores. Aquí eso sería un problema real: la segunda petición
     fallaría porque el token ya se ha usado. La ref evita el doble envío. */
  const alreadySent = useRef(false);

  useEffect(() => {
    if (!token || alreadySent.current) return;
    alreadySent.current = true;

    authApi
      .verifyEmail(token)
      .then(({ username }) => setState({ status: 'success', username }))
      .catch((err: unknown) => setState({ status: 'error', message: errorMessage(err) }));
  }, [token, errorMessage]);

  return (
    <Panel size="narrow">
      {state.status === 'loading' && <p className={forms.secondary}>{t('verify.verifying')}</p>}

      {state.status === 'success' && (
        <>
          <h2 className={forms.title}>{t('verify.success')}</h2>
          <Alert type="success">{t('verify.successText', { username: state.username })}</Alert>
        </>
      )}

      {state.status === 'error' && <Alert type="error">{state.message}</Alert>}

      {state.status !== 'loading' && (
        <Button as="link" to={ROUTES.login} fullWidth>
          {t('verify.goLogin')}
        </Button>
      )}
    </Panel>
  );
}
