/**
 * DIFICULTAD ELEGIDA en el menú, recordada en este navegador.
 *
 * Es una preferencia, no progreso: no hace falta guardarla en la cuenta.
 * Como en localProgress.ts, todo acceso a localStorage va en try/catch (en
 * incógnito estricto el navegador lanza un error) y un valor raro escrito a
 * mano se ignora y se vuelve a la dificultad normal.
 */
import { DEFAULT_DIFFICULTY, isDifficulty, type DifficultyId } from '@pijobeer/shared';
import { useCallback, useState } from 'react';

const KEY = 'pijobeer.difficulty';

function readDifficulty(): DifficultyId {
  try {
    const stored = localStorage.getItem(KEY);
    return isDifficulty(stored) ? stored : DEFAULT_DIFFICULTY;
  } catch {
    return DEFAULT_DIFFICULTY;
  }
}

export function useDifficulty(): [DifficultyId, (difficulty: DifficultyId) => void] {
  const [difficulty, setDifficulty] = useState<DifficultyId>(readDifficulty);

  const choose = useCallback((next: DifficultyId) => {
    setDifficulty(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Sin almacenamiento: la elección vale para esta visita
    }
  }, []);

  return [difficulty, choose];
}
