# 🍺 Pijo Beer

Shoot'em up arcade de heavy metal contra cervezas pijas.
Migración del proyecto original (HTML + JavaScript vanilla + PHP + MySQL) a un stack moderno:

| Capa          | Tecnología                                                      |
| ------------- | --------------------------------------------------------------- |
| Frontend      | **React 19** + **TypeScript** + **Vite**, React Router, i18next |
| Backend       | **Node.js** + **Express 5** + **TypeScript**                    |
| Base de datos | **PostgreSQL 16** (Docker) + **Prisma** (ORM y migraciones)     |
| Validación    | **Zod** (servidor) + reglas compartidas con el cliente          |
| Calidad       | **Vitest**, Supertest, ESLint, Prettier                         |

---

## Puesta en marcha

Requisitos: **Node.js 20+** y **Docker Desktop**.

```bash
# 1. Dependencias (de todo el monorepo a la vez)
npm install

# 2. Variables de entorno del servidor
cp server/.env.example server/.env
#    -> cambia JWT_SECRET por una clave aleatoria (el propio archivo explica cómo generarla)

# 3. Base de datos: arrancar PostgreSQL y crear las tablas
npm run db:up
npm run db:migrate

# 4. (Opcional) Cuenta de administrador: rellena ADMIN_* en server/.env y ejecuta
npm run db:seed

# 5. Arrancar cliente y servidor a la vez
npm run dev
```

Abre **http://localhost:5173**. La API escucha en http://localhost:3000 (Vite le reenvía todo lo que empieza por `/api`).

> **Verificación de email en local:** todavía no hay un proveedor de correo conectado. Al registrarte,
> el enlace de verificación aparece en pantalla (y en el log del servidor). Solo en desarrollo: en
> producción el servidor nunca lo devuelve.

### Scripts principales (desde la raíz)

| Comando              | Qué hace                                                    |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Cliente + servidor con recarga automática                   |
| `npm test`           | Todos los tests (servidor y cliente)                        |
| `npm run typecheck`  | Comprobación de tipos de todo el monorepo                   |
| `npm run lint`       | ESLint                                                      |
| `npm run format`     | Formatea el código con Prettier                             |
| `npm run build`      | Compila servidor (`server/dist`) y cliente (`client/dist`)  |
| `npm run db:up`      | Arranca PostgreSQL en Docker (`db:down` lo para)            |
| `npm run db:migrate` | Aplica/crea migraciones tras cambiar `schema.prisma`        |
| `npm run db:studio`  | Abre Prisma Studio: ver y editar la BBDD desde el navegador |
| `npm run db:seed`    | Crea/actualiza la cuenta de admin (datos en `server/.env`)  |
| `npm run sprites`    | Regenera todas las hojas de sprites desde `client/art/`     |

---

## Estructura

```
pijobeer/
├── packages/shared/        Contrato común cliente ⇄ servidor
│   └── src/                  validación, niveles, puntos, tipos de la API, códigos de error
│
├── server/                 API REST
│   ├── prisma/               schema.prisma (modelo de datos) + migrations/ (SQL versionado)
│   ├── src/
│   │   ├── index.ts          arranque y apagado ordenado
│   │   ├── app.ts            montaje de Express (middlewares + rutas)
│   │   ├── container.ts      dónde se crean las dependencias reales
│   │   ├── config/env.ts     variables de entorno validadas
│   │   ├── http/middlewares/ validación, autenticación, errores
│   │   ├── modules/          un módulo por recurso:
│   │   │   ├── auth/           registro, login, verificación, sesión (JWT en cookie)
│   │   │   ├── users/          perfil y progreso
│   │   │   └── scores/         partidas y ranking
│   │   └── lib/              logger, prisma, mailer
│   └── tests/                tests de integración HTTP (sin BBDD, repositorios en memoria)
│
├── client/                 SPA en React
│   ├── art/                  ARTE FUENTE: player/, enemies/, projectiles/, bosses/, pickups/, alleys/ (no se publica: solo lo lee el script)
│   ├── scripts/              herramientas (generar las hojas de sprites)
│   └── src/
│       ├── assets/sprites/   hojas de sprites generadas (PNG) + sus metadatos (JSON)
│       ├── game/             MOTOR DEL JUEGO en TypeScript puro (sin React)
│       ├── components/       layout (cabecera, menú, pie) y UI reutilizable
│       ├── pages/            una carpeta/archivo por pantalla
│       ├── features/         estado transversal: sesión (auth) y progreso
│       ├── api/              cliente HTTP y catálogo de endpoints
│       ├── i18n/             traducciones es / en / fr
│       └── styles/           tokens de diseño y estilos globales
│
├── imagenes/               BANDEJA DE ENTRADA del arte nuevo, tal cual llega. Una vez revisado,
│                             se mueve a client/art/ con un nombre limpio y se ejecuta "npm run sprites"
│
└── docker-compose.yml      PostgreSQL para desarrollo
```

### Backend: arquitectura en capas

Cada petición atraviesa siempre las mismas capas y cada una tiene **una sola responsabilidad**:

```
routes ─► middlewares (límite, validación Zod, auth) ─► controller ─► service ─► repository ─► PostgreSQL
```

- **Controller**: traduce HTTP ⇄ servicio. No contiene reglas de negocio.
- **Service**: las reglas ("sin email verificado no se entra", "el nivel nunca baja"). No sabe nada de Express ni de SQL.
- **Repository**: el único sitio que habla con la base de datos (como el antiguo `servidor/datos/`).

Las dependencias se **inyectan** por constructor (`container.ts`). Por eso los tests montan la app
completa con repositorios en memoria y prueban la API de verdad sin necesitar PostgreSQL.

### Frontend: el juego fuera de React

React no está pensado para repintar 60 veces por segundo, así que el juego vive en `client/src/game/`
como TypeScript puro:

- `GameSession` → reglas y estado de una partida (se puede testear sin navegador).
- `renderer` → dibuja ese estado en el canvas.
- `GameLoop` → bucle con **paso de tiempo fijo**: el juego va a la misma velocidad en un monitor de 60 Hz que en uno de 144 Hz.
- `components/GameCanvas` → el puente: arranca el motor al montarse y lo para al desmontarse.

Para tocar la dificultad, las teclas o los colores: **`client/src/game/config.ts`**.
Para añadir un nivel: **`packages/shared/src/levels.ts`** (cliente y servidor se enteran solos).

### Sprites

```
client/art/**/*.png|jpg ──(npm run sprites)──► client/src/assets/sprites/*.png + *.json
```

Todo el arte fuente llega igual (dibujos sobre fondo magenta, a tamaños distintos). El script
`client/scripts/build-sprites.mjs` quita el fondo, detecta cada frame, los escala por igual, los alinea
por un punto fijo (el "ancla") y, si hace falta, los gira. Las herramientas comunes están en
`scripts/sprites/lib.mjs` y cada hoja tiene su módulo:

| Hoja                | Arte fuente        | Frames                                                                | Ancla              |
| ------------------- | ------------------ | --------------------------------------------------------------------- | ------------------ |
| `player.png`        | `art/player/`      | 8 direcciones × (neutro, paso, neutro, paso)                          | pies (32, 69)      |
| `player-jacket.png` | `art/player/`      | 1 (tapándose con la chupa, de espaldas)                               | pies (32, 69)      |
| `enemy-bottles.png` | `art/enemies/`     | 3 colores × 5 (cerrada → chapa → espuma → …)                          | base de la botella |
| `bullet-foam.png`   | `art/projectiles/` | 2 cortos (salida) + 3 largos (en bucle)                               | cabeza del chorro  |
| `bullet-opener.png` | `art/projectiles/` | 4 (llamas en bucle)                                                   | aro del abrechapas |
| `bosses.png`        | `art/bosses/`      | 3 jefes (madera, hierro, pijo) × (normal, destello blanco al recibir) | centro del jefe    |
| `barrel-minion.png` | `art/bosses/`      | barril pequeño (el de madera reducido) × (normal, destello)           | centro del barril  |
| `pickups.png`       | `art/pickups/`     | 2 latas (vida, velocidad), sin animación                              | centro de la lata  |
| `alley-N-*.webp`    | `art/alleys/`      | suelo + paredes de cada callejón (parallax)                           | —                  |

- **`player.json`** lo escribes tú y es la fuente de verdad del jugador (tamaño de frame, filas, pivote,
  velocidad). Los demás `.json` los **genera** el script: no se editan a mano.
- Las botellas se **giran 180°** (cuello hacia abajo) y la espuma **90°** (cabeza hacia abajo).
- Para **retocar un dibujo**: sustituye la imagen en `client/art/` y ejecuta `npm run sprites`.
- Las cajas de colisión (`game/config.ts`) son más pequeñas que los dibujos: el cuerpo del jugador,
  la botella sin la espuma, el aro del abrechapas y la cabeza del chorro.

### Partida: niveles, jefes, pausa y victoria

Todo el diseño de cada nivel está en **`packages/shared/src/levels.ts`**:

| Nivel | Objetivo                         | Botellas salen cada | Velocidad | Tipos de botella                   | Jefe final                                                         |
| ----- | -------------------------------- | ------------------- | --------- | ---------------------------------- | ------------------------------------------------------------------ |
| 1     | 36 botellas                      | 1,5 s               | ×1        | normales                           | —                                                                  |
| 2     | 50 botellas + 1800 px recorridos | 1,2 s               | ×1,15     | normales, rápidas, pesadas         | Barril de madera (80 de vida, ráfagas de 5 apuntadas)              |
| 3     | 60 botellas + 2400 px recorridos | 0,9 s               | ×1,3      | más rápidas y pesadas              | Barril de hierro (140 de vida, ráfagas de 3 abanicos de 3 chorros) |
| 4     | 70 enemigos + 3000 px recorridos | 0,8 s               | ×1,4      | las tres + barriles pequeños (4 %) | Dos pijos (100 de vida cada uno, lanzan botellas teledirigidas)    |

La distancia (`distanceToComplete`) no se le enseña al jugador: son 30, 40 y 50 s mirando hacia delante,
así que pasarse el nivel mirando a los lados no basta para llegar al jefe. Si un admin fija las botellas
a eliminar con sus trucos, la distancia deja de contar (para poder probar el jefe sin esperar).

- **Tipos de enemigo** (`ENEMY_TYPES` en `game/config.ts`; puntos en `ENEMY_POINTS`): el dibujo indica el tipo.
  Rosa = normal, dorada = rápida (dispara igual), negra = pesada (más lenta, dispara el doble). En el nivel 4,
  además, **barriles de madera pequeños**: van a la velocidad de la negra, aguantan 3 impactos (destellan en
  blanco con cada uno), apuntan al jugador y dan 50 puntos en vez de 10.
- **Disparos**: el jugador dispara siempre recto hacia arriba y las botellas recto hacia abajo. Los jefes y
  los barriles pequeños apuntan a donde está el jugador **en el momento del disparo**; la espuma sigue recta,
  sin perseguirle. Cada abrechapas quita **5 de vida** a un jefe (`PLAYER_BULLET.damage`).
- **La chupa** (tecla **B**, niveles 3 y 4; `JACKET` en `game/config.ts`): manteniéndola, el jugador se tapa y
  la espuma no le hace daño, pero no puede moverse ni disparar. Para **3 chorros** y se empapa: tarda **5 s** en
  secarse (barra azul). No protege de los botellazos (chocar con una botella o con un jefe).
- **Callejones**: uno por nivel, en bucle, como una **cinta de correr** (`CAMERA` en `game/config.ts`):

  | Situación                                    | Avance del callejón (px/paso) |
  | -------------------------------------------- | ----------------------------- |
  | Mirando recto hacia delante, sin pulsar nada | 1 (corre en el sitio)         |
  | Manteniendo W                                | 2,5 (esprinta)                |
  | Manteniendo W, ya en media pantalla          | 4                             |
  | En diagonal (W+A o W+D), solo mientras pulsa | lo de arriba × 0,7            |
  | Mirando a un lado o atrás, o contra el jefe  | 0                             |

  El personaje **no sube de media pantalla** (`PLAYER.minY`): a partir de ahí lo que corre es el callejón.
  Por debajo se mueve libremente para esquivar. Botellas, latas y balas enemigas caen a su velocidad **más
  la del callejón**: si el jugador avanza, todo le viene encima más deprisa (nunca parece quieto ni que se
  aleja con el suelo); parado, cada cosa cae a su ritmo. Las paredes son el límite de la zona jugable
  (`game/playfield.ts`; la medida sale del propio arte al generar los sprites).

- **Jefes**: al cumplir el objetivo entran los jefes del nivel (en el 4, dos a la vez) y las botellas siguen
  cayendo a la mitad de ritmo. Se quedan arriba moviéndose de pared a pared y atacan en ráfagas que apuntan al
  jugador: los barriles con chorros de espuma; los **pijos**, lanzando botellas de cualquier tipo que van a por
  él girando poco a poco (`THROWN_BOTTLE`) y que disparan hacia donde van. Cuando les queda un 20 % de vida
  entran en **furia** (barra rosa) y van más rápido:
  - Madera: 2 chorros más por disparo, pero la **mitad de ráfagas** (del mismo tamaño).
  - Hierro: 1 chorro más y menos pausa, siempre con más de 20° entre chorro y chorro para poder esquivarlos.
  - Pijos: una botella cada segundo en vez de cada dos.

  Con varios jefes, la barra es la vida que les queda entre todos. Se gana al vaciarla. Sus valores: `BOSS`, `BOSS_ENRAGE` y `BOSS_COMMON` en `game/config.ts`. Premio en puntos: `BOSS_POINTS` en `packages/shared/src/game-rules.ts`.

- **Latas** (`PICKUP` y `PICKUP_TYPES` en `game/config.ts`): cada cierto tiempo cae una, también contra el
  jefe. La **verde** cura y la de **leopardo** hace disparar el doble de rápido durante 6 s (una barra
  amarilla sobre la vida marca lo que queda). Se recogen al tocarlas y las balas las atraviesan.

  | Dificultad | Sale una lata cada | La verde cura |
  | ---------- | ------------------ | ------------- |
  | Fácil      | 12 s               | 30            |
  | Normal     | 15 s               | 25            |
  | Difícil    | ~21 s              | 25            |

  En difícil salen menos, así que cada una cura lo mismo que en normal.

- **Dificultad** (en _Opciones_; se recuerda en el navegador): _Fácil_, _Normal_ (el juego tal cual) y
  _Difícil_. Multiplica velocidad y ritmo de botellas, vida de los jefes, daño recibido, puntos
  (×0,5 / ×1 / ×2), latas y **disparos del jugador** (~3,5 / 3 / 2,4 por segundo).
  Valores: `packages/shared/src/difficulty.ts`.
- Las reglas finales de una partida (nivel + dificultad + trucos de admin) se calculan en un único sitio:
  `game/rules.ts`.
- **Menú de Jugar**: _Jugar_, _Elegir nivel_ y _Opciones_. Las dos últimas abren una ventana modal
  (`components/ui/Dialog`, sobre el `<dialog>` nativo). _Opciones_ (`pages/PlayPage/OptionsDialog.tsx`)
  tiene la dificultad y la música, y está pensada para ir sumando apartados (p. ej. la skin del personaje).
- **Textos de historia** (`pages/PlayPage/story.ts`, `components/StoryOverlay`): paran la partida y siguen
  solos al cabo de unos segundos.
  - Nivel 3, justo antes del jefe y **solo la primera vez** (se recuerda en el navegador): cómo usar la chupa.
  - Nivel 4, siempre y con botón para saltarlos: el de Marcus al empezar y el diálogo con los pijos antes
    de que aparezcan.

  El motor solo sabe "pararse" en esos momentos (`DialogMoment` en `GameSession`); qué texto toca lo decide
  la página.

- **Pausa** (tecla P): menú con el **altavoz** (silenciar) y la barra de **volumen** de la música,
  _Continuar_ y _Salir al menú principal_.
- **Victoria**: menú en verde neón con letras pixel art (fuente _Press Start 2P_) con _Siguiente nivel_
  (si existe) y _Volver al menú_. Se desbloquea el siguiente nivel y se guarda la partida.
- Al entrar en el menú y al empezar una partida la página se **centra sola**: el menú y el juego están en
  un "escenario" que mide lo mismo que la ventana y centra su contenido, así quedan en el centro de
  cualquier pantalla. El teclado pasa al canvas. Los avisos
  (puntuación guardada, trucos activos) flotan encima y no mueven el juego.
- Las **botellas** disparan con animación: salta la chapa (aviso) → la espuma sale en la explosión.
- Los menús son HTML sobre el canvas (`components/GameOverlay`), así funcionan con teclado y lector de pantalla.

### Idiomas

Los textos están ya traducidos en `client/src/i18n/locales/` (`es.json`, `en.json`, `fr.json`), uno por
idioma, con las mismas claves. Los componentes piden `t('credits.music')` e **i18next** devuelve el texto
del idioma elegido: sin APIs, al instante y sin conexión. Un test comprueba que ningún idioma se deja
claves ni variables.

Los **nombres propios** (juego, autor, grupo, protagonista) no se traducen: están solo en `client/src/brand.ts` y los
textos los usan como `{{game}}`, `{{author}}`, `{{band}}` y `{{hero}}`. Otro test impide escribirlos a mano en los JSON.

### Juego admin (solo administradores)

Sección `/admin`, visible en el menú solo para cuentas con `isAdmin`. Permite cambiar los **trucos** de las
partidas de prueba del propio admin: inmortal, botellas a eliminar, velocidad y cantidad de botellas, vida
de los jefes. Las partidas con algún truco activo **no se guardan en el ranking**. El servidor valida cada
valor con los límites de `GAME_MODIFIER_LIMITS` (`packages/shared/src/game-modifiers.ts`).

### Música

En _Opciones_ se elige el **volumen** y el **estilo**: _Heavy metal_, _Hard rock_, _Black metal_ o
**_Tu música_**. Los ajustes se recuerdan en el navegador.

- Las canciones de cada estilo van en `client/src/assets/music/<estilo>/` (`heavy-metal`, `hard-rock`,
  `black-metal`), con cualquier nombre (.ogg o .mp3). Suenan **al azar**, una detrás de otra. No hay que
  tocar código: el juego las detecta al compilar.
- `pijobeer/sound/<estilo>/` funciona igual, pero está en `.gitignore`: lo que hay ahí (p. ej. las canciones
  de black metal) suena en local y nunca se publica, por los derechos de autor.
- Solo suena en la página de _Jugar_ (menú y partida), sin cortarse al pasar de una a otra. El altavoz
  (silenciar) y el volumen están junto a la barra, en Opciones y en el menú de pausa (tecla P).
- **Tu música**: el jugador sube canciones **.mp3** sueltas o **una carpeta entera** (un álbum). Suenan en
  orden de pista, una detrás de otra y en bucle, sin cortarse al cambiar de pantalla, y se puede saltar a la
  siguiente. Límites (`MP3_LIMITS` en `audio/mp3File.ts`): 60 MB por canción y 300 MB en total (un álbum
  a 320 kbps son unos 110-120 MB, así que caben dos), hasta 100 canciones.
- **Seguridad**: los archivos **no salen nunca del navegador** (se guardan en IndexedDB,
  `audio/customTrackStore.ts`), así que no pueden llegar al servidor ni a otros jugadores. Se comprueba la
  extensión, el tipo y el **contenido**: se salta la etiqueta ID3 y se busca una cabecera de fotograma MP3
  válida, así que un archivo cualquiera renombrado a `.mp3` se descarta. Se reproducen con `<audio>`, que no
  ejecuta nada, y la CSP del servidor admite URLs `blob:` solo para audio (`media-src`), nunca para scripts.

---

## API

Todas las respuestas son JSON. Los errores tienen siempre la forma
`{ "error": { "code": "USERNAME_TAKEN", "message": "...", "details"?: [...] } }`;
el cliente traduce `code` al idioma del jugador.

| Método | Ruta                     | Sesión | Descripción                        |
| ------ | ------------------------ | :----: | ---------------------------------- |
| POST   | `/api/auth/register`     |        | Crear cuenta                       |
| POST   | `/api/auth/verify-email` |        | Confirmar email con el token       |
| POST   | `/api/auth/login`        |        | Iniciar sesión (pone cookie)       |
| POST   | `/api/auth/logout`       |        | Cerrar sesión                      |
| GET    | `/api/auth/me`           |        | Usuario actual (`null` si no hay)  |
| PATCH  | `/api/users/me`          |   ✔    | Cambiar nombre y/o contraseña      |
| PATCH  | `/api/users/me/progress` |   ✔    | Guardar nivel desbloqueado / intro |
| POST   | `/api/scores`            |   ✔    | Guardar resultado de una partida   |
| GET    | `/api/scores/ranking`    |        | Top 10                             |
| GET    | `/api/scores/me`         |   ✔    | Mis partidas y resumen             |
| GET    | `/api/health`            |        | Estado del servidor y la BBDD      |
| GET    | `/api/admin/modifiers`   | admin  | Trucos actuales                    |
| PUT    | `/api/admin/modifiers`   | admin  | Cambiar trucos (campos parciales)  |

---

## Del proyecto original a este

| Original                                   | Ahora                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| 8 archivos `.htm` con la navbar copiada    | `index.html` único + `components/layout/*` + `router.tsx`   |
| `funciones/juego.js`                       | `game/GameSession.ts` + `GameLoop.ts` + `renderer.ts`       |
| `jugador.js`, `enemigo.js`, `disparos.js`  | `game/entities/Player.ts`, `Enemy.ts`, `Bullet.ts`          |
| `controles.js`                             | `game/config.ts` (CONTROLS) + `game/input/KeyboardInput.ts` |
| `niveles.js` + `NIVELES_QUE_EXISTEN` (PHP) | `packages/shared/src/levels.ts` (una sola definición)       |
| `idiomas.js` (API MyMemory en directo)     | `i18n/` con traducciones fijas es/en/fr                     |
| `sesion.js` + `PROMESA_SESION`             | `features/auth/AuthProvider.tsx` + `useAuth()`              |
| `progreso.js`                              | `features/progress/useProgress.ts`                          |
| `login.js`, `perfil.js`, `puntuacion.js`   | `pages/LoginPage/*`, `ProfilePage.tsx`, `ScoresPage/*`      |
| `crawl.css` + texto duplicado              | `components/StarWarsCrawl/` (un componente, dos usos)       |
| `servidor/*.php`                           | `server/src/modules/*/` (routes + controller + service)     |
| `servidor/datos/*.php`                     | `server/src/modules/*/*.repository.ts`                      |
| `instalar.php`                             | `prisma/schema.prisma` + migraciones                        |
| `$_SESSION` de PHP                         | JWT firmado en cookie `httpOnly`                            |
| MySQL (XAMPP)                              | PostgreSQL (Docker)                                         |

### Bugs del original corregidos en la migración

- **Velocidad dependiente del monitor**: el juego iba 2,4× más rápido a 144 Hz. Ahora usa paso de tiempo fijo.
- **Progreso en la cuenta sin conectar**: `progreso.js` existía pero `juego.htm` no lo cargaba.
- **Columna `intro_vista`** usada en el código pero no creada por `instalar.php`.
- **Sesión invisible** en Inicio, Jugar, Historia, Controles y Créditos (no cargaban `sesion.js`).
- **El ranking nunca se llenaba**: el juego no calculaba puntos ni llamaba a `guardar-puntuacion.php`. Ahora cada pijo vale 10 puntos y la partida se guarda al terminar.
- **"C: Disparar"** en Controles cuando el juego dispara con la **V**. Ahora la página lee la configuración real.
- **Bucle y teclado "fantasma"**: seguían activos al salir de la partida. Ahora se limpian al desmontar.
- **Teclas atascadas** al cambiar de ventana con una pulsada.
- **Texto "PAUSA"** que se redibujaba encima de sí mismo cada fotograma.

### Mejoras de seguridad

- Mismo mensaje para "usuario no existe" y "contraseña incorrecta", con tiempos de respuesta igualados (anti-enumeración).
- Límite de intentos en login y registro (anti fuerza bruta).
- Sesión en cookie `httpOnly` + `SameSite=Lax` (no la puede leer un script inyectado).
- Cabeceras de seguridad HTTP con Helmet.
- El servidor rechaza puntuaciones imposibles (no múltiplos de 10 o fuera de rango) y niveles inexistentes.
- Los errores internos nunca llegan al navegador; quedan en el log.

---

## Pendiente / siguientes pasos

- Conectar un proveedor de correo real (crear un `Mailer` nuevo en `server/src/lib/mailer.ts` y registrarlo en `container.ts`).
- Login con Google (OAuth 2.0): exige registrar la aplicación en Google Cloud Console.
- Más niveles: basta con añadirlos a `packages/shared/src/levels.ts`.
- Moderación desde "juego admin" (borrar tramposos del ranking) y ventajas premium (`isPremium`, el campo ya existe).
- Parallax real del fondo: necesitaría el arte de las paredes en una imagen aparte, con el centro transparente.
- Despliegue: `npm run build` y `node server/dist/index.js` sirven API y web desde un único proceso.
