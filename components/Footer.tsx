import React, { memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useContact } from '@/contexts/ContactContext';
import styles from '@/styles/Footer.module.css';

/**
 * ✅ OPTIMIZADO: Footer con React.memo para evitar re-renders innecesarios
 */
const FooterComponent: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const { openContactModal } = useContact();

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.footerContent}>
          {/* Logo y descripción */}
          <div className={styles.footerBrand}>
            <div className={styles.logoContainer}>
              <Image
                src="/logos/logo notificaciones.png"
                alt="Lozano Nahuel Logo"
                width={180}
                height={180}
                className={styles.footerLogo}
              />
            </div>
            <p className={styles.brandDescription}>
              Desde 2016 promoviendo la educación financiera para mejorar la calidad de vida de las personas
            </p>
          </div>

          {/* Grid de tarjetas 3x2 */}
          <div className={styles.cardsGrid}>
            {/* Fila 1 */}
            <div className={styles.linkCard}>
              <h4 className={styles.cardTitle}>Alertas</h4>
              <ul className={styles.linkList}>
                <li><Link href="/alertas/trader-call" className={styles.footerLink}>Trader Call</Link></li>
                <li><Link href="/alertas/smart-money" className={styles.footerLink}>Smart Money</Link></li>
              </ul>
            </div>

            <div className={styles.linkCard}>
              <h4 className={styles.cardTitle}>Entrenamientos</h4>
              <ul className={styles.linkList}>
                <li><Link href="/entrenamientos/zero2trader" className={styles.footerLink}>Zero 2 Trader</Link></li>
              </ul>
            </div>

            <div className={styles.linkCard}>
              <h4 className={styles.cardTitle}>Asesorías</h4>
              <ul className={styles.linkList}>
                <li><Link href="/asesorias/consultorio-financiero" className={styles.footerLink}>Consultorio Financiero</Link></li>
              </ul>
            </div>

            {/* Fila 2 */}
            <div className={styles.linkCard}>
              <h4 className={styles.cardTitle}>Indicadores</h4>
              <ul className={styles.linkList}>
                <li><Link href="/mediasmovilesautomaticas" className={styles.footerLink}>Medias Móviles Automáticas</Link></li>
                <li><Link href="/rsiconhistoricos" className={styles.footerLink}>RSI con Históricos</Link></li>
              </ul>
            </div>

            <div className={styles.linkCard}>
              <h4 className={styles.cardTitle}>Recursos</h4>
              <ul className={styles.linkList}>
                <li><Link href="/recursos#tradingview-descuento" className={styles.footerLink}>TradingView</Link></li>
                <li><Link href="/recursos#biblioteca-inversor" className={styles.footerLink}>Biblioteca del inversor</Link></li>
                <li><Link href="/recursos#informacion-traders" className={styles.footerLink}>Información para Traders</Link></li>
              </ul>
            </div>

            <div className={styles.linkCard}>
              <h4 className={styles.cardTitle}>Empresa</h4>
              <ul className={styles.linkList}>
                <li><button onClick={openContactModal} className={styles.footerButton}>Contacto</button></li>
                <li><Link href="/cookies" className={styles.footerLink}>Política de Cookies</Link></li>
              </ul>
            </div>

          </div>
        </div>

        {/* Footer bottom */}
        <div className={styles.footerBottom}>
          <div className={styles.footerBottomContent}>
            <p className={styles.copyright}>
              © {currentYear} Nahuel Lozano. Todos los derechos reservados.
            </p>
            
            <a 
              href="https://l40s.vercel.app/" 
              target="_blank" 
              rel="noopener noreferrer"
              className={styles.devStudioLink}
            >
              L40S dev studio
            </a>
            
            <div className={styles.socialLinks}>
              <a href="https://www.youtube.com/@LozanoNahuel" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <div className={styles.socialIcon} style={{ backgroundColor: '#FF0000' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a2.869 2.869 0 0 0-2.018-2.031C19.622 3.742 12 3.742 12 3.742s-7.622 0-9.48.413a2.869 2.869 0 0 0-2.018 2.031C0 8.07 0 12 0 12s0 3.93.502 5.814a2.869 2.869 0 0 0 2.018 2.031C4.378 20.258 12 20.258 12 20.258s7.622 0 9.48-.413a2.869 2.869 0 0 0 2.018-2.031C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.609 15.609v-7.218L15.327 12l-5.718 3.609z"/>
                  </svg>
                </div>
              </a>
              
              <a href="https://x.com/lozanonahuelok" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <div className={`${styles.socialIcon} ${styles.socialIconInverted}`} style={{ backgroundColor: '#000000' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </div>
              </a>
              
              <a href="https://www.tiktok.com/@lozanonahuelok" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <div className={`${styles.socialIcon} ${styles.socialIconInverted}`} style={{ backgroundColor: '#000000' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                  </svg>
                </div>
              </a>
              
              <a href="https://www.instagram.com/lozanonahuel/" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <div className={styles.socialIcon} style={{ backgroundColor: '#E4405F' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
              </a>
              
              <a href="https://t.me/lozanonahuelcomunidad/1" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <div className={styles.socialIcon} style={{ backgroundColor: '#0088cc' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
              </a>
              
              <a href="https://www.linkedin.com/in/lozanonahuel/" target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
                <div className={styles.socialIcon} style={{ backgroundColor: '#0077B5' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

const Footer = memo(FooterComponent);
Footer.displayName = 'Footer';

export default Footer; 