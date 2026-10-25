/**
 * Ajustes de la música (silencio, volumen, estilo...) para los componentes de React.
 *
 * useSyncExternalStore es la forma estándar de React de leer un estado que
 * vive fuera de React (aquí, el reproductor) y repintarse cuando cambia.
 */
import { useSyncExternalStore } from 'react';
import { music, type MusicSettings } from './music';

export function useMusicSettings(): MusicSettings {
  return useSyncExternalStore(music.subscribe, music.getSnapshot);
}
