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
import {
  ARENA,
  COLORS,
  ENEMY_BULLET,
  ENEMY_TYPES,
  FINALE,
  HUD_BARS,
  PLAYER_BULLET,
} from './config';
import type { Boss } from './entities/Boss';
import type { Bullet } from './entities/Bullet';
import type { Enemy } from './entities/Enemy';
import type { Pickup } from './entities/Pickup';
import type { Player } from './entities/Player';
import type { GameSession } from './GameSession';
import type { Rect } from './geometry';
import { alleyMeta } from './playfield';
import { PLAYER_PIVOT, playerFrame, type SpriteFrame } from './sprites/playerSprite';
import {
  ALLEY_DRAW_SCALE,
  alleyLayout,
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
  primoFrame,
  PRIMO_ANCHOR,
  TRUCK_FRAME,
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
  /** Primo pijo (jefe del nivel 5), con sus animaciones de andar y de lanzar barriles. */
  primoSheet: HTMLImageElement | null;
  /** Camión aparcado al final del nivel 5. */
  truckSheet: HTMLImageElement | null;
  pickupSheet: HTMLImageElement | null;
  /** Barriles pequeños (niveles 4 y 5). */
  minionSheet: HTMLImageElement | null;
  /** Pose del jugador tapándose con la chupa (un solo frame, mismo pivote que player.png). */
  jacketSheet: HTMLImageElement | null;
  /** Callejón del nivel en curso. */
  alley: HTMLImageElement | null;
}

const HEALTH_BAR = HUD_BARS.player;
const BOSS_BAR = HUD_BARS.boss;

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

  // 1. Fondo: color de reserva (también "borra" el fotograma anterior), el
  // callejón y, en las calles con final, el camión aparcado
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  drawAlley(ctx, assets.alley, session);
  drawTruck(ctx, assets.truckSheet, session);

  // 2. Entidades. Orden de dibujo = orden de capas: lo que se dibuja después
  // queda encima. La espuma va ANTES que las botellas y el jefe para que su
  // estela quede detrás de ellos y no los tape al salir.
  for (const bullet of session.enemyBullets) drawFoam(ctx, bullet, assets.foamSheet);
  for (const pickup of session.pickups) drawPickup(ctx, pickup, assets.pickupSheet);
  for (const enemy of session.enemies) drawEnemy(ctx, enemy, assets);
  for (const boss of session.bosses) drawBoss(ctx, boss, assets);
  // Al entrar en el ayuntamiento (final del nivel 5) desaparece en lo oscuro de la puerta
  if (session.playerFade < 1) {
    ctx.globalAlpha = 1 - session.playerFade;
    drawPlayer(ctx, session.player, assets);
    ctx.globalAlpha = 1;
  }
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

  // 5. Fundido a negro de la escena final: tapa todo, también el marcador
  if (session.screenFade > 0) {
    ctx.globalAlpha = session.screenFade;
    ctx.fillStyle = COLORS.fade;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.globalAlpha = 1;
  }
}

/**
 * Píxeles que le faltan al callejón para llegar al final de la calle (0 = ya
 * se ve el final), o null si no tiene final.
 */
function roadLeft(session: GameSession): number | null {
  const { cameraEnd } = session.rules;
  return cameraEnd === null ? null : cameraEnd - Math.floor(session.backgroundDistance);
}

/**
 * Dibuja el callejón, desplazado según lo que se ha avanzado.
 *
 * Avanzar por el callejón equivale a que el fondo baje por la pantalla. La
 * imagen es como un mapa colgado de arriba abajo: arriba, lo que no se repite
 * (el final, en las calles que lo tienen), y debajo, lo que se repite en
 * bucle hacia abajo sin fin (el script de sprites funde el final del bucle
 * con su principio para que no se note el empalme).
 *
 * Lo que se ve es una ventana de ese mapa, y `top` es dónde empieza:
 *   - Sin final, va subiendo sin parar (-distancia; el bucle no se acaba nunca).
 *   - Con final, empieza tan abajo como mida la calle y sube hasta dejar a la
 *     vista el final (end.top), donde se para.
 * Coordenadas enteras: con decimales el pixel art se emborrona.
 */
function drawAlley(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null,
  session: GameSession,
): void {
  if (!image) return;

  const { alley } = session.level;
  const scale = ALLEY_DRAW_SCALE;
  const layout = alleyLayout(alley);
  const head = layout.head * scale;
  const loop = layout.loop * scale;
  const left = roadLeft(session);
  const top =
    left === null ? -Math.floor(session.backgroundDistance) : alleyMeta(alley).end!.top + left;

  // De arriba abajo, cada trozo de pantalla sale del final o de su punto del bucle
  for (let y = 0; y < ARENA.height;) {
    const mapY = top + y;
    let sourceTop: number;
    let rows: number;
    if (mapY >= 0 && mapY < head) {
      sourceTop = mapY;
      rows = head - mapY;
    } else {
      // Con el doble módulo, también queda dentro del bucle por encima de 0
      const into = (((mapY - head) % loop) + loop) % loop;
      sourceTop = head + into;
      rows = loop - into;
    }
    const height = Math.min(rows, ARENA.height - y);
    // Solo se copia el trozo de imagen que se ve, no la imagen entera
    ctx.drawImage(
      image,
      0,
      sourceTop / scale,
      image.width,
      height / scale,
      0,
      y,
      ARENA.width,
      height,
    );
    y += height;
  }
}

/**
 * Camión aparcado en la plaza del final (FINALE.truck). Va pegado al suelo:
 * baja con el callejón y aparece cuando asoma la plaza.
 */
function drawTruck(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement | null,
  session: GameSession,
): void {
  const left = roadLeft(session);
  if (!sheet || left === null) return;
  const y = FINALE.truck.y + left;
  if (y >= ARENA.height) return;
  drawFrame(ctx, sheet, TRUCK_FRAME, { x: 0, y: 0 }, FINALE.truck.x, y);
}

/**
 * Jefe, en blanco durante el destello de impacto. Los barriles, centrados en
 * su caja de colisión; el pijo y el primo, de pie sobre la base de su caja
 * (como el jugador) y con la pose que toque: andando o lanzando.
 */
function drawBoss(ctx: CanvasRenderingContext2D, boss: Boss, assets: RenderAssets) {
  const centerX = boss.x + boss.width / 2;
  const feetY = boss.y + boss.height;
  const { id, pose, isFlashing } = boss;
  if (id === 'pijo' || id === 'primo') {
    const sheet = id === 'pijo' ? assets.pijoSheet : assets.primoSheet;
    if (!sheet) return fillRect(ctx, boss, COLORS.enemy);
    return id === 'pijo'
      ? drawFrame(ctx, sheet, pijoFrame(pose, isFlashing), PIJO_ANCHOR, centerX, feetY)
      : drawFrame(
          ctx,
          sheet,
          primoFrame(pose, boss.heldThrow, isFlashing),
          PRIMO_ANCHOR,
          centerX,
          feetY,
        );
  }
  if (!assets.bossSheet) return fillRect(ctx, boss, COLORS.enemy);
  const frame = bossFrame(id, isFlashing);
  drawFrame(ctx, assets.bossSheet, frame, BOSS_ANCHOR, centerX, boss.y + boss.height / 2);
}

/**
 * Nombre de los jefes y su barra de vida, arriba en el centro. Si son varios
 * (los dos pijos), la barra es la vida que les queda entre los que siguen
 * VIVOS. Al caer uno, GameSession lo quita de la lista y la barra pasa a ser
 * solo la del otro, así que vuelve a verse más llena aunque él no se haya curado.
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

  const { border } = BOSS_BAR;
  ctx.fillStyle = COLORS.bossBarFrame;
  ctx.fillRect(x - border, y - border, BOSS_BAR.width + border * 2, BOSS_BAR.height + border * 2);
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
 *   - Barril pequeño: centrado en su caja, sin girar (también los que lanza
 *     el primo); en blanco durante el destello de impacto.
 *   - Botella: su base (el ancla) va en el centro del borde superior de su caja.
 *     Las lanzadas por los pijos se giran alrededor del centro hacia donde van
 *     (el dibujo apunta hacia abajo, como el chorro de espuma).
 */
function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, assets: RenderAssets) {
  const { center } = enemy;
  if (ENEMY_TYPES[enemy.type].kind === 'barrel') {
    if (!assets.minionSheet) return fillRect(ctx, enemy, COLORS.enemy);
    return drawFrame(
      ctx,
      assets.minionSheet,
      minionFrame(enemy.type, enemy.isFlashing),
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
  // Encima, las barras que se van vaciando: el acelerón y la chupa secándose
  let bottom = barBottom;
  for (const [percent, color] of [
    [player.boostPercent, COLORS.playerBoost],
    [player.dryingPercent, COLORS.jacketDrying],
  ] as const) {
    if (percent <= 0) continue;
    bottom -= HEALTH_BAR.height + HEALTH_BAR.stackGap;
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

  const { border } = HEALTH_BAR;
  ctx.fillStyle = COLORS.playerBarFrame;
  ctx.fillRect(
    x - border,
    y - border,
    HEALTH_BAR.width + border * 2,
    HEALTH_BAR.height + border * 2,
  );

  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round((HEALTH_BAR.width * percent) / 100), HEALTH_BAR.height);
}

/** Verde / amarillo / rojo según el % de vida restante. */
function healthColor(player: Player): string {
  if (player.healthPercent >= HUD_BARS.healthyAt) return COLORS.playerHealthy;
  if (player.healthPercent >= HUD_BARS.hurtAt) return COLORS.playerHurt;
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
