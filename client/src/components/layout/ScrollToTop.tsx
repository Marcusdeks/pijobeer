/**
 * Vuelve arriba del todo al cambiar de página.
 *
 * Con páginas HTML normales el navegador lo hace solo. En una SPA no hay
 * recarga, así que sin esto, al pulsar un enlace estando abajo, la página
 * nueva aparecería ya desplazada.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router';

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
