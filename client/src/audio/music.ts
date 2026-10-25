/**
 * MÚSICA DEL JUEGO.
 *
 * Las canciones se dejan en client/src/assets/music/ con estos nombres
 * (formato .ogg o .mp3):
 *
 *   menu      portada y menú de "Jugar"
 *   level-1   nivel 1   (si falta, suena "level")
 *   level-2   nivel 2   (ídem)
 *   level-3   nivel 3   (ídem)
 *   level     cualquier nivel que no tenga canción propia
 *   boss      combate contra un jefe final
 *
 * No hay que tocar código: Vite detecta al compilar qué archivos existen
 * (import.meta.glob). Si una canción no está, simplemente no suena nada, y
 * si no hay ninguna, el botón de música ni siquiera aparece.
 *
 * Los navegadores no dejan reproducir sonido hasta que el usuario interactúa
 * con la página (un clic, una tecla). Por eso la música empieza al pulsar
 * "Jugar" y no al entrar en la web.
 */
const files = import.meta.glob<string>('../assets/music/*.{ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** "level-1" -> URL final del archivo (con el hash que pone Vite). */
const TRACKS = new Map(
  Object.entries(files).map(([path, url]) => [path.replace(/^.*\/|\.\w+$/g, ''), url]),
);

export type TrackName = 'menu' | 'boss' | `level-${number}`;

const STORAGE_KEY = 'pijobeer.musicMuted';
const VOLUME = 0.45;

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  private muted = readMuted();
  private readonly listeners = new Set<() => void>();

  /** true si hay al menos una canción: si no, no tiene sentido enseñar el botón. */
  readonly available = TRACKS.size > 0;

  get isMuted(): boolean {
    return this.muted;
  }

  /** Pone una canción en bucle. Si ya sonaba esa misma, no la reinicia. */
  play(name: TrackName): void {
    const url = TRACKS.get(name) ?? (name.startsWith('level-') ? TRACKS.get('level') : undefined);
    if (!url) return this.stop();
    if (url === this.currentUrl) return;

    this.stop();
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.volume = VOLUME;
    this.audio.muted = this.muted;
    this.currentUrl = url;
    // Si el navegador aún no permite sonido, falla en silencio; sonará en la siguiente
    this.audio.play().catch(() => {});
  }

  stop(): void {
    this.audio?.pause();
    this.audio = null;
    this.currentUrl = null;
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.audio) this.audio.muted = this.muted;
    try {
      localStorage.setItem(STORAGE_KEY, String(this.muted));
    } catch {
      // Sin almacenamiento: vale para esta visita
    }
    this.listeners.forEach((listener) => listener());
  }

  /** Para que React se entere de los cambios de silencio (useSyncExternalStore). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Un único reproductor para toda la aplicación: nunca suenan dos canciones a la vez. */
export const music = new MusicPlayer();
