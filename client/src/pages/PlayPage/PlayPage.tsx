/**
 * PÁGINA "JUGAR": coordina las pantallas del juego.
 *
 *   menú ──► (elegir nivel) ──► intro* ──► partida ─┬─► victoria ──► siguiente nivel / menú
 *                                                   ├─► game over ──► menú (automático)
 *                                                   ├─► pausa ──► continuar / salir al menú
 *                                                   └─► texto de historia ──► sigue la partida
 *                                                       (al empezar o antes de los jefes, ver story.ts)
 *    └──► (opciones: dificultad y música; se aplican al momento)
 *                                 * solo la primera vez (o si no se ha visto)
 *
 * Son dos MÁQUINAS DE ESTADOS encajadas:
 *   - `screen`: qué pantalla se ve (menú, intro o partida).
 *   - `gameStatus`: en qué estado está la partida (lo decide el motor y nos lo
 *     cuenta con onStatusChange). De él dependen los menús de pausa y victoria.
 * En juego.js esto se hacía mostrando y ocultando secciones con style.display,
 * y era fácil dejar dos pantallas visibles a la vez por error; aquí es imposible.
 */
import { FIRST_LEVEL, hasActiveModifiers, nextLevelId, type GameModifiers } from '@pijobeer/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, scoresApi } from '../../api/endpoints';
import { music } from '../../audio/music';
import { VolumeSlider } from '../../audio/VolumeSlider';
import coverImage from '../../assets/images/cover.jpg';
import { GameCanvas, type GameCanvasHandle } from '../../components/GameCanvas/GameCanvas';
import { GameOverlay } from '../../components/GameOverlay/GameOverlay';
import { StoryOverlay } from '../../components/StoryOverlay/StoryOverlay';
import { StarWarsCrawl } from '../../components/StarWarsCrawl/StarWarsCrawl';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../features/auth/useAuth';
import {
  hasSeenJacketTutorial,
  markJacketTutorialSeen,
} from '../../features/progress/jacketTutorial';
import { useDifficulty } from '../../features/progress/useDifficulty';
import { useProgress } from '../../features/progress/useProgress';
import { CONTROLS, GAME_OVER_DELAY_MS } from '../../game/config';
import type { DialogMoment, GameResult, GameStatus } from '../../game/GameSession';
import { LevelSelectDialog } from './LevelSelectDialog';
import { OptionsDialog } from './OptionsDialog';
import styles from './PlayPage.module.css';
import { STORIES, storiesFor, type StoryId } from './story';

type Screen =
  | { name: 'menu' }
  | { name: 'levelSelect' }
  | { name: 'options' }
  | { name: 'intro'; levelId: number }
  /**
   * runId cambia en cada partida: hace que React cree un GameCanvas nuevo desde cero.
   * stories: los textos de historia de esta partida, decididos al empezarla.
   */
  | {
      name: 'playing';
      levelId: number;
      runId: number;
      stories: Partial<Record<DialogMoment, StoryId>>;
    };

interface Notice {
  type: 'success' | 'error';
  text: string;
}

/** Resultado de un nivel superado, para el menú de victoria. */
interface Victory {
  result: GameResult;
  /** Nivel siguiente, o null si era el último. */
  nextLevel: number | null;
}

const NOTICE_DURATION_MS = 5000;

export function PlayPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const progress = useProgress();
  const [difficulty, setDifficulty] = useDifficulty();
  const gameRef = useRef<GameCanvasHandle>(null);
  const runCounter = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);

  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [gameStatus, setGameStatus] = useState<GameStatus>('running');
  const [victory, setVictory] = useState<Victory | null>(null);
  /** Texto de historia que se está enseñando (con la partida parada). */
  const [story, setStory] = useState<StoryId | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  /** Trucos de "juego admin" (solo para administradores; si no, undefined = partida normal). */
  const [modifiers, setModifiers] = useState<GameModifiers>();
  const cheating = !!modifiers && hasActiveModifiers(modifiers);

  // Un admin recibe sus trucos cada vez que vuelve al menú (por si los ha cambiado)
  useEffect(() => {
    if (!user?.isAdmin || screen.name !== 'menu') return;
    adminApi
      .getModifiers()
      .then((res) => setModifiers(res.modifiers))
      .catch(() => setModifiers(undefined));
  }, [user?.isAdmin, screen.name]);

  /* Al entrar en el menú o empezar una partida, la página se desplaza hasta el
     escenario, que mide lo mismo que la ventana y centra lo que tiene dentro:
     así el menú o el juego quedan en el centro de cualquier pantalla. La
     clave cambia en cada partida para que también se recoloque al reintentar. */
  const stageKey = screen.name === 'playing' ? `game-${screen.runId}` : screen.name;
  useEffect(() => {
    if (stageKey === 'menu' || stageKey.startsWith('game-')) {
      stageRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [stageKey]);

  // Música solo en esta página (menú y partida): empieza al entrar y se para al salir
  useEffect(() => {
    music.play();
    return () => music.stop();
  }, []);

  /** Empieza un nivel: pasa por la intro solo si aún no se ha visto. */
  function startLevel(levelId: number) {
    setNotice(null);
    if (progress.introSeen) play(levelId);
    else setScreen({ name: 'intro', levelId });
  }

  function play(levelId: number) {
    runCounter.current += 1;
    setGameStatus('running');
    setVictory(null);
    setStory(null);
    setNotice(cheating ? { type: 'success', text: t('play.cheatsActive') } : null);
    const stories = storiesFor(levelId, hasSeenJacketTutorial());
    setScreen({ name: 'playing', levelId, runId: runCounter.current, stories });
  }

  function finishIntro(levelId: number) {
    progress.markIntroSeen();
    play(levelId);
  }

  function backToMenu() {
    setScreen({ name: 'menu' });
  }

  /** El motor se ha parado en un momento con texto: se enseña el que toque. */
  const handleDialog = useCallback(
    (moment: DialogMoment) => {
      const id = screen.name === 'playing' ? screen.stories[moment] : undefined;
      if (!id) return gameRef.current?.closeDialog();
      // El aviso de la chupa solo sale la primera vez: se apunta en cuanto se ve
      if (id === 'jacketTutorial') markJacketTutorialSeen();
      setStory(id);
    },
    [screen],
  );

  function closeStory() {
    setStory(null);
    gameRef.current?.closeDialog();
  }

  /**
   * Guarda la partida en la cuenta y avisa del resultado. No hace nada sin
   * cuenta, ni si hay trucos de admin activos (sería hacer trampa en el ranking).
   */
  const saveScore = useCallback(
    (result: GameResult) => {
      if (!user || cheating) return;
      scoresApi
        .submit({ points: result.points, level: result.level })
        .then(() =>
          setNotice({ type: 'success', text: t('play.scoreSaved', { points: result.points }) }),
        )
        .catch(() => setNotice({ type: 'error', text: t('play.scoreNotSaved') }));
    },
    [user, cheating, t],
  );

  const handleVictory = useCallback(
    (result: GameResult) => {
      const nextLevel = nextLevelId(result.level);
      if (nextLevel !== null) progress.unlockLevel(nextLevel);
      setVictory({ result, nextLevel });
      saveScore(result);
    },
    [progress, saveScore],
  );

  // Las partidas perdidas también cuentan para "Mis partidas" y el ranking
  const handleGameOver = useCallback((result: GameResult) => saveScore(result), [saveScore]);

  // Tras el "GAME OVER", volver al menú pasados unos segundos
  useEffect(() => {
    if (gameStatus !== 'over') return;
    const timer = setTimeout(backToMenu, GAME_OVER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [gameStatus]);

  return (
    <>
      {/* Flotando encima de todo: si ocupara sitio en la página, empujaría el juego
          hacia abajo al aparecer y lo haría saltar al irse, descentrándolo */}
      {notice && (
        <div className={styles.toast}>
          <Alert
            type={notice.type}
            autoDismissMs={NOTICE_DURATION_MS}
            onDismiss={() => setNotice(null)}
            focusOnMount={false}
          >
            {notice.text}
          </Alert>
        </div>
      )}

      <div ref={stageRef} className={styles.stage}>
        {/* Las ventanas de nivel y opciones se abren ENCIMA del menú, que sigue debajo */}
        {(screen.name === 'menu' || screen.name === 'levelSelect' || screen.name === 'options') && (
          <section className={styles.menu}>
            <div className={styles.cover}>
              <img src={coverImage} alt={t('play.coverAlt')} className={styles.coverImage} />
              <div className={styles.actions}>
                <Button onClick={() => startLevel(FIRST_LEVEL)}>{t('play.play')}</Button>
                <Button onClick={() => setScreen({ name: 'levelSelect' })}>
                  {t('play.chooseLevel')}
                </Button>
                <Button onClick={() => setScreen({ name: 'options' })}>{t('play.options')}</Button>
              </div>
            </div>
          </section>
        )}

        {screen.name === 'levelSelect' && (
          <LevelSelectDialog
            isLevelUnlocked={progress.isLevelUnlocked}
            onSelect={startLevel}
            onClose={backToMenu}
          />
        )}

        {screen.name === 'options' && (
          <OptionsDialog
            difficulty={difficulty}
            onDifficultyChange={setDifficulty}
            onClose={backToMenu}
          />
        )}

        {screen.name === 'intro' && (
          <StarWarsCrawl
            playOnce
            onFinished={() => finishIntro(screen.levelId)}
            onSkip={() => finishIntro(screen.levelId)}
          />
        )}

        {screen.name === 'playing' && (
          <section className={styles.game}>
            <GameCanvas
              key={screen.runId}
              ref={gameRef}
              levelId={screen.levelId}
              modifiers={modifiers}
              difficulty={difficulty}
              dialogs={Object.keys(screen.stories) as DialogMoment[]}
              onStatusChange={setGameStatus}
              onDialog={handleDialog}
              onVictory={handleVictory}
              onGameOver={handleGameOver}
            >
              {gameStatus === 'dialog' && story && (
                <StoryOverlay
                  key={story}
                  lines={STORIES[story].lines.map((line) =>
                    t(line, { key: CONTROLS.shield.toUpperCase() }),
                  )}
                  durationMs={STORIES[story].durationMs}
                  skipLabel={STORIES[story].skippable ? t('play.skipStory') : undefined}
                  onClose={closeStory}
                />
              )}

              {gameStatus === 'paused' && (
                <GameOverlay variant="pause" title={t('play.paused')} subtitle={<VolumeSlider />}>
                  <Button onClick={() => gameRef.current?.resume()}>{t('play.resume')}</Button>
                  {/* Salir desmonta la partida: el bucle y el teclado se paran solos */}
                  <Button variant="ghost" onClick={backToMenu}>
                    {t('play.quitToMenu')}
                  </Button>
                </GameOverlay>
              )}

              {gameStatus === 'victory' && victory && (
                <GameOverlay
                  variant="victory"
                  title={t('play.victoryTitle')}
                  subtitle={
                    <>
                      <p>
                        {t('play.victorySummary', {
                          level: victory.result.level,
                          points: victory.result.points,
                        })}
                      </p>
                      <p>
                        {victory.nextLevel !== null
                          ? t('play.levelUnlocked', { level: victory.nextLevel })
                          : t('play.gameCompleted')}
                      </p>
                    </>
                  }
                >
                  {victory.nextLevel !== null && (
                    <Button variant="neon" onClick={() => play(victory.nextLevel!)}>
                      {t('play.nextLevel')}
                    </Button>
                  )}
                  <Button variant="neon" onClick={backToMenu}>
                    {t('play.backToMenu')}
                  </Button>
                </GameOverlay>
              )}
            </GameCanvas>
          </section>
        )}
      </div>
    </>
  );
}
