/**
 * Vuelve arriba del todo al cambiar de página.
 *
 * Con páginas HTML normales el navegador lo hace solo. En una SPA no hay
 * recarga, así que sin esto, al pulsar un enlace estando abajo, la página
 * nueva aparecería ya desplazada.
 *
 * Es useLayoutEffect y no useEffect para que suba ANTES de que las páginas
 * hagan sus propios desplazamientos (PlayPage centra el juego en un useEffect):
 * React ejecuta todos los useLayoutEffect antes que cualquier useEffect. Con
 * useEffect, este (el del padre) iría después y desharía el de la página.
 */
import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
