/**
 * MÚSICA DEL JUEGO.
 *
 * Hay un ESTILO de música elegido en Opciones (heavy metal, hard rock, black
 * metal o "tu canción"). Las canciones de cada estilo se dejan en su carpeta,
 * client/src/assets/music/<estilo>/, con estos nombres (.ogg o .mp3):
 *
 *   menu      portada y menú de "Jugar"
 *   level-1   nivel 1   (si falta, suena "level")
 *   level-2   nivel 2   (ídem)
 *   level-3   nivel 3   (ídem)
 *   level     cualquier nivel que no tenga canción propia
 *   boss      combate contra un jefe final
 *
 * No hay que tocar código: Vite detecta al compilar qué archivos existen
 * (import.meta.glob). Si a un estilo le falta una canción, no suena nada.
 * Con "tu canción", la que ha subido el jugador suena en todas las pantallas.
 *
 * Los navegadores no dejan reproducir sonido hasta que el usuario interactúa
 * con la página (un clic, una tecla). Por eso la música empieza al pulsar
 * "Jugar" y no al entrar en la web.
 */
import { loadCustomTrack, saveCustomTrack, type CustomTrack } from './customTrackStore';

/** Estilos con canciones propias del juego, en el orden del menú (= nombre de su carpeta). */
export const MUSIC_STYLES = ['heavy-metal', 'hard-rock', 'black-metal'] as const;

/** 'custom' = la canción que ha subido el jugador. */
export type MusicStyle = (typeof MUSIC_STYLES)[number] | 'custom';

export type TrackName = 'menu' | 'boss' | `level-${number}`;

const files = import.meta.glob<string>('../assets/music/*/*.{ogg,mp3}', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** "heavy-metal" -> ("level-1" -> URL final del archivo, con el hash que pone Vite). */
const TRACKS = new Map<string, Map<string, string>>();
for (const [path, url] of Object.entries(files)) {
  const [style, file] = path.split('/').slice(-2) as [string, string];
  if (!TRACKS.has(style)) TRACKS.set(style, new Map());
  TRACKS.get(style)!.set(file.replace(/\.\w+$/, ''), url);
}

/** Lo que React necesita saber del reproductor (ver useMusicSettings). */
export interface MusicSettings {
  muted: boolean;
  /** Volumen de 0 a 1. */
  volume: number;
  style: MusicStyle;
  /** Nombre del archivo subido por el jugador, o null si no ha subido ninguno. */
  customTrackName: string | null;
  /** true si el estilo elegido tiene alguna canción (si no, sobra el botón de silenciar). */
  available: boolean;
}

/** Lo que se recuerda en localStorage (la canción va aparte, en IndexedDB). */
type StoredSettings = Pick<MusicSettings, 'muted' | 'volume' | 'style'>;

const STORAGE_KEY = 'pijobeer.music';
const DEFAULTS: StoredSettings = { muted: false, volume: 0.45, style: 'heavy-metal' };

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  /** Última canción pedida: al cambiar de estilo se busca la equivalente del nuevo. */
  private requested: TrackName | null = null;
  private stored = readStored();
  private custom: { name: string; url: string } | null = null;
  private snapshot = this.buildSnapshot();
  private readonly listeners = new Set<() => void>();

  constructor() {
    // La canción del jugador se recupera en segundo plano; si no hay, se vuelve al estilo por defecto
    loadCustomTrack()
      .then((track) => track && this.useCustomTrack(track))
      .catch(() => {})
      .finally(() => {
        if (this.stored.style === 'custom' && !this.custom) this.update({ style: DEFAULTS.style });
      });
  }

  /** Pone una canción en bucle. Si ya sonaba esa misma, no la reinicia. */
  play(name: TrackName): void {
    this.requested = name;
    const url = this.resolve(name);
    if (!url) return this.stopAudio();
    if (url === this.currentUrl) return;

    this.stopAudio();
    this.audio = new Audio(url);
    this.audio.loop = true;
    this.audio.volume = this.stored.volume;
    this.audio.muted = this.stored.muted;
    this.currentUrl = url;
    // Si el navegador aún no permite sonido, falla en silencio; sonará en la siguiente
    this.audio.play().catch(() => {});
  }

  stop(): void {
    this.requested = null;
    this.stopAudio();
  }

  toggleMute(): void {
    this.update({ muted: !this.stored.muted });
  }

  setVolume(volume: number): void {
    this.update({ volume: Math.min(1, Math.max(0, volume)) });
  }

  /** Cambia de estilo y, si estaba sonando algo, salta a la canción equivalente. */
  setStyle(style: MusicStyle): void {
    if (style === 'custom' && !this.custom) return;
    this.update({ style });
  }

  /**
   * Usa una canción del jugador (ya validada con checkMp3File) y la elige como estilo.
   * Se guarda en el navegador para la próxima visita; si no se puede, vale para esta.
   */
  async setCustomTrack(file: File): Promise<void> {
    // Se vuelve a envolver como audio/mpeg: el navegador lo tratará siempre como sonido
    const track = { name: file.name, file: new Blob([file], { type: 'audio/mpeg' }) };
    this.useCustomTrack(track);
    this.update({ style: 'custom' });
    await saveCustomTrack(track).catch(() => {});
  }

  getSnapshot = (): MusicSettings => this.snapshot;

  /** Para que React se entere de los cambios (useSyncExternalStore). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // ------------------------------------------------------------------

  private resolve(name: TrackName): string | undefined {
    if (this.stored.style === 'custom') return this.custom?.url;
    const tracks = TRACKS.get(this.stored.style);
    return tracks?.get(name) ?? (name.startsWith('level-') ? tracks?.get('level') : undefined);
  }

  private useCustomTrack(track: CustomTrack): void {
    // La URL anterior ocupa memoria mientras exista: se libera al sustituirla
    if (this.custom) URL.revokeObjectURL(this.custom.url);
    this.custom = { name: track.name, url: URL.createObjectURL(track.file) };
    this.changed();
  }

  /** Aplica y guarda un cambio de ajustes, y lo refleja en lo que esté sonando. */
  private update(changes: Partial<StoredSettings>): void {
    this.stored = { ...this.stored, ...changes };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.stored));
    } catch {
      // Sin almacenamiento: vale para esta visita
    }
    if (this.audio) {
      this.audio.volume = this.stored.volume;
      this.audio.muted = this.stored.muted;
    }
    this.changed();
  }

  /** Vuelve a elegir canción (por si ha cambiado el estilo) y avisa a React. */
  private changed(): void {
    if (this.requested) this.play(this.requested);
    // Objeto nuevo solo cuando algo cambia: useSyncExternalStore compara por referencia
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private buildSnapshot(): MusicSettings {
    const { style } = this.stored;
    return {
      ...this.stored,
      customTrackName: this.custom?.name ?? null,
      available: style === 'custom' ? !!this.custom : TRACKS.has(style),
    };
  }

  private stopAudio(): void {
    this.audio?.pause();
    this.audio = null;
    this.currentUrl = null;
  }
}

/** Lee los ajustes guardados; cualquier valor raro (editado a mano, versión vieja) se cambia por el de por defecto. */
function readStored(): StoredSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StoredSettings>;
    const validStyle =
      saved.style === 'custom' || (MUSIC_STYLES as readonly unknown[]).includes(saved.style);
    return {
      muted: typeof saved.muted === 'boolean' ? saved.muted : DEFAULTS.muted,
      volume:
        typeof saved.volume === 'number' && saved.volume >= 0 && saved.volume <= 1
          ? saved.volume
          : DEFAULTS.volume,
      style: validStyle ? saved.style! : DEFAULTS.style,
    };
  } catch {
    return DEFAULTS;
  }
}

/** Un único reproductor para toda la aplicación: nunca suenan dos canciones a la vez. */
export const music = new MusicPlayer();
