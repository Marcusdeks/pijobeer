/**
 * PROGRESO DEL JUGADOR: nivel máximo desbloqueado e intro vista.
 *
 * Es la evolución de progreso.js, con la misma regla de oro: el resto del
 * juego llama a estas funciones SIN saber dónde acaban los datos.
 *   - Con cuenta  -> en el servidor (le sigue aunque cambie de ordenador).
 *   - Sin cuenta  -> en localStorage (solo este navegador).
 *
 * (En el proyecto original este archivo existía pero juego.htm no lo
 * cargaba, así que el juego seguía guardando siempre en localStorage).
 *
 * Los cambios se aplican en pantalla AL MOMENTO ("actualización optimista")
 * y se envían al servidor en segundo plano: el jugador ve el nivel
 * desbloqueado aunque la conexión vaya lenta.
 */
import { useCallback, useState } from 'react';
import { usersApi } from '../../api/endpoints';
import { useAuth } from '../auth/useAuth';
import { readLocalProgress, writeLocalProgress, type LocalProgress } from './localProgress';

export interface Progress {
  maxLevel: number;
  introSeen: boolean;
  isLevelUnlocked: (levelId: number) => boolean;
  unlockLevel: (levelId: number) => void;
  markIntroSeen: () => void;
}

export function useProgress(): Progress {
  const { user, updateUser } = useAuth();
  // Solo se usa sin sesión. La función dentro de useState se ejecuta UNA vez, al montar.
  const [local, setLocal] = useState<LocalProgress>(readLocalProgress);

  const maxLevel = user ? user.maxLevel : local.maxLevel;
  const introSeen = user ? user.introSeen : local.introSeen;

  const saveLocal = useCallback((changes: Partial<LocalProgress>) => {
    setLocal((previous) => {
      const next = { ...previous, ...changes };
      writeLocalProgress(next);
      return next;
    });
  }, []);

  const unlockLevel = useCallback(
    (levelId: number) => {
      if (levelId <= maxLevel) return; // ya lo tenía: nada que guardar

      if (!user) {
        saveLocal({ maxLevel: levelId });
        return;
      }

      updateUser({ ...user, maxLevel: levelId }); // optimista: se ve ya
      usersApi
        .updateProgress({ maxLevel: levelId })
        .then(({ user: saved }) => updateUser(saved))
        // Si falla, se queda aplicado en esta visita; se volverá a intentar al desbloquear otro
        .catch(() => {});
    },
    [maxLevel, user, updateUser, saveLocal],
  );

  const markIntroSeen = useCallback(() => {
    if (introSeen) return;

    if (!user) {
      saveLocal({ introSeen: true });
      return;
    }

    updateUser({ ...user, introSeen: true });
    usersApi
      .updateProgress({ introSeen: true })
      .then(({ user: saved }) => updateUser(saved))
      .catch(() => {});
  }, [introSeen, user, updateUser, saveLocal]);

  const isLevelUnlocked = useCallback((levelId: number) => levelId <= maxLevel, [maxLevel]);

  return { maxLevel, introSeen, isLevelUnlocked, unlockLevel, markIntroSeen };
}
