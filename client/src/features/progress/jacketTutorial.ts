/**
 * AVISO DE LA CHUPA: si este navegador ya lo ha visto.
 *
 * El aviso de cómo protegerse con la chupa sale solo la primera vez que se
 * juega el nivel 3 (justo antes del jefe). Es una ayuda de este dispositivo,
 * no progreso de la cuenta: basta con recordarlo en localStorage.
 *
 * Como en localProgress.ts, todo acceso a localStorage va en try/catch (en
 * incógnito estricto el navegador lanza un error). Sin almacenamiento, el
 * aviso saldría cada vez: es lo menos malo, mejor que no salir nunca.
 */
const KEY = 'pijobeer.jacketTutorialSeen';

export function hasSeenJacketTutorial(): boolean {
  try {
    return localStorage.getItem(KEY) === 'true';
  } catch {
    return false;
  }
}

export function markJacketTutorialSeen(): void {
  try {
    localStorage.setItem(KEY, 'true');
  } catch {
    // Sin almacenamiento: volverá a salir en la próxima partida
  }
}
