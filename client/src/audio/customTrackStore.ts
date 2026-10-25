/**
 * ALMACÉN DE LA CANCIÓN DEL JUGADOR en este navegador (IndexedDB).
 *
 * localStorage solo guarda texto y unos pocos MB; una canción no cabe. IndexedDB
 * es la base de datos que trae el navegador y guarda archivos (Blob) tal cual,
 * así la canción sigue ahí al volver otro día sin tener que subirla de nuevo.
 *
 * La API nativa funciona con eventos (onsuccess/onerror); aquí se envuelve en
 * promesas para poder usar async/await. Si el navegador no tiene IndexedDB
 * (incógnito estricto, tests en Node), todo falla en silencio y la canción
 * dura solo esta visita.
 */

export interface CustomTrack {
  /** Nombre del archivo, para enseñárselo al jugador. */
  name: string;
  file: Blob;
}

const DB_NAME = 'pijobeer';
const STORE = 'music';
const KEY = 'customTrack';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    // Solo la primera vez (o al subir la versión): crea el "almacén" donde se guarda
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Abre la base de datos, hace UNA operación y la cierra. */
async function run<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB no disponible');
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = operation(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export function saveCustomTrack(track: CustomTrack): Promise<unknown> {
  return run('readwrite', (store) => store.put(track, KEY));
}

/** @returns la canción guardada, o undefined si no hay ninguna */
export function loadCustomTrack(): Promise<CustomTrack | undefined> {
  return run('readonly', (store) => store.get(KEY) as IDBRequest<CustomTrack | undefined>);
}
