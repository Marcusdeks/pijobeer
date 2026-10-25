# Música

Cada estilo de música del menú de **Opciones** tiene su carpeta aquí dentro:

```
music/
├── heavy-metal/
├── hard-rock/
└── black-metal/
```

En cada carpeta van las canciones de ese estilo en **.ogg** (recomendado: pesa poco y suena bien) o
**.mp3**, con estos nombres exactos:

| Archivo       | Cuándo suena                                |
| ------------- | ------------------------------------------- |
| `menu.ogg`    | Portada y menú de "Jugar"                   |
| `level-1.ogg` | Nivel 1                                     |
| `level-2.ogg` | Nivel 2                                     |
| `level-3.ogg` | Nivel 3                                     |
| `level.ogg`   | Cualquier nivel que no tenga canción propia |
| `boss.ogg`    | Combate contra un jefe final                |

No hace falta tocar código: el juego detecta solo qué archivos hay. Las que falten no suenan.
Las canciones se repiten en bucle, así que conviene que el final empalme con el principio.

**Ojo con los derechos de autor**: este repositorio es público. Aquí solo puede ir música propia o con
licencia libre (p. ej. CC0 o CC-BY, citando al autor en Créditos). Para escuchar canciones comerciales
está la opción **"Subir tu canción"**: el MP3 se queda en el navegador del jugador y nunca se sube a
ningún servidor ni al repositorio.
