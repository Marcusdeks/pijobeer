/**
 * AGENTE DE "JUEGO ADMIN": un asistente con IA (Claude) que entiende peticiones
 * en lenguaje natural ("bájame los enemigos a 2", "hazme inmortal") y las
 * convierte en cambios de los trucos del administrador.
 *
 * Cómo funciona (uso de herramientas / "tool use"):
 *   1. Se envía a Claude la conversación y una lista de HERRAMIENTAS: funciones
 *      nuestras con su descripción y los parámetros que aceptan.
 *   2. Claude decide si necesita alguna y la "llama": nos devuelve qué
 *      herramienta quiere usar y con qué valores.
 *   3. El SDK ejecuta nuestra función, le devuelve el resultado a Claude, y
 *      repite hasta que Claude da su respuesta final en texto. Ese bucle lo
 *      lleva el "tool runner" del SDK oficial de Anthropic.
 *
 * Seguridad: Claude NUNCA toca la base de datos directamente. Solo puede usar
 * las 4 herramientas de abajo, que validan cada valor con los mismos límites
 * que el panel manual y solo afectan al administrador que está hablando.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import {
  GAME_MODIFIER_LIMITS as LIMITS,
  LEVELS,
  type AgentMessage,
  type GameModifiers,
} from '@pijobeer/shared';
import { AppError } from '../../errors/app-error';
import { logger } from '../../lib/logger';
import { modifiersUpdateSchema } from './modifiers';

/** Lo que el agente puede hacer, ya ligado al administrador que pregunta. */
export interface AgentOperations {
  getModifiers(): Promise<GameModifiers>;
  updateModifiers(changes: Partial<GameModifiers>): Promise<GameModifiers>;
  resetModifiers(): Promise<GameModifiers>;
  unlockAllLevels(): Promise<void>;
}

export interface GameAgent {
  /** Responde al último mensaje de la conversación, usando las operaciones si hace falta. */
  reply(messages: AgentMessage[], operations: AgentOperations): Promise<string>;
}

/** Modelo de Claude que usa el agente. */
const MODEL = 'claude-opus-5-5';

/** Máximo de vueltas herramienta-respuesta por mensaje (corta bucles y limita el gasto). */
const MAX_ITERATIONS = 6;

/**
 * Instrucciones fijas del agente. Van sin datos que cambien (fechas, ids...)
 * para que la API pueda reutilizarlas de una petición a otra (caché de prompt).
 */
const SYSTEM_PROMPT = `Eres el asistente de administración del videojuego "Pijo Beer", un shoot'em up arcade donde un heavy elimina botellas de cerveza pija con un abrechapas en llamas.

Ayudas al administrador a configurar SUS partidas de prueba usando las herramientas disponibles. Lo que puedes cambiar:
- invincible: el jugador no pierde vida ("hazme inmortal").
- killsToComplete: botellas a eliminar en TODOS los niveles; null = las de cada nivel. Entre ${LIMITS.killsToComplete.min} y ${LIMITS.killsToComplete.max}.
- enemySpeed: multiplicador de la velocidad de las botellas (1 = normal), entre ${LIMITS.enemySpeed.min} y ${LIMITS.enemySpeed.max}.
- spawnRate: multiplicador de cuántas botellas salen (2 = el doble), entre ${LIMITS.spawnRate.min} y ${LIMITS.spawnRate.max}.
- bossHealth: multiplicador de la vida de los jefes, entre ${LIMITS.bossHealth.min} y ${LIMITS.bossHealth.max}.
También puedes desbloquear todos los niveles de su cuenta.

Niveles del juego: ${LEVELS.map((l) => `nivel ${l.id}: ${l.killsToComplete} botellas${l.boss ? ', con jefe final' : ''}`).join('; ')}.

Reglas:
- Si te piden algo que se puede hacer con las herramientas, hazlo y confirma en una frase qué ha quedado.
- Si te piden un valor fuera de rango, usa el más cercano permitido y dilo.
- Si te piden algo que no puedes hacer, dilo y explica lo que sí puedes hacer.
- Las partidas con algún truco activo no cuentan para el ranking: menciónalo la primera vez que actives uno.
- Responde siempre en el idioma del administrador, en tono breve y directo.`;

export class ClaudeGameAgent implements GameAgent {
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async reply(messages: AgentMessage[], ops: AgentOperations): Promise<string> {
    try {
      const finalMessage = await this.client.beta.messages.toolRunner({
        model: MODEL,
        max_tokens: 16000,
        // Peticiones sencillas: con esfuerzo bajo responde rápido y gasta menos
        output_config: { effort: 'low' },
        // Si un filtro de seguridad rechazara la petición por error, la API la
        // reintenta sola con otro modelo en la misma llamada
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        max_iterations: MAX_ITERATIONS,
        tools: this.tools(ops),
        messages,
      });

      if (finalMessage.stop_reason === 'refusal') {
        return 'No puedo ayudarte con esa petición. Prueba a pedirme un cambio de los trucos del juego.';
      }

      const text = finalMessage.content
        .flatMap((block) => (block.type === 'text' ? [block.text] : []))
        .join('\n')
        .trim();
      return text || 'Hecho.';
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        logger.error({ status: error.status, message: error.message }, 'Fallo del agente de admin');
        throw new AppError(502, 'AGENT_FAILED', 'Agent request failed');
      }
      throw error;
    }
  }

  /** Las herramientas que Claude puede usar, ligadas a las operaciones de este admin. */
  private tools(ops: AgentOperations) {
    /** Las herramientas devuelven texto JSON: es lo que Claude lee como resultado. */
    const json = (value: unknown) => JSON.stringify(value);

    return [
      betaTool({
        name: 'get_game_settings',
        description: 'Devuelve los trucos activos ahora mismo para el administrador.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        run: async () => json(await ops.getModifiers()),
      }),

      betaTool({
        name: 'update_game_settings',
        description:
          'Cambia uno o varios trucos. Solo se modifican los campos que se envían; el resto se queda como está.',
        inputSchema: {
          type: 'object',
          properties: {
            invincible: { type: 'boolean', description: 'true = el jugador no pierde vida' },
            killsToComplete: {
              type: ['integer', 'null'],
              minimum: LIMITS.killsToComplete.min,
              maximum: LIMITS.killsToComplete.max,
              description:
                'Botellas a eliminar en todos los niveles; null = las normales de cada nivel',
            },
            enemySpeed: {
              type: 'number',
              minimum: LIMITS.enemySpeed.min,
              maximum: LIMITS.enemySpeed.max,
              description: 'Multiplicador de la velocidad de las botellas (1 = normal)',
            },
            spawnRate: {
              type: 'number',
              minimum: LIMITS.spawnRate.min,
              maximum: LIMITS.spawnRate.max,
              description: 'Multiplicador de cuántas botellas aparecen (1 = normal)',
            },
            bossHealth: {
              type: 'number',
              minimum: LIMITS.bossHealth.min,
              maximum: LIMITS.bossHealth.max,
              description: 'Multiplicador de la vida de los jefes finales (1 = normal)',
            },
          },
          additionalProperties: false,
        },
        run: async (input) => {
          // Segunda validación, con exactamente las mismas reglas que el panel manual
          const parsed = modifiersUpdateSchema.safeParse(input);
          if (!parsed.success) return json({ error: parsed.error.issues.map((i) => i.message) });
          return json(await ops.updateModifiers(parsed.data));
        },
      }),

      betaTool({
        name: 'reset_game_settings',
        description: 'Quita todos los trucos y deja el juego normal.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        run: async () => json(await ops.resetModifiers()),
      }),

      betaTool({
        name: 'unlock_all_levels',
        description: 'Desbloquea todos los niveles en la cuenta del administrador.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        run: async () => {
          await ops.unlockAllLevels();
          return json({ ok: true, levels: LEVELS.length });
        },
      }),
    ];
  }
}
