/**
 * RENDERER: dibuja el estado de una partida en un <canvas>.
 *
 * Solo LEE el estado de GameSession; nunca lo modifica. Separar "pensar"
 * (GameSession) de "pintar" (renderer) permite, por ejemplo, cambiar mañana
 * los rectángulos por sprites tocando solo este archivo.
 *
 * Recordatorio del sistema de coordenadas del canvas: (0, 0) es la esquina
 * SUPERIOR izquierda; la X crece hacia la derecha y la Y hacia ABAJO.
 * Por eso, para centrar un texto se usa (ancho / 2, alto / 2).
 *
 * Los menús de pausa y de victoria NO se dibujan aquí: son HTML encima del
 * canvas (ver PlayPage), porque tienen botones y deben poder usarse con el
 * teclado y con lectores de pantalla, algo que un canvas no permite.
 */
import type { BossId } from '@pijobeer/shared';
import { ARENA, COLORS, ENEMY_BULLET, PLAYER_BULLET, SCROLL_SPEED } from './config';
import type { Boss } from './entities/Boss';
import type { Bullet } from './entities/Bullet';
import type { Enemy } from './entities/Enemy';
import type { Player } from './entities/Player';
import type { GameSession } from './GameSession';
import type { Rect } from './geometry';
import { PLAYER_PIVOT, playerFrame, type SpriteFrame } from './sprites/playerSprite';
import {
  ALLEY_DRAW_SCALE,
  alleyHeight,
  BOSS_ANCHOR,
  bossFrame,
  ENEMY_ANCHOR,
  enemyFrame,
  FOAM_ANCHOR,
  foamFrame,
  OPENER_ANCHOR,
  openerFrame,
  type Anchor,
} from './sprites/sheets';

/**
 * Imágenes que necesita el renderer. Pueden ser null mientras se descargan:
 * en ese caso se dibuja un rectángulo provisional en lugar del sprite, para
 * que el juego no se quede en blanco ni falle si la imagen tarda o no carga.
 */
export interface RenderAssets {
  playerSheet: HTMLImageElement | null;
  enemySheet: HTMLImageElement | null;
  foamSheet: HTMLImageElement | null;
  openerSheet: HTMLImageElement | null;
  bossSheet: HTMLImageElement | null;
  /** Callejón del nivel en curso. */
  alley: HTMLImageElement | null;
}

/** Barra de vida sobre la cabeza del jugador. */
const HEALTH_BAR = { width: 36, height: 4, gap: 6 } as const;

/** Barra de vida del jefe, arriba en el centro. */
const BOSS_BAR = { width: 320, height: 10, top: 48 } as const;

/** Textos que se pintan en el canvas, ya traducidos al idioma del jugador. */
export interface RenderLabels {
  hud: (data: {
    level: number;
    health: number;
    kills: number;
    required: string;
    points: number;
  }) => string;
  gameOver: string;
  /** Nombre del jefe para su barra de vida. */
  bossName: (id: BossId) => string;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  session: GameSession,
  labels: RenderLabels,
  assets: RenderAssets,
): void {
  // Sin suavizado: cada píxel de los sprites se ve como un bloque nítido (pixel art)
  ctx.imageSmoothingEnabled = false;

  // 1. Fondo: color de reserva (también "borra" el fotograma anterior) y el callejón
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  drawScrollingLayer(ctx, assets.alley, session.level.alley, session.scroll * SCROLL_SPEED);

  // 2. Entidades. Orden de dibujo = orden de capas: lo que se dibuja después
  // queda encima. La espuma va ANTES que las botellas y el jefe para que su
  // estela quede detrás de ellos y no los tape al salir.
  for (const bullet of session.enemyBullets) drawFoam(ctx, bullet, assets.foamSheet);
  for (const enemy of session.enemies) drawEnemy(ctx, enemy, assets.enemySheet);
  if (session.boss) drawBoss(ctx, session.boss, assets.bossSheet);
  drawPlayer(ctx, session.player, assets.playerSheet);
  for (const bullet of session.playerBullets) drawOpener(ctx, bullet, assets.openerSheet);

  // 3. HUD (marcador)
  ctx.fillStyle = COLORS.hud;
  ctx.font = '16px Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(
    labels.hud({
      level: session.level.id,
      health: session.player.health,
      kills: session.kills,
      required: String(session.rules.killsToComplete),
      points: session.points,
    }),
    10,
    10,
  );

  if (session.boss) drawBossBar(ctx, session.boss, labels.bossName(session.boss.id));

  // 4. Fin de partida (la pausa y la victoria son menús HTML, ver la cabecera del archivo)
  if (session.status === 'over') drawOverlay(ctx, labels.gameOver, COLORS.gameOver, 48);
}

/**
 * Dibuja una capa del callejón desplazada hacia abajo y repetida en bucle.
 *
 * Avanzar por el callejón equivale a que el fondo baje por la pantalla. La
 * imagen es más alta que la pantalla y se repite: cuando su final llega
 * arriba, por encima ya asoma otra vez su principio (el script de sprites
 * funde final y principio para que no se note el empalme).
 *
 * @param distance - píxeles de pantalla recorridos por esta capa
 */
function drawScrollingLayer(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  alley: number,
  distance: number,
): void {
  if (!image) return;

  const scale = ALLEY_DRAW_SCALE;
  const loop = alleyHeight(alley) * scale; // alto de una repetición, en píxeles de pantalla
  // Entero: un desplazamiento con decimales emborrona el pixel art
  const offset = Math.floor(distance) % loop;

  // Dos copias seguidas (la actual y la de encima) cubren siempre la pantalla
  for (const copyTop of [offset - loop, offset]) {
    const visibleTop = Math.max(0, copyTop);
    const visibleBottom = Math.min(ARENA.height, copyTop + loop);
    if (visibleBottom <= visibleTop) continue;

    // Solo se copia el trozo de imagen que se ve, no la imagen entera
    const sourceY = (visibleTop - copyTop) / scale;
    const sourceHeight = (visibleBottom - visibleTop) / scale;
    ctx.drawImage(
      image,
      0,
      sourceY,
      image.width,
      sourceHeight,
      0,
      visibleTop,
      ARENA.width,
      visibleBottom - visibleTop,
    );
  }
}

/** Jefe: centrado en su caja de colisión; en blanco durante el destello de impacto. */
function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, sheet: HTMLImageElement | null) {
  if (!sheet) return fillRect(ctx, boss, COLORS.enemy);
  const frame = bossFrame(boss.id, boss.isFlashing);
  drawFrame(ctx, sheet, frame, BOSS_ANCHOR, boss.x + boss.width / 2, boss.y + boss.height / 2);
}

/** Nombre del jefe y su barra de vida, arriba en el centro. */
function drawBossBar(ctx: CanvasRenderingContext2D, boss: Boss, name: string): void {
  const x = Math.round(ARENA.width / 2 - BOSS_BAR.width / 2);
  const y = BOSS_BAR.top;

  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(name, ARENA.width / 2, y - 3);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 2, y - 2, BOSS_BAR.width + 4, BOSS_BAR.height + 4);
  ctx.fillStyle = COLORS.bossHealth;
  ctx.fillRect(x, y, Math.round((BOSS_BAR.width * boss.healthPercent) / 100), BOSS_BAR.height);
}

/**
 * Dibuja un frame de una hoja de forma que el `anchor` del frame caiga
 * exactamente en el punto (x, y) del canvas.
 *
 * Coordenadas enteras: con decimales el navegador mezcla píxeles vecinos y
 * el pixel art se ve borroso.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  frame: SpriteFrame,
  anchor: Anchor,
  x: number,
  y: number,
): void {
  ctx.drawImage(
    sheet,
    frame.sx,
    frame.sy,
    frame.width,
    frame.height,
    Math.round(x - anchor.x),
    Math.round(y - anchor.y),
    frame.width,
    frame.height,
  );
}

/** Botella: su base (el ancla) va en el centro del borde superior de su caja de colisión. */
function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, sheet: HTMLImageElement | null) {
  if (!sheet) return fillRect(ctx, enemy, COLORS.enemy);
  const frame = enemyFrame(enemy.type, enemy.animationFrame);
  drawFrame(ctx, sheet, frame, ENEMY_ANCHOR, enemy.x + enemy.width / 2, enemy.y);
}

/** Espuma: la cabeza del chorro (el ancla) va en el centro del borde inferior de la caja. */
function drawFoam(ctx: CanvasRenderingContext2D, bullet: Bullet, sheet: HTMLImageElement | null) {
  if (!sheet) return fillRect(ctx, bullet, COLORS.enemyBullet);
  const frame = foamFrame(bullet.age, ENEMY_BULLET.frameSteps);
  drawFrame(ctx, sheet, frame, FOAM_ANCHOR, bullet.x + bullet.width / 2, bullet.y + bullet.height);
}

/** Abrechapas: el aro metálico (el ancla) va en el centro de la caja. */
function drawOpener(ctx: CanvasRenderingContext2D, bullet: Bullet, sheet: HTMLImageElement | null) {
  if (!sheet) return fillRect(ctx, bullet, COLORS.playerBullet);
  const frame = openerFrame(bullet.age, PLAYER_BULLET.frameSteps);
  drawFrame(
    ctx,
    sheet,
    frame,
    OPENER_ANCHOR,
    bullet.x + bullet.width / 2,
    bullet.y + bullet.height / 2,
  );
}

/**
 * Dibuja al jugador con el frame de animación que le toca.
 *
 * Colocación: el pivote del frame (los pies) se pone en el centro de la base
 * de la caja de colisión. Por eso el dibujo sobresale de la caja por los
 * lados y por arriba, lo cual es normal: la caja es solo para los impactos.
 */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: Player,
  sheet: HTMLImageElement | null,
): void {
  if (!sheet) {
    // Imagen aún no disponible: rectángulo provisional del color de la vida
    fillRect(ctx, player, healthColor(player));
    return;
  }

  const frame = playerFrame(player.facing, player.animationFrame);
  const feetX = player.x + player.width / 2;
  const feetY = player.y + player.height;
  drawFrame(ctx, sheet, frame, PLAYER_PIVOT, feetX, feetY);

  drawHealthBar(ctx, player, feetX, player.y - HEALTH_BAR.gap);
}

/** Barra de vida centrada en `centerX`, con su base en `bottomY`. */
function drawHealthBar(
  ctx: CanvasRenderingContext2D,
  player: Player,
  centerX: number,
  bottomY: number,
): void {
  const x = Math.round(centerX - HEALTH_BAR.width / 2);
  const y = Math.round(bottomY - HEALTH_BAR.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x - 1, y - 1, HEALTH_BAR.width + 2, HEALTH_BAR.height + 2);

  ctx.fillStyle = healthColor(player);
  ctx.fillRect(
    x,
    y,
    Math.round((HEALTH_BAR.width * player.healthPercent) / 100),
    HEALTH_BAR.height,
  );
}

/** Verde / amarillo / rojo según el % de vida restante. */
function healthColor(player: Player): string {
  if (player.healthPercent >= 75) return COLORS.playerHealthy;
  if (player.healthPercent >= 25) return COLORS.playerHurt;
  return COLORS.playerCritical;
}

function fillRect(ctx: CanvasRenderingContext2D, rect: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}

/** Oscurece la pantalla y escribe un texto centrado. */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: string,
  fontSize: number,
): void {
  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);

  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, ARENA.width / 2, ARENA.height / 2);
}
