/**
 * ALMACÉN DE LA MÚSICA DEL JUGADOR en este navegador (IndexedDB).
 *
 * localStorage solo guarda texto y unos pocos MB; un álbum no cabe. IndexedDB
 * es la base de datos que trae el navegador y guarda archivos (Blob) tal cual,
 * así la música sigue ahí al volver otro día sin tener que subirla de nuevo.
 *
 * La API nativa funciona con eventos (onsuccess/onerror); aquí se envuelve en
 * promesas para poder usar async/await. Si el navegador no tiene IndexedDB
 * (incógnito estricto, tests en Node) o no le queda espacio, la operación
 * falla y quien la llama decide (la música dura entonces solo esta visita).
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
      const transaction = db.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      // Se espera a que la transacción termine (no solo la petición): es cuando
      // de verdad se ha escrito en disco, o cuando salta el error de espacio lleno
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export function saveCustomTracks(tracks: CustomTrack[]): Promise<unknown> {
  return run('readwrite', (store) => store.put(tracks, KEY));
}

/** @returns las canciones guardadas (vacío si no hay ninguna) */
export async function loadCustomTracks(): Promise<CustomTrack[]> {
  const saved = await run('readonly', (store) => store.get(KEY) as IDBRequest<unknown>);
  // Las versiones anteriores guardaban una sola canción, no una lista
  if (Array.isArray(saved)) return saved as CustomTrack[];
  return saved ? [saved as CustomTrack] : [];
}
