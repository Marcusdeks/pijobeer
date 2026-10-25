# Música

Cada estilo de música del menú de **Opciones** tiene su carpeta aquí dentro:

```
music/
├── heavy-metal/
├── hard-rock/
└── black-metal/
```

En cada carpeta van las canciones de ese estilo en **.ogg** (recomendado: pesa poco y suena bien) o
**.mp3**, con el nombre que quieras: el nombre del archivo es el que se ve en Opciones
(`noche-negra.mp3` -> "Noche Negra").

Suenan **al azar**, una detrás de otra, en el menú de Jugar y durante la partida. No hace falta tocar
código: el juego detecta solo qué archivos hay. Un estilo sin canciones no suena.

**Música solo para tu equipo**: `pijobeer/sound/<estilo>/` funciona igual que estas carpetas, pero está
en `.gitignore`, así que lo que pongas ahí suena en local y nunca se publica.

**Ojo con los derechos de autor**: este repositorio es público. Aquí solo puede ir música propia o con
licencia libre (p. ej. CC0 o CC-BY, citando al autor en Créditos). Para escuchar canciones comerciales
está la opción **"Tu música"** (canciones sueltas o una carpeta): los MP3 se quedan en el navegador del jugador y nunca se suben a
ningún servidor ni al repositorio.
