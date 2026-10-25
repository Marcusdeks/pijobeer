/**
 * ESTADO DE LA SESIÓN, compartido por toda la aplicación (React Context).
 *
 * Es la evolución de sesion.js + PROMESA_SESION:
 *   - Al arrancar la app se pregunta UNA vez al servidor "¿quién soy?".
 *   - Cualquier componente lee el resultado con useAuth(), sin repetir la petición.
 *   - Cuando el usuario cambia (login, logout, cambio de nombre, sube de nivel),
 *     se actualiza aquí y React repinta automáticamente todo lo que depende de
 *     él: la cabecera, el menú, el perfil... Antes había que recargar la página.
 *
 * Un "Context" de React es una forma de pasar datos a cualquier componente
 * del árbol sin tener que ir pasándolos de padre a hijo por props.
 */
import type { LoginRequest, UserDto } from '@pijobeer/shared';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../../api/endpoints';
import { AuthContext, type AuthContextValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Al montar la app: ¿hay una sesión abierta de una visita anterior?
  useEffect(() => {
    authApi
      .me()
      .then(({ user: current }) => setUser(current))
      // Si el servidor no responde, seguimos como anónimos: se puede jugar igual
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  /* useCallback "congela" la función entre renderizados. Sin él, cada
     render crearía una función nueva y todos los componentes que la usan
     se repintarían aunque nada hubiera cambiado. */
  const login = useCallback(async (credentials: LoginRequest) => {
    const { user: loggedIn } = await authApi.login(credentials);
    setUser(loggedIn);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Aunque falle la petición, en este navegador damos la sesión por cerrada
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, login, logout, updateUser: setUser }),
    [user, isLoading, login, logout],
  );

  // React 19 permite usar el propio contexto como proveedor (antes: <AuthContext.Provider>)
  return <AuthContext value={value}>{children}</AuthContext>;
}
