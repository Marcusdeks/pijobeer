/**
 * COMPROBACIÓN DE LA CANCIÓN QUE SUBE EL JUGADOR (solo .mp3).
 *
 * Por qué es seguro dejar subir un archivo:
 *   - El archivo NUNCA sale del navegador: no se envía al servidor, así que
 *     no puede afectar a nadie más ni llegar a la base de datos.
 *   - Se reproduce con <audio>, que solo decodifica sonido: no ejecuta
 *     nada de lo que lleve dentro.
 *
 * Aun así se filtra, por si alguien renombra cualquier cosa a ".mp3": la
 * extensión y el tipo que dice el navegador se pueden falsear, por eso
 * además se miran los primeros bytes ("número mágico"), que son los que de
 * verdad delatan qué es el archivo. Y se limita el tamaño, para no llenar
 * el almacenamiento del navegador.
 */

/** Tamaño máximo, en MB (una canción a 320 kbps de 6 minutos son unos 14 MB). */
export const MAX_MP3_MB = 20;

export type Mp3Problem = 'notMp3' | 'tooBig';

/** Tipos con los que los navegadores anuncian un MP3 ('' = el sistema no lo sabe). */
const MP3_TYPES = new Set(['audio/mpeg', 'audio/mp3', '']);

/**
 * true si los bytes empiezan como un MP3:
 *   - "ID3": etiqueta con título, artista... (casi todos los MP3 la llevan)
 *   - 11 bits a 1 (0xFFE): cabecera de un fotograma de audio MPEG, en los que no la llevan
 */
export function hasMp3Signature(bytes: Uint8Array): boolean {
  const [b0, b1, b2] = bytes;
  if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) return true; // "ID3"
  return b0 === 0xff && b1 !== undefined && (b1 & 0xe0) === 0xe0;
}

/** @returns el motivo por el que se rechaza el archivo, o null si es un MP3 válido */
export async function checkMp3File(file: File): Promise<Mp3Problem | null> {
  if (!file.name.toLowerCase().endsWith('.mp3') || !MP3_TYPES.has(file.type)) return 'notMp3';
  if (file.size > MAX_MP3_MB * 1024 * 1024) return 'tooBig';
  const head = new Uint8Array(await file.slice(0, 3).arrayBuffer());
  return hasMp3Signature(head) ? null : 'notMp3';
}
