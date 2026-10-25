/**
 * MÚSICA DEL JUEGO.
 *
 * Hay un ESTILO de música elegido en Opciones (heavy metal, hard rock, black
 * metal o "tu música"). Cada estilo es una LISTA de canciones:
 *
 *   - Las del juego: cualquier .ogg o .mp3 que haya en
 *     client/src/assets/music/<estilo>/. Suenan AL AZAR, una detrás de otra.
 *     No hay que tocar código: Vite detecta al compilar qué archivos existen
 *     (import.meta.glob).
 *   - "Tu música": las que ha subido el jugador. Suenan EN ORDEN (un álbum
 *     se oye como es) y vuelven a empezar al acabar.
 *
 * La música solo suena en la página de Jugar (menú y partida): PlayPage
 * llama a play() al entrar y a stop() al salir. Entre el menú y la partida
 * no se corta: la canción sigue donde iba.
 *
 * Los navegadores no dejan reproducir sonido hasta que el usuario interactúa
 * con la página (un clic, una tecla). Si al entrar aún no se puede, la
 * canción empieza en cuanto se pulsa algo (ver resumeOnInteraction).
 */
import { loadCustomTracks, saveCustomTracks, type CustomTrack } from './customTrackStore';

/** Estilos con canciones propias del juego, en el orden del menú (= nombre de su carpeta). */
export const MUSIC_STYLES = ['heavy-metal', 'hard-rock', 'black-metal'] as const;

/** 'custom' = la música que ha subido el jugador. */
export type MusicStyle = (typeof MUSIC_STYLES)[number] | 'custom';

interface Track {
  /** Nombre para enseñar en Opciones ("Sonando: ..."). */
  name: string;
  url: string;
}

/**
 * Dos sitios de donde salen las canciones de cada estilo, con la misma
 * estructura (<carpeta>/<estilo>/<canción>):
 *   - client/src/assets/music/: música que SÍ se publica (propia o con licencia libre).
 *   - pijobeer/sound/: música que solo suena en local. Esa carpeta está en
 *     .gitignore, así que nunca llega al repositorio público (derechos de autor).
 *     En una copia sin ella, ese estilo simplemente tiene menos canciones.
 */
const files = import.meta.glob<string>(
  ['../assets/music/*/*.{ogg,mp3}', '../../../sound/*/*.{ogg,mp3}'],
  { eager: true, query: '?url', import: 'default' },
);

/** "black-metal" -> canciones de esa carpeta. El nombre sale del archivo: "noche-negra.mp3" -> "Noche Negra". */
const STYLE_TRACKS = new Map<string, Track[]>();
for (const [path, url] of Object.entries(files)) {
  const [style, file] = path.split('/').slice(-2) as [string, string];
  const name = file
    .replace(/\.\w+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
  STYLE_TRACKS.set(style, [...(STYLE_TRACKS.get(style) ?? []), { name, url }]);
}

/** Lo que React necesita saber del reproductor (ver useMusicSettings). */
export interface MusicSettings {
  muted: boolean;
  /** Volumen de 0 a 1. */
  volume: number;
  style: MusicStyle;
  /** Canciones que ha subido el jugador (0 = ninguna). */
  customTrackCount: number;
  /** Canciones del estilo elegido. */
  trackCount: number;
  /** Nombre de la canción que toca ahora, o null si no suena nada. */
  currentTrack: string | null;
}

/** Lo que se recuerda en localStorage (las canciones del jugador van aparte, en IndexedDB). */
type StoredSettings = Pick<MusicSettings, 'muted' | 'volume' | 'style'>;

const STORAGE_KEY = 'pijobeer.music';
const DEFAULTS: StoredSettings = {
  muted: false,
  volume: 0.45,
  // El primer estilo que tenga canciones, para que la primera vez ya suene algo
  style: MUSIC_STYLES.find((style) => STYLE_TRACKS.has(style)) ?? MUSIC_STYLES[0],
};

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private current: Track | null = null;
  /** true entre play() y stop(): la página de Jugar quiere música. */
  private active = false;
  private index = 0;
  private stored = readStored();
  private customTracks: Track[] = [];
  /** Canciones seguidas que no se han podido reproducir: si fallan todas, se para. */
  private failures = 0;
  private snapshot = this.buildSnapshot();
  private readonly listeners = new Set<() => void>();

  constructor() {
    // La música del jugador se recupera en segundo plano; si no hay, se vuelve al estilo por defecto
    loadCustomTracks()
      .then((tracks) => tracks.length && this.useCustomTracks(tracks))
      .catch(() => {})
      .finally(() => {
        if (this.stored.style === 'custom' && !this.customTracks.length) {
          this.setStyle(DEFAULTS.style);
        }
      });
  }

  /** Empieza la música (si ya sonaba, sigue con lo que iba). */
  play(): void {
    if (this.active) return;
    this.active = true;
    this.index = this.firstIndex();
    this.startCurrent();
  }

  stop(): void {
    this.active = false;
    this.stopAudio();
  }

  toggleMute(): void {
    this.update({ muted: !this.stored.muted });
  }

  setVolume(volume: number): void {
    this.update({ volume: Math.min(1, Math.max(0, volume)) });
  }

  /** Cambia de estilo y, si estaba sonando algo, pasa a una canción del nuevo. */
  setStyle(style: MusicStyle): void {
    if (style === 'custom' && !this.customTracks.length) return;
    this.update({ style });
    this.index = this.firstIndex();
    this.startCurrent();
  }

  /** Siguiente canción: otra al azar en las del juego, la siguiente en orden en las del jugador. */
  nextTrack(): void {
    const count = this.tracks.length;
    if (!count) return;
    if (this.stored.style === 'custom') {
      this.index = (this.index + 1) % count;
    } else if (count > 1) {
      // Al azar, pero nunca la misma que acaba de sonar
      const pick = Math.floor(Math.random() * (count - 1));
      this.index = pick >= this.index ? pick + 1 : pick;
    }
    this.startCurrent();
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
    this.useCustomTracks(tracks);
    this.setStyle('custom');
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

  private get tracks(): Track[] {
    const { style } = this.stored;
    return style === 'custom' ? this.customTracks : (STYLE_TRACKS.get(style) ?? []);
  }

  /** Por dónde empieza la lista: la primera pista del álbum del jugador, o una al azar. */
  private firstIndex(): number {
    if (this.stored.style === 'custom') return 0;
    return Math.floor(Math.random() * this.tracks.length);
  }

  /** Pone la canción de `index` si hay que sonar y no está sonando ya. */
  private startCurrent(): void {
    const track = this.active ? this.tracks[this.index] : undefined;
    if (track !== this.current) {
      this.stopAudio();
      if (track) this.startAudio(track);
    }
    this.emit();
  }

  private startAudio(track: Track): void {
    const audio = new Audio(track.url);
    // Con una sola canción basta con repetirla; con varias, al acabar pasa a otra
    audio.loop = this.tracks.length === 1;
    audio.volume = this.stored.volume;
    audio.muted = this.stored.muted;
    audio.onended = () => this.nextTrack();
    audio.onplaying = () => {
      this.failures = 0;
    };
    // Un archivo que el navegador no sabe decodificar se salta, salvo que fallen todos
    audio.onerror = () => {
      if (++this.failures < this.tracks.length) this.nextTrack();
      else this.stop();
    };
    this.audio = audio;
    this.current = track;
    audio.play().catch(() => this.resumeOnInteraction(audio));
  }

  /** El navegador aún no deja sonar: se reintenta con el primer clic o tecla del jugador. */
  private resumeOnInteraction(audio: HTMLAudioElement): void {
    const retry = () => {
      if (this.audio === audio) audio.play().catch(() => {});
    };
    window.addEventListener('pointerdown', retry, { once: true });
    window.addEventListener('keydown', retry, { once: true });
  }

  private useCustomTracks(tracks: CustomTrack[]): void {
    // Cada URL blob: ocupa memoria mientras exista: se liberan las de la lista anterior
    this.customTracks.forEach((track) => URL.revokeObjectURL(track.url));
    this.customTracks = tracks.map((track) => ({
      name: track.name.replace(/\.mp3$/i, ''),
      url: URL.createObjectURL(track.file),
    }));
    this.failures = 0;
    this.emit();
  }

  /** Aplica y guarda un cambio de ajustes. */
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
    this.emit();
  }

  /** Avisa a React. Objeto nuevo solo cuando algo cambia: useSyncExternalStore compara por referencia. */
  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((listener) => listener());
  }

  private buildSnapshot(): MusicSettings {
    return {
      ...this.stored,
      customTrackCount: this.customTracks.length,
      trackCount: this.tracks.length,
      currentTrack: this.current?.name ?? null,
    };
  }

  private stopAudio(): void {
    if (this.audio) {
      // Sin quitar los avisos, al parar podría saltar onerror y pasar de canción solo
      this.audio.onended = this.audio.onerror = this.audio.onplaying = null;
      this.audio.pause();
    }
    this.audio = null;
    this.current = null;
  }
}

/** Lee los ajustes guardados; cualquier valor raro (editado a mano, versión vieja) se cambia por el de por defecto. */
function readStored(): StoredSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StoredSettings>;
    // Un estilo sin canciones (p. ej. elegido antes de que las tuviera) tampoco vale: no sonaría nada
    const validStyle = saved.style === 'custom' || STYLE_TRACKS.has(saved.style as string);
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
