/**
 * Tests del filtro de canciones subidas: solo pasan MP3 de verdad.
 */
import { describe, expect, it } from 'vitest';
import { checkMp3File, hasMp3Signature, MAX_MP3_MB } from './mp3File';

const ID3 = [0x49, 0x44, 0x33, 0x04];
const MPEG_FRAME = [0xff, 0xfb, 0x90, 0x00];

function fakeFile(bytes: number[], name = 'cancion.mp3', type = 'audio/mpeg') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('hasMp3Signature', () => {
  it('reconoce la etiqueta ID3 y la cabecera de un fotograma MPEG', () => {
    expect(hasMp3Signature(new Uint8Array(ID3))).toBe(true);
    expect(hasMp3Signature(new Uint8Array(MPEG_FRAME))).toBe(true);
  });

  it('rechaza otros formatos aunque se parezcan', () => {
    expect(hasMp3Signature(new TextEncoder().encode('<script>'))).toBe(false);
    expect(hasMp3Signature(new Uint8Array([0xff, 0x10]))).toBe(false);
    expect(hasMp3Signature(new Uint8Array([]))).toBe(false);
  });
});

describe('checkMp3File', () => {
  it('acepta un MP3', async () => {
    expect(await checkMp3File(fakeFile(ID3))).toBeNull();
    // Hay sistemas que no saben el tipo del archivo y lo dejan vacío
    expect(await checkMp3File(fakeFile(MPEG_FRAME, 'CANCION.MP3', ''))).toBeNull();
  });

  it('rechaza otra extensión, otro tipo o un contenido que no es MP3', async () => {
    expect(await checkMp3File(fakeFile(ID3, 'cancion.m4a'))).toBe('notMp3');
    expect(await checkMp3File(fakeFile(ID3, 'cancion.mp3', 'text/html'))).toBe('notMp3');
    // Un archivo cualquiera renombrado a .mp3: lo delatan sus primeros bytes
    const html = [...new TextEncoder().encode('<html>')];
    expect(await checkMp3File(fakeFile(html))).toBe('notMp3');
  });

  it('rechaza los archivos demasiado grandes', async () => {
    const big = new File([new Uint8Array(MAX_MP3_MB * 1024 * 1024 + 1)], 'larga.mp3', {
      type: 'audio/mpeg',
    });
    expect(await checkMp3File(big)).toBe('tooBig');
  });
});
