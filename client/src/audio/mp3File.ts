/**
 * COMPROBACIÓN DE LA MÚSICA QUE SUBE EL JUGADOR (solo .mp3: canciones sueltas o una carpeta).
 *
 * Por qué es seguro dejar subir archivos:
 *   - NUNCA salen del navegador: no se envían al servidor, así que no pueden
 *     afectar a nadie más ni llegar a la base de datos.
 *   - Se reproducen con <audio>, que solo decodifica sonido: no ejecuta nada
 *     de lo que lleven dentro. Y la CSP del servidor solo admite URLs blob:
 *     para audio (media-src), nunca para scripts.
 *   - Los nombres de archivo se pintan con React, que escapa el texto: un
 *     nombre como "<script>.mp3" se ve tal cual, no se ejecuta.
 *
 * Aun así se filtra, por si alguien renombra cualquier cosa a ".mp3": la
 * extensión y el tipo que dice el navegador se pueden falsear, así que
 * además se lee el principio del archivo y se busca la cabecera de un
 * fotograma de audio MP3 de verdad (saltando la etiqueta ID3 si la hay).
 * Y se limita el tamaño, para no llenar el almacenamiento del navegador.
 */

/**
 * Límites. Cálculo: un MP3 a 320 kbps (la máxima calidad) ocupa 2,4 MB por
 * minuto, y un álbum medio dura 45-50 minutos: unos 110-120 MB (70 MB a 192 kbps).
 *   fileMB   una canción de 25 minutos a 320 kbps (las épicas del black metal)
 *   totalMB  dos álbumes completos a máxima calidad (cuatro a 192 kbps)
 *   files    de sobra para dos o tres álbumes
 * Los navegadores dejan a cada web guardar bastante más de esto en IndexedDB.
 */
export const MP3_LIMITS = { fileMB: 60, totalMB: 300, files: 100 } as const;

const MB = 1024 * 1024;

/** Tipos con los que los navegadores anuncian un MP3 ('' = el sistema no lo sabe). */
const MP3_TYPES = new Set(['audio/mpeg', 'audio/mp3', '']);

/** Bytes en los que se busca el primer fotograma tras la etiqueta (algunos archivos traen relleno). */
const FRAME_SEARCH_BYTES = 4096;

/**
 * Tamaño de la etiqueta ID3v2 del principio (título, artista, carátula...), o
 * 0 si no tiene. Su tamaño va en 4 bytes de 7 bits ("syncsafe"), sin contar
 * la cabecera de 10 bytes ni el pie opcional de otros 10.
 */
export function id3TagSize(bytes: Uint8Array): number {
  if (bytes.length < 10 || bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  const size = [6, 7, 8, 9].reduce((total, i) => (total << 7) | (bytes[i]! & 0x7f), 0);
  const footer = bytes[5]! & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/**
 * true si en `i` empieza la cabecera de un fotograma MP3 válido:
 * 11 bits de sincronía a 1, versión MPEG no reservada, capa III (la "3" de
 * MP3), y tasa de bits y frecuencia de muestreo con valores permitidos.
 */
export function isMp3FrameHeader(bytes: Uint8Array, i = 0): boolean {
  const [b0, b1, b2] = [bytes[i], bytes[i + 1], bytes[i + 2]];
  if (b0 !== 0xff || b1 === undefined || b2 === undefined) return false;
  const sync = (b1 & 0xe0) === 0xe0;
  const version = (b1 >> 3) & 0b11; // 01 = reservada
  const layer = (b1 >> 1) & 0b11; // 01 = capa III
  const bitrate = b2 >> 4; // 0000 = libre (casi nunca), 1111 = inválida
  const sampleRate = (b2 >> 2) & 0b11; // 11 = reservada
  return (
    sync && version !== 1 && layer === 1 && bitrate !== 0 && bitrate !== 15 && sampleRate !== 3
  );
}

function hasMp3FrameHeader(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length - 2; i++) if (isMp3FrameHeader(bytes, i)) return true;
  return false;
}

const hasMp3Name = (file: File) => file.name.toLowerCase().endsWith('.mp3');

/** true si el archivo es de verdad un MP3 dentro del tamaño permitido. */
export async function isValidMp3(file: File): Promise<boolean> {
  if (!hasMp3Name(file) || !MP3_TYPES.has(file.type) || file.size > MP3_LIMITS.fileMB * MB) {
    return false;
  }
  const start = id3TagSize(new Uint8Array(await file.slice(0, 10).arrayBuffer()));
  const window = await file.slice(start, start + FRAME_SEARCH_BYTES).arrayBuffer();
  return hasMp3FrameHeader(new Uint8Array(window));
}

export interface Mp3Selection {
  /** Canciones válidas, ordenadas por nombre ("01 - ...", "02 - ..." quedan en orden). */
  tracks: File[];
  /** Archivos descartados por no ser un MP3 válido (p. ej. la carátula de una carpeta). */
  skipped: number;
  /** true si se ha llegado al máximo de canciones o de MB y sobraban archivos. */
  limitReached: boolean;
}

/** Filtra lo que ha elegido el jugador (archivos sueltos o una carpeta entera). */
export async function selectMp3Files(files: File[]): Promise<Mp3Selection> {
  // webkitRelativePath = "carpeta/01 - cancion.mp3" al subir una carpeta; vacío con archivos sueltos
  const path = (file: File) => file.webkitRelativePath || file.name;
  const sorted = [...files].sort((a, b) =>
    path(a).localeCompare(path(b), undefined, { numeric: true }),
  );

  const tracks: File[] = [];
  let skipped = 0;
  let totalBytes = 0;
  let limitReached = false;

  for (const file of sorted) {
    if (!(await isValidMp3(file))) {
      skipped++;
    } else if (
      tracks.length >= MP3_LIMITS.files ||
      totalBytes + file.size > MP3_LIMITS.totalMB * MB
    ) {
      limitReached = true;
    } else {
      tracks.push(file);
      totalBytes += file.size;
    }
  }
  return { tracks, skipped, limitReached };
}
