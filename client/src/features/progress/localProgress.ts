/**
 * Progreso de los jugadores SIN cuenta, guardado en localStorage.
 *
 * Se pierde al cambiar de navegador, pero permite avanzar sin obligar a
 * registrarse. Con sesión iniciada el progreso va a la cuenta (servidor).
 *
 * Todo acceso a localStorage va dentro de try/catch: en modo incógnito
 * estricto, o con el almacenamiento bloqueado, el navegador LANZA un error
 * al usarlo. Sin esa protección, el juego entero dejaría de funcionar.
 */
import { FIRST_LEVEL, isValidLevel } from '@pijobeer/shared';

const KEYS = {
  maxLevel: 'pijobeer.maxLevel',
  introSeen: 'pijobeer.introSeen',
} as const;

export interface LocalProgress {
  maxLevel: number;
  introSeen: boolean;
}

export function readLocalProgress(): LocalProgress {
  try {
    const storedLevel = Number(localStorage.getItem(KEYS.maxLevel));
    return {
      // Si alguien ha escrito a mano un valor raro en localStorage, lo ignoramos
      maxLevel: isValidLevel(storedLevel) ? storedLevel : FIRST_LEVEL,
      introSeen: localStorage.getItem(KEYS.introSeen) === 'true',
    };
  } catch {
    return { maxLevel: FIRST_LEVEL, introSeen: false };
  }
}

export function writeLocalProgress(progress: LocalProgress): void {
  try {
    localStorage.setItem(KEYS.maxLevel, String(progress.maxLevel));
    localStorage.setItem(KEYS.introSeen, String(progress.introSeen));
  } catch {
    // Sin almacenamiento disponible: el progreso vale para esta visita y ya está
  }
}
