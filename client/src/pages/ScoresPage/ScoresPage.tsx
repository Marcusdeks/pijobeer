/**
 * PUNTUACIÓN (antes puntuacion.htm + puntuacion.js):
 *   1. Top 10 global (récord de cada jugador)
 *   2. Mis partidas: resumen + mis mejores partidas
 *
 * Diferencia importante con el original: puntuacion.js construía las filas
 * pegando texto HTML (innerHTML) y tenía que acordarse de "escapar" el nombre
 * del jugador para que nadie colara un <script>. React escapa SIEMPRE todo
 * lo que pinta entre llaves {...}, así que ese riesgo desaparece por diseño.
 */
import type { MyScoresResponse, RankingEntry } from '@pijobeer/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { scoresApi } from '../../api/endpoints';
import { useErrorMessage } from '../../api/useErrorMessage';
import { Alert } from '../../components/ui/Alert';
import { Panel } from '../../components/ui/Panel';
import { RequireAuth } from '../../features/auth/RequireAuth';
import { useAuth } from '../../features/auth/useAuth';
import styles from './ScoresPage.module.css';

export function ScoresPage() {
  const { t } = useTranslation();
  return (
    <RequireAuth hint={t('scores.hint')}>
      <ScoresContent />
    </RequireAuth>
  );
}

function ScoresContent() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const errorMessage = useErrorMessage();

  const [ranking, setRanking] = useState<RankingEntry[] | null>(null);
  const [mine, setMine] = useState<MyScoresResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /* "cancelled" evita actualizar el estado si el jugador se va de la página
       antes de que lleguen las respuestas (React avisaría de un componente desmontado). */
    let cancelled = false;

    // Las dos peticiones son independientes: Promise.all las lanza a la vez
    Promise.all([scoresApi.ranking(), scoresApi.mine()])
      .then(([rankingResponse, mineResponse]) => {
        if (cancelled) return;
        setRanking(rankingResponse.ranking);
        setMine(mineResponse);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, [errorMessage]);

  // Intl formatea la fecha según el idioma elegido: 23/10/2026 (es), 10/23/2026 (en)...
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(i18n.resolvedLanguage);

  if (error) return <Alert type="error">{error}</Alert>;
  if (!ranking || !mine) return <p className={styles.empty}>{t('common.loading')}</p>;

  return (
    <>
      {/* ---------- TOP 10 ---------- */}
      <Panel variant="accent">
        <h3>{t('scores.top')}</h3>
        {ranking.length === 0 ? (
          <p className={styles.empty}>{t('scores.rankingEmpty')}</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('scores.position')}</th>
                  <th scope="col">{t('scores.player')}</th>
                  <th scope="col">{t('scores.bestScore')}</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((row, index) => {
                  const position = index + 1;
                  const isMe = row.username === user?.username;
                  return (
                    <tr key={row.username} className={isMe ? styles.me : undefined}>
                      <td className={position <= 3 ? styles[`podium${position}`] : undefined}>
                        {position}
                      </td>
                      <td>{row.username}</td>
                      <td>{row.bestScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ---------- MIS PARTIDAS ---------- */}
      <Panel variant="accent">
        <h3>{t('scores.myGames')}</h3>

        <div className={styles.summary}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mine.bestScore}</span>
            <span className={styles.statLabel}>{t('scores.myBest')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{mine.gamesPlayed}</span>
            <span className={styles.statLabel}>{t('scores.gamesPlayed')}</span>
          </div>
        </div>

        {mine.scores.length === 0 ? (
          <p className={styles.empty}>{t('scores.myGamesEmpty')}</p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{t('scores.position')}</th>
                  <th scope="col">{t('scores.points')}</th>
                  <th scope="col">{t('scores.level')}</th>
                  <th scope="col">{t('scores.date')}</th>
                </tr>
              </thead>
              <tbody>
                {mine.scores.map((score, index) => (
                  // No hay id único por partida en la respuesta; la combinación sirve de clave estable
                  <tr key={`${score.playedAt}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{score.points}</td>
                    <td>{score.level}</td>
                    <td>{formatDate(score.playedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
