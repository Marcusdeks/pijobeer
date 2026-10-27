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
import { ARENA, COLORS, ENEMY_BULLET, PLAYER_BULLET } from './config';
import type { Boss } from './entities/Boss';
import type { Bullet } from './entities/Bullet';
import type { Enemy } from './entities/Enemy';
import type { Pickup } from './entities/Pickup';
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
  MINION_ANCHOR,
  minionFrame,
  foamFrame,
  OPENER_ANCHOR,
  openerFrame,
  PICKUP_ANCHOR,
  pickupFrame,
  pijoFrame,
  PIJO_ANCHOR,
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
  /** Pijo (jefe del nivel 4), con sus poses de andar y de lanzar. */
  pijoSheet: HTMLImageElement | null;
  pickupSheet: HTMLImageElement | null;
  /** Barril pequeño del nivel 4. */
  minionSheet: HTMLImageElement | null;
  /** Pose del jugador tapándose con la chupa (un solo frame, mismo pivote que player.png). */
  jacketSheet: HTMLImageElement | null;
  /** Callejón del nivel en curso. */
  alley: HTMLImageElement | null;
}

/** Barras sobre la cabeza del jugador: la de vida y, encima, las del acelerón y la chupa secándose. */
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
  /** Nombre del jefe (o de la pareja, si salen varios iguales) para su barra de vida. */
  bossName: (id: BossId, count: number) => string;
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
  drawScrollingLayer(ctx, assets.alley, session.level.alley, session.backgroundDistance);

  // 2. Entidades. Orden de dibujo = orden de capas: lo que se dibuja después
  // queda encima. La espuma va ANTES que las botellas y el jefe para que su
  // estela quede detrás de ellos y no los tape al salir.
  for (const bullet of session.enemyBullets) drawFoam(ctx, bullet, assets.foamSheet);
  for (const pickup of session.pickups) drawPickup(ctx, pickup, assets.pickupSheet);
  for (const enemy of session.enemies) drawEnemy(ctx, enemy, assets);
  for (const boss of session.bosses) drawBoss(ctx, boss, assets);
  drawPlayer(ctx, session.player, assets);
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

  const [firstBoss] = session.bosses;
  if (firstBoss) {
    drawBossBar(ctx, session.bosses, labels.bossName(firstBoss.id, session.level.bosses.length));
  }

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
  // Entero: un desplazamiento con decimales emborrona el pixel art. Con el doble
  // módulo, al retroceder (distancia negativa) también queda entre 0 y loop.
  const offset = ((Math.floor(distance) % loop) + loop) % loop;

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

/**
 * Jefe, en blanco durante el destello de impacto. Los barriles, centrados en
 * su caja de colisión; el pijo, de pie sobre la base de su caja (como el
 * jugador) y con la pose que toque: andando o lanzando.
 */
function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, assets: RenderAssets) {
  const centerX = boss.x + boss.width / 2;
  if (boss.id === 'pijo') {
    if (!assets.pijoSheet) return fillRect(ctx, boss, COLORS.enemy);
    const frame = pijoFrame(boss.pose, boss.isFlashing);
    return drawFrame(ctx, assets.pijoSheet, frame, PIJO_ANCHOR, centerX, boss.y + boss.height);
  }
  if (!assets.bossSheet) return fillRect(ctx, boss, COLORS.enemy);
  const frame = bossFrame(boss.id, boss.isFlashing);
  drawFrame(ctx, assets.bossSheet, frame, BOSS_ANCHOR, centerX, boss.y + boss.height / 2);
}

/**
 * Nombre de los jefes y su barra de vida, arriba en el centro. Si son varios
 * (los dos pijos), la barra es la vida que les queda entre todos: así se ve de
 * un vistazo cuánto falta para ganar, también cuando ya ha caído uno.
 */
function drawBossBar(ctx: CanvasRenderingContext2D, bosses: readonly Boss[], name: string): void {
  const health = bosses.reduce((sum, boss) => sum + boss.health, 0);
  const maxHealth = bosses[0]!.maxHealth * bosses.length;
  const x = Math.round(ARENA.width / 2 - BOSS_BAR.width / 2);
  const y = BOSS_BAR.top;

  ctx.fillStyle = COLORS.hud;
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(name, ARENA.width / 2, y - 3);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(x - 2, y - 2, BOSS_BAR.width + 4, BOSS_BAR.height + 4);
  // En fase de furia la barra cambia de color para avisar al jugador
  ctx.fillStyle = bosses.some((boss) => boss.isEnraged) ? COLORS.bossEnraged : COLORS.bossHealth;
  ctx.fillRect(x, y, Math.round((BOSS_BAR.width * health) / maxHealth), BOSS_BAR.height);
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

/**
 * Enemigo:
 *   - Barril pequeño: centrado en su caja; en blanco durante el destello de impacto.
 *   - Botella: su base (el ancla) va en el centro del borde superior de su caja.
 *     Las lanzadas por los pijos se giran alrededor del centro hacia donde van
 *     (el dibujo apunta hacia abajo, como el chorro de espuma).
 */
function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, assets: RenderAssets) {
  const { center } = enemy;
  if (enemy.type === 'barrel') {
    if (!assets.minionSheet) return fillRect(ctx, enemy, COLORS.enemy);
    return drawFrame(
      ctx,
      assets.minionSheet,
      minionFrame(enemy.isFlashing),
      MINION_ANCHOR,
      center.x,
      center.y,
    );
  }

  const sheet = assets.enemySheet;
  if (!sheet) return fillRect(ctx, enemy, COLORS.enemy);
  const frame = enemyFrame(enemy.type, enemy.animationFrame);
  if (enemy.heading === 0) return drawFrame(ctx, sheet, frame, ENEMY_ANCHOR, center.x, enemy.y);

  ctx.save();
  ctx.translate(Math.round(center.x), Math.round(center.y));
  ctx.rotate((-enemy.heading * Math.PI) / 180);
  drawFrame(ctx, sheet, frame, ENEMY_ANCHOR, 0, -enemy.height / 2);
  ctx.restore();
}

/** Lata: centrada en su caja de colisión. */
function drawPickup(ctx: CanvasRenderingContext2D, pickup: Pickup, sheet: HTMLImageElement | null) {
  if (!sheet) return fillRect(ctx, pickup, COLORS.pickup);
  const centerX = pickup.x + pickup.width / 2;
  drawFrame(
    ctx,
    sheet,
    pickupFrame(pickup.type),
    PICKUP_ANCHOR,
    centerX,
    pickup.y + pickup.height / 2,
  );
}

/**
 * Espuma: la cabeza del chorro (el ancla) va en el centro del borde inferior de la caja.
 * Los chorros diagonales de los jefes se giran para que la estela quede detrás
 * de la cabeza, en la dirección del movimiento.
 */
function drawFoam(ctx: CanvasRenderingContext2D, bullet: Bullet, sheet: HTMLImageElement | null) {
  if (!sheet) return fillRect(ctx, bullet, COLORS.enemyBullet);
  const frame = foamFrame(bullet.age, ENEMY_BULLET.frameSteps);
  const headX = bullet.x + bullet.width / 2;
  const headY = bullet.y + bullet.height;
  if (bullet.velocityX === 0) return drawFrame(ctx, sheet, frame, FOAM_ANCHOR, headX, headY);

  // El sprite apunta hacia abajo (0°); se gira alrededor de la cabeza hacia su velocidad
  ctx.save();
  ctx.translate(Math.round(headX), Math.round(headY));
  ctx.rotate(-Math.atan2(bullet.velocityX, bullet.velocityY));
  drawFrame(ctx, sheet, frame, FOAM_ANCHOR, 0, 0);
  ctx.restore();
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
function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, assets: RenderAssets): void {
  // Tapado con la chupa se dibuja su pose (si aún no ha cargado, la normal)
  const jacket = player.isShielding ? assets.jacketSheet : null;
  const sheet = jacket ?? assets.playerSheet;
  if (!sheet) {
    // Imagen aún no disponible: rectángulo provisional del color de la vida
    fillRect(ctx, player, healthColor(player));
    return;
  }

  const frame = jacket
    ? { sx: 0, sy: 0, width: jacket.width, height: jacket.height }
    : playerFrame(player.facing, player.animationFrame);
  const feetX = player.x + player.width / 2;
  const feetY = player.y + player.height;
  drawFrame(ctx, sheet, frame, PLAYER_PIVOT, feetX, feetY);

  const barBottom = player.y - HEALTH_BAR.gap;
  drawBar(ctx, feetX, barBottom, player.healthPercent, healthColor(player));
  // Mientras dura el acelerón, una segunda barra encima que se va vaciando
  // Encima, las barras que se van vaciando: el acelerón y la chupa secándose
  let bottom = barBottom;
  for (const [percent, color] of [
    [player.boostPercent, COLORS.playerBoost],
    [player.dryingPercent, COLORS.jacketDrying],
  ] as const) {
    if (percent <= 0) continue;
    bottom -= HEALTH_BAR.height + 2;
    drawBar(ctx, feetX, bottom, percent, color);
  }
}

/** Barra pequeña sobre el jugador, centrada en `centerX` y con su base en `bottomY`. */
function drawBar(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  bottomY: number,
  percent: number,
  color: string,
): void {
  const x = Math.round(centerX - HEALTH_BAR.width / 2);
  const y = Math.round(bottomY - HEALTH_BAR.height);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(x - 1, y - 1, HEALTH_BAR.width + 2, HEALTH_BAR.height + 2);

  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round((HEALTH_BAR.width * percent) / 100), HEALTH_BAR.height);
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
