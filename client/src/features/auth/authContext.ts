/**
 * Definición del contexto de sesión: su forma (tipo) y el objeto Context.
 *
 * Está separado de AuthProvider.tsx a propósito: la recarga en caliente de
 * Vite (Fast Refresh) solo funciona si un archivo .tsx exporta únicamente
 * componentes. El contexto no es un componente, así que vive aquí.
 */
import type { LoginRequest, UserDto } from '@pijobeer/shared';
import { createContext } from 'react';

export interface AuthContextValue {
  /** null = no hay sesión iniciada. */
  user: UserDto | null;
  /** true mientras se pregunta al servidor al arrancar (aún no sabemos si hay sesión). */
  isLoading: boolean;
  /** @throws {ApiError} si las credenciales no son válidas */
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Sustituye los datos del usuario (tras editar el perfil o guardar progreso). */
  updateUser: (user: UserDto) => void;
}

// undefined por defecto: así useAuth() puede detectar si se usa fuera del Provider
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
