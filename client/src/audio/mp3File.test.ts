/**
 * Tests del filtro de música subida: solo pasan MP3 de verdad y dentro de los límites.
 */
import { describe, expect, it } from 'vitest';
import { id3TagSize, isMp3FrameHeader, isValidMp3, MP3_LIMITS, selectMp3Files } from './mp3File';

/** Cabecera de fotograma MPEG-1 capa III, 128 kbps, 44,1 kHz: la de un MP3 normal. */
const FRAME = [0xff, 0xfb, 0x90, 0x00];
/** Etiqueta ID3v2.4 de 5 bytes de contenido (10 de cabecera + 5). */
const ID3 = [0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05, 1, 2, 3, 4, 5];

function fakeFile(bytes: number[], name = 'cancion.mp3', type = 'audio/mpeg') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('cabeceras MP3', () => {
  it('mide la etiqueta ID3 (0 si no tiene)', () => {
    expect(id3TagSize(new Uint8Array(ID3))).toBe(15);
    expect(id3TagSize(new Uint8Array([...FRAME, 0, 0, 0, 0, 0, 0]))).toBe(0);
  });

  it('reconoce un fotograma de capa III y rechaza parecidos', () => {
    expect(isMp3FrameHeader(new Uint8Array(FRAME))).toBe(true);
    // Capa II (un MP2, no un MP3)
    expect(isMp3FrameHeader(new Uint8Array([0xff, 0xfd, 0x90, 0x00]))).toBe(false);
    // Tasa de bits inválida (1111)
    expect(isMp3FrameHeader(new Uint8Array([0xff, 0xfb, 0xf0, 0x00]))).toBe(false);
    expect(isMp3FrameHeader(new TextEncoder().encode('<script>'))).toBe(false);
  });
});

describe('isValidMp3', () => {
  it('acepta un MP3 con o sin etiqueta ID3', async () => {
    expect(await isValidMp3(fakeFile([...ID3, ...FRAME]))).toBe(true);
    // Hay sistemas que no saben el tipo del archivo y lo dejan vacío
    expect(await isValidMp3(fakeFile(FRAME, 'CANCION.MP3', ''))).toBe(true);
  });

  it('rechaza otra extensión, otro tipo o un contenido que no es MP3', async () => {
    expect(await isValidMp3(fakeFile(FRAME, 'cancion.m4a'))).toBe(false);
    expect(await isValidMp3(fakeFile(FRAME, 'cancion.mp3', 'text/html'))).toBe(false);
    // Un archivo cualquiera renombrado a .mp3: lo delata su contenido
    expect(await isValidMp3(fakeFile([...new TextEncoder().encode('<html>')]))).toBe(false);
    // "ID3" falso al principio, pero sin audio detrás
    expect(await isValidMp3(fakeFile([...ID3, 0, 0, 0, 0]))).toBe(false);
  });

  it('rechaza una canción demasiado grande', async () => {
    const big = new File([new Uint8Array(MP3_LIMITS.fileMB * 1024 * 1024 + 1)], 'larga.mp3', {
      type: 'audio/mpeg',
    });
    expect(await isValidMp3(big)).toBe(false);
  });
});

describe('selectMp3Files', () => {
  it('ordena por número de pista y descarta lo que no es MP3 (p. ej. la carátula)', async () => {
    const files = [
      fakeFile(FRAME, '10 - Diez.mp3'),
      fakeFile([0x89, 0x50, 0x4e, 0x47], 'cover.jpg', 'image/jpeg'),
      fakeFile(FRAME, '2 - Dos.mp3'),
    ];
    const { tracks, skipped, limitReached } = await selectMp3Files(files);
    expect(tracks.map((file) => file.name)).toEqual(['2 - Dos.mp3', '10 - Diez.mp3']);
    expect(skipped).toBe(1);
    expect(limitReached).toBe(false);
  });

  it('no pasa del máximo de canciones', async () => {
    const files = Array.from({ length: MP3_LIMITS.files + 2 }, (_, i) =>
      fakeFile(FRAME, `${i}.mp3`),
    );
    const { tracks, limitReached } = await selectMp3Files(files);
    expect(tracks).toHaveLength(MP3_LIMITS.files);
    expect(limitReached).toBe(true);
  });
});
