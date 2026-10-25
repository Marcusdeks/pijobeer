/**
 * Hook para leer la sesión desde cualquier componente:
 *     const { user, login, logout } = useAuth();
 *
 * Va en su propio archivo (y no junto al Provider) para que la recarga
 * en caliente de Vite (Fast Refresh) funcione bien: un archivo de
 * componentes debe exportar solo componentes.
 */
import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    // Error de programación: el componente está fuera de <AuthProvider>
    throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  }
  return context;
}
