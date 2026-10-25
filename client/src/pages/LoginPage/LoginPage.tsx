/**
 * INICIAR SESIÓN / CREAR CUENTA (antes login.htm + login.js).
 *
 * Una sola página con dos formularios que se alternan, como el original.
 * Los formularios son "controlados": cada input guarda su valor en el
 * estado de React (useState), así siempre sabemos qué hay escrito sin
 * tener que buscarlo con document.getElementById.
 */
import { useState } from 'react';
import { Panel } from '../../components/ui/Panel';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <Panel size="narrow">
      {mode === 'login' ? (
        <LoginForm onSwitchToRegister={() => setMode('register')} />
      ) : (
        <RegisterForm onSwitchToLogin={() => setMode('login')} />
      )}
    </Panel>
  );
}
