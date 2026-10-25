/**
 * MÚSICA DEL JUEGO.
 *
 * Hay un ESTILO de música elegido en Opciones (heavy metal, hard rock, black
 * metal o "tu música"). Las canciones de cada estilo se dejan en su carpeta,
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
 *
 * Con "tu música" suenan las canciones que ha subido el jugador, una detrás
 * de otra y en bucle (un álbum se oye entero), sin cortarse al cambiar de
 * pantalla: no hay una canción para el menú y otra para los niveles.
 *
 * Los navegadores no dejan reproducir sonido hasta que el usuario interactúa
 * con la página (un clic, una tecla). Por eso la música empieza al pulsar
 * "Jugar" y no al entrar en la web.
 */
import { loadCustomTracks, saveCustomTracks, type CustomTrack } from './customTrackStore';

/** Estilos con canciones propias del juego, en el orden del menú (= nombre de su carpeta). */
export const MUSIC_STYLES = ['heavy-metal', 'hard-rock', 'black-metal'] as const;

/** 'custom' = la música que ha subido el jugador. */
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
  /** Canciones que ha subido el jugador (0 = ninguna). */
  customTrackCount: number;
  /** Nombre de la canción del jugador que toca ahora, o null. */
  currentCustomTrack: string | null;
  /** true si el estilo elegido tiene alguna canción (si no, sobra el botón de silenciar). */
  available: boolean;
}

/** Lo que se recuerda en localStorage (las canciones van aparte, en IndexedDB). */
type StoredSettings = Pick<MusicSettings, 'muted' | 'volume' | 'style'>;

const STORAGE_KEY = 'pijobeer.music';
const DEFAULTS: StoredSettings = { muted: false, volume: 0.45, style: 'heavy-metal' };

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentUrl: string | null = null;
  /** Última canción pedida: al cambiar de estilo se busca la equivalente del nuevo. */
  private requested: TrackName | null = null;
  private stored = readStored();
  /** Lista del jugador (con su URL blob: ya creada) y la que toca ahora. */
  private playlist: Array<{ name: string; url: string }> = [];
  private playlistIndex = 0;
  /** Canciones seguidas que no se han podido reproducir: si fallan todas, se para. */
  private failures = 0;
  private snapshot = this.buildSnapshot();
  private readonly listeners = new Set<() => void>();

  constructor() {
    // La música del jugador se recupera en segundo plano; si no hay, se vuelve al estilo por defecto
    loadCustomTracks()
      .then((tracks) => this.usePlaylist(tracks))
      .catch(() => {})
      .finally(() => {
        if (this.stored.style === 'custom' && !this.playlist.length) {
          this.update({ style: DEFAULTS.style });
        }
      });
  }

  /** Pone la música de una pantalla. Si ya sonaba esa misma, no la reinicia. */
  play(name: TrackName): void {
    this.requested = name;
    if (this.stored.style === 'custom') return this.playCurrentCustom();
    const tracks = TRACKS.get(this.stored.style);
    const url = tracks?.get(name) ?? (name.startsWith('level-') ? tracks?.get('level') : undefined);
    this.start(url, true);
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
    if (style === 'custom' && !this.playlist.length) return;
    this.update({ style });
  }

  /** Salta a la siguiente canción del jugador (al acabar la última, vuelve a la primera). */
  nextTrack(): void {
    if (!this.playlist.length) return;
    this.playlistIndex = (this.playlistIndex + 1) % this.playlist.length;
    this.changed();
  }

  /**
   * Usa las canciones del jugador (ya filtradas con selectMp3Files) y las elige como estilo.
   * @returns false si no se han podido guardar para la próxima visita (sí suenan en esta)
   */
  async setCustomTracks(files: File[]): Promise<boolean> {
    // Se vuelven a envolver como audio/mpeg: el navegador las tratará siempre como sonido
    const tracks = files.map((file) => ({
      name: file.name,
      file: new Blob([file], { type: 'audio/mpeg' }),
    }));
    this.usePlaylist(tracks);
    this.update({ style: 'custom' });
    return saveCustomTracks(tracks).then(
      () => true,
      () => false,
    );
  }

  getSnapshot = (): MusicSettings => this.snapshot;

  /** Para que React se entere de los cambios (useSyncExternalStore). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // ------------------------------------------------------------------

  private playCurrentCustom(): void {
    // Con una sola canción basta con repetirla; con varias, al acabar pasa a la siguiente
    this.start(this.playlist[this.playlistIndex]?.url, this.playlist.length === 1);
  }

  private start(url: string | undefined, loop: boolean): void {
    if (!url) return this.stopAudio();
    if (url === this.currentUrl) return;

    this.stopAudio();
    const audio = new Audio(url);
    audio.loop = loop;
    audio.volume = this.stored.volume;
    audio.muted = this.stored.muted;
    if (this.stored.style === 'custom') {
      audio.onended = () => this.nextTrack();
      audio.onplaying = () => {
        this.failures = 0;
      };
      // Un archivo que el navegador no sabe decodificar se salta, salvo que fallen todos
      audio.onerror = () => {
        if (++this.failures < this.playlist.length) this.nextTrack();
        else this.stopAudio();
      };
    }
    this.audio = audio;
    this.currentUrl = url;
    // Si el navegador aún no permite sonido, falla en silencio; sonará en la siguiente
    audio.play().catch(() => {});
  }

  private usePlaylist(tracks: CustomTrack[]): void {
    if (!tracks.length) return;
    // Cada URL blob: ocupa memoria mientras exista: se liberan las de la lista anterior
    this.playlist.forEach((track) => URL.revokeObjectURL(track.url));
    this.playlist = tracks.map((track) => ({
      name: track.name,
      url: URL.createObjectURL(track.file),
    }));
    this.playlistIndex = 0;
    this.failures = 0;
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

  /** Vuelve a elegir canción (por si ha cambiado el estilo o la lista) y avisa a React. */
  private changed(): void {
    if (this.requested) this.play(this.requested);
    // Objeto nuevo solo cuando algo cambia: useSyncExternalStore compara por referencia
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private buildSnapshot(): MusicSettings {
    const { style } = this.stored;
    const custom = style === 'custom';
    return {
      ...this.stored,
      customTrackCount: this.playlist.length,
      currentCustomTrack: custom ? (this.playlist[this.playlistIndex]?.name ?? null) : null,
      available: custom ? this.playlist.length > 0 : TRACKS.has(style),
    };
  }

  private stopAudio(): void {
    if (this.audio) {
      // Sin quitar los avisos, al parar podría saltar onerror y pasar de canción solo
      this.audio.onended = this.audio.onerror = this.audio.onplaying = null;
      this.audio.pause();
    }
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
