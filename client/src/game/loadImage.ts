/**
 * Carga de imágenes para el canvas, con caché.
 *
 * ctx.drawImage() necesita una imagen YA descargada y descodificada; si se le
 * pasa una a medio cargar, no dibuja nada. Esta función devuelve una promesa
 * que se cumple cuando la imagen está lista.
 *
 * La caché (un Map por URL) hace que cada imagen se descargue UNA sola vez
 * aunque se jueguen muchas partidas: la segunda partida la recibe al instante.
 */
const cache = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let pending = cache.get(url);

  if (!pending) {
    const image = new Image();
    image.src = url;
    // decode() espera a que la imagen esté descargada Y descodificada, así el
    // primer drawImage no provoca un parón en mitad de la partida
    pending = image.decode().then(() => image);
    // Si falla (archivo no encontrado...), se borra de la caché para poder reintentar
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }

  return pending;
}
