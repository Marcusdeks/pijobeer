/**
 * ANIMACIONES: herramienta del admin para revisar los sprites sin jugar.
 *
 * A la izquierda, la lista de todas las animaciones del juego con un buscador;
 * a la derecha, el visor (ver AnimationViewer) con la elegida y, si se quiere,
 * otra para compararla. Sirve, por ejemplo, para ver si el primo cambia de
 * tamaño al pasar de andar a lanzar después de retocar sus dibujos.
 *
 * También enseña, delante de todo, los BORRADORES de imagenes/png/ (ver
 * drafts.ts), para ver qué hay que arreglar en un dibujo antes de meterlo.
 *
 * Es una herramienta interna: sus textos van solo en español.
 */
import { useMemo, useState, type ChangeEvent } from 'react';
import { Panel } from '../../components/ui/Panel';
import { RequireAdmin } from '../../features/auth/RequireAdmin';
import { ANIMATIONS, searchAnimations } from '../../game/sprites/animations';
import { AnimationViewer, type Background, type ViewOptions } from './AnimationViewer';
import styles from './AnimationsPage.module.css';
import { DRAFT_ANIMATIONS } from './drafts';

/** Los borradores primero: son lo que se está revisando. */
const CATALOG = [...DRAFT_ANIMATIONS, ...ANIMATIONS];

const DEFAULT_VIEW: ViewOptions = {
  zoom: 2,
  speed: 1,
  hitbox: true,
  guides: true,
  background: 'checker',
  overlay: false,
};

const ZOOMS = [1, 2, 3, 4];
const SPEEDS = [0.25, 0.5, 1, 2];
const BACKGROUNDS: { value: Background; label: string }[] = [
  { value: 'checker', label: 'A cuadros' },
  { value: 'black', label: 'Negro' },
  { value: 'white', label: 'Blanco' },
];

const byId = (id: string) => CATALOG.find((animation) => animation.id === id);

export function AnimationsPage() {
  return (
    <RequireAdmin>
      <AnimationLab />
    </RequireAdmin>
  );
}

function AnimationLab() {
  const [query, setQuery] = useState('');
  const [mainId, setMainId] = useState(CATALOG[0]!.id);
  /** Animación con la que se compara ('' = ninguna). */
  const [compareId, setCompareId] = useState('');
  const [view, setView] = useState(DEFAULT_VIEW);

  const results = useMemo(() => searchAnimations(CATALOG, query), [query]);
  // Memorizado: el visor reinicia la animación cuando cambia esta lista
  const shown = useMemo(
    () => [byId(mainId), byId(compareId)].filter((animation) => animation !== undefined),
    [mainId, compareId],
  );

  /** Cambia una opción del visor; los <select> y casillas dan el valor ya convertido. */
  const set = <Key extends keyof ViewOptions>(key: Key, value: ViewOptions[Key]) =>
    setView((current) => ({ ...current, [key]: value }));
  const checkbox =
    (key: 'hitbox' | 'guides' | 'overlay') => (event: ChangeEvent<HTMLInputElement>) =>
      set(key, event.target.checked);

  return (
    <>
      <Panel variant="accent">
        <h2>Prueba de animaciones</h2>
        <p className={styles.intro}>
          Busca una animación y elige otra en «Comparar con» para verlas juntas, apoyadas en el
          mismo suelo. La caja roja es la de colisión; la cruz azul, el punto del dibujo que el
          juego coloca en ella (los pies, en los personajes).
        </p>
        <p className={styles.intro}>
          Los <strong>borradores</strong> son las tiras de <code>imagenes/png/</code>: genéralos con{' '}
          <code>npm run sprites:drafts -- --watch</code> y se actualizan cada vez que guardes un
          PNG. Debajo del visor salen sus avisos (fondo, restos, poses cortadas).
        </p>
      </Panel>

      <div className={styles.layout}>
        <Panel variant="accent" className={styles.list}>
          <input
            type="search"
            className={styles.search}
            placeholder="Buscar por nombre…"
            aria-label="Buscar animación"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <p className={styles.count}>
            {results.length} de {CATALOG.length} animaciones
          </p>
          <ul className={styles.items}>
            {results.map((animation) => (
              <li key={animation.id}>
                <button
                  type="button"
                  className={styles.item}
                  aria-pressed={animation.id === mainId}
                  onClick={() => setMainId(animation.id)}
                >
                  {animation.name}
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel variant="accent" className={styles.stage}>
          <div className={styles.options}>
            <label className={styles.field}>
              Comparar con
              <select value={compareId} onChange={(event) => setCompareId(event.target.value)}>
                <option value="">Nada</option>
                {CATALOG.filter((animation) => animation.id !== mainId).map((animation) => (
                  <option key={animation.id} value={animation.id}>
                    {animation.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Zoom
              <select
                value={view.zoom}
                onChange={(event) => set('zoom', Number(event.target.value))}
              >
                {ZOOMS.map((zoom) => (
                  <option key={zoom} value={zoom}>
                    ×{zoom}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Velocidad
              <select
                value={view.speed}
                onChange={(event) => set('speed', Number(event.target.value))}
              >
                {SPEEDS.map((speed) => (
                  <option key={speed} value={speed}>
                    ×{speed.toLocaleString('es')}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              Fondo
              <select
                value={view.background}
                onChange={(event) => set('background', event.target.value as Background)}
              >
                {BACKGROUNDS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className={styles.options}>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={view.hitbox} onChange={checkbox('hitbox')} />
              Caja de colisión
            </label>
            <label className={styles.checkbox}>
              <input type="checkbox" checked={view.guides} onChange={checkbox('guides')} />
              Ancla y suelo
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={view.overlay}
                disabled={!compareId}
                onChange={checkbox('overlay')}
              />
              Superpuestas
            </label>
          </div>
          <AnimationViewer animations={shown} options={view} />
        </Panel>
      </div>
    </>
  );
}
