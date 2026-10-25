/**
 * ESQUELETO COMÚN de todas las páginas: cabecera, menú, contenido y pie.
 *
 * <Outlet /> es el hueco donde React Router pinta la página que toque
 * según la URL. La cabecera y el menú se escriben UNA vez aquí; en el
 * proyecto original estaban copiados en cada uno de los 8 archivos .htm.
 */
import { Outlet } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';
import styles from './Layout.module.css';
import { NavMenu } from './NavMenu';
import { ScrollToTop } from './ScrollToTop';

export function Layout() {
  return (
    <>
      <ScrollToTop />
      <Header />
      <NavMenu />
      <main className={styles.main}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
