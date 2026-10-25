/**
 * CONTROLADOR DE AUTENTICACIÓN: la frontera entre HTTP y el servicio.
 *
 * Cada método:
 *   1. Saca lo que necesita de la petición (req.body ya viene validado).
 *   2. Llama al servicio.
 *   3. Elige el código HTTP, pone o quita la cookie y responde.
 *
 * No contiene reglas de negocio: si te encuentras escribiendo un "if" sobre
 * los datos del usuario aquí, probablemente debería ir en el servicio.
 *
 * Los métodos son funciones flecha (= async (req, res) => ...) para que
 * "this" siga apuntando al controlador cuando Express los llama sueltos.
 */
import type { Request, Response } from 'express';
import type {
  MeResponse,
  RegisterResponse,
  UserResponse,
  VerifyEmailResponse,
} from '@pijobeer/shared';
import type { AuthService } from './auth.service';
import type { LoginInput, RegisterInput, VerifyEmailInput } from './auth.schemas';
import { clearSessionCookie, setSessionCookie } from './session-cookie';

export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** POST /api/auth/register -> 201 Created */
  register = async (req: Request, res: Response<RegisterResponse>): Promise<void> => {
    const result = await this.auth.register(req.body as RegisterInput);
    res.status(201).json(result);
  };

  /** POST /api/auth/login -> 200 + cookie de sesión */
  login = async (req: Request, res: Response<UserResponse>): Promise<void> => {
    const { user, token } = await this.auth.login(req.body as LoginInput);
    setSessionCookie(res, token);
    res.json({ user });
  };

  /** POST /api/auth/logout -> 204 No Content (no hay nada que devolver) */
  logout = (_req: Request, res: Response): void => {
    clearSessionCookie(res);
    res.status(204).end();
  };

  /**
   * GET /api/auth/me -> ¿quién soy?
   *
   * Responde 200 con { user: null } cuando no hay sesión, en vez de un 401:
   * "no haber iniciado sesión" es un estado normal para esta consulta (la
   * hace cada página al cargar), no un error. Así no se llena la consola
   * del navegador de errores rojos para cada visitante anónimo.
   */
  me = async (req: Request, res: Response<MeResponse>): Promise<void> => {
    if (req.userId === undefined) {
      res.json({ user: null });
      return;
    }

    const user = await this.auth.getCurrentUser(req.userId);
    // El token era válido pero la cuenta ya no existe: limpiamos la cookie huérfana
    if (!user) clearSessionCookie(res);

    res.json({ user });
  };

  /** POST /api/auth/verify-email -> 200 con el nombre del jugador */
  verifyEmail = async (req: Request, res: Response<VerifyEmailResponse>): Promise<void> => {
    const { token } = req.body as VerifyEmailInput;
    res.json(await this.auth.verifyEmail(token));
  };
}
