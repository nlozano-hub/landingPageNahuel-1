import React, { useState } from 'react';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';
import { CheckCircle, ArrowRight, Users, TrendingUp, Clock, ChevronLeft, ChevronRight, BarChart3, Target, Zap } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import YouTubePlayer from '@/components/YouTubePlayer';
import BackgroundVideo from '@/components/BackgroundVideo';
import styles from '@/styles/Indicadores.module.css';

/**
 * Carousel automático de YouTube (igual al de Entrenamientos)
 */
const YouTubeAutoCarousel: React.FC = () => {
  const [currentVideo, setCurrentVideo] = React.useState(0);

  const videos = [
    { id: '0NpdClGWaY8', title: 'Indicadores de Trading - Introducción' },
    { id: 'jl3lUCIluAs', title: 'Medias Móviles en TradingView' },
    { id: '_AMDVmj9_jw', title: 'Análisis Técnico Avanzado' },
    { id: 'sUktp76givU', title: 'Estrategias de Trading' }
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideo((prev) => (prev + 1) % videos.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [videos.length]);

  const goToPrevious = () => {
    setCurrentVideo((prev) => (prev - 1 + videos.length) % videos.length);
  };

  const goToNext = () => {
    setCurrentVideo((prev) => (prev + 1) % videos.length);
  };

  return (
    <div className={styles.youtubeAutoCarousel}>
      <button
        onClick={goToPrevious}
        className={styles.youtubeArrowLeft}
        aria-label="Video anterior"
      >
        <ChevronLeft size={24} />
      </button>

      <div className={styles.youtubeVideoFrame}>
        <iframe
          src={`https://www.youtube.com/embed/${videos[currentVideo].id}`}
          title={videos[currentVideo].title}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={styles.youtubeVideoPlayer}
        />
      </div>

      <button
        onClick={goToNext}
        className={styles.youtubeArrowRight}
        aria-label="Siguiente video"
      >
        <ChevronRight size={24} />
      </button>

      <div className={styles.youtubeIndicators}>
        {videos.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentVideo(index)}
            className={`${styles.youtubeIndicator} ${index === currentVideo ? styles.youtubeIndicatorActive : ''}`}
            aria-label={`Ver video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

interface IndicatorServiceProps {
  title: string;
  description: string;
  features: string[];
  href: string;
  backgroundColor: string;
  buttonTextColor: string;
  tag: string;
  videoId: string;
}

const IndicatorService: React.FC<IndicatorServiceProps> = ({
  title,
  description,
  features,
  href,
  backgroundColor,
  buttonTextColor,
  tag,
  videoId
}) => {
  const router = useRouter();

  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // Usar router.push como método principal
    router.push(href).catch(() => {
      // Fallback a window.location si router.push falla
      window.location.href = href;
    });
  };

  return (
    <motion.div
      className={styles.serviceCard}
      style={{ backgroundColor }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.3 }}
    >
      {/* Video Player con Overlay */}
      <div className={styles.videoPlayerContainer}>
        <YouTubePlayer
          videoId={videoId}
          title={`${title} - Introducción`}
          autoplay={false}
          muted={true}
          loop={false}
          className={styles.videoPlayer}
        />

        {/* Overlay con información */}
        <div className={styles.videoOverlay}>
          <div className={styles.videoInfo}>
            <h3 className={styles.videoTitle}>{title}</h3>
            <span className={styles.videoTag}>{tag}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.serviceContent}>
        <p className={styles.serviceDescription}>{description}</p>

        <ul className={styles.featureList}>
          {features.map((feature, index) => (
            <li key={index} className={styles.featureItem}>
              <span className={styles.checkmark}>✓</span>
              {feature}
            </li>
          ))}
        </ul>

        <div className={styles.trialOffer}>
          <span className={styles.checkmark}>✓</span>
          Acceso vitalicio
        </div>

        <div className={styles.buttonContainer}>
          <button
            className={styles.serviceButton}
            onClick={handleButtonClick}
            type="button"
            style={{ color: buttonTextColor }}
          >
            Quiero saber más &gt;
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const IndicadoresPage: React.FC = () => {
  const router = useRouter();
  const { data: session } = useSession();
  const [isProcessingPack, setIsProcessingPack] = useState(false);
  const [errorMessagePack, setErrorMessagePack] = useState('');

  const handleBuyPack = async () => {
    if (!session?.user?.email) {
      await signIn('google');
      return;
    }
    
    setIsProcessingPack(true);
    setErrorMessagePack('');
    
    try {
      // Usar el endpoint específico para indicadores
      const response = await fetch('/api/payments/mercadopago/create-indicator-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'PackIndicadores'
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setErrorMessagePack(data.error || 'Error al procesar el pago');
        setIsProcessingPack(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessagePack('Error al procesar el pago. Inténtalo nuevamente.');
      setIsProcessingPack(false);
    }
  };

  const indicatorServices = [
    {
      title: 'Medias Móviles Automáticas',
      description: 'Indicador avanzado para TradingView con medias móviles diarias/semanales automáticas, etiquetas y panel de contexto. El mismo que uso en Trader Call y Smart Money para tomar decisiones reales de trading.',
      features: [
        'Detección automática del marco temporal (diario/semanal) y configuración de WMA, SMA y EMA clave',
        'Etiquetas junto a cada media y distancias porcentuales para identificar soportes y resistencias dinámicos',
        'Panel de contexto con Beta vs. SPY, industria, país y métricas clave',
        'Método probado y usado en servicios de suscripción profesionales'
      ],
      href: '/mediasmovilesautomaticas',
      backgroundColor: '#7c3aed',
      buttonTextColor: '#a855f7', 
      tag: 'TradingView',
      videoId: '0NpdClGWaY8'
    },
    {
      title: 'RSI con Históricos',
      description: 'Indicador para TradingView. El mismo que utilizo en Trader Call y Smart Money para analizar momentum, extremos y cambios de contexto.',
      features: [
        'RSI avanzado y configurable desde la fuente de datos que prefieras',
        'Zonas de sobrecompra y sobreventa con niveles clásicos de 70 y 30',
        'Media móvil del RSI totalmente configurable (SMA, EMA, RMA/SMMA, WMA o VWMA)',
        'Históricos en tiempo real con máximo y mínimo histórico del RSI'
      ],
      href: '/rsiconhistoricos',
      backgroundColor: '#7c3aed',
      buttonTextColor: '#a855f7', 
      tag: 'TradingView',
      videoId: 'dQw4w9WgXcQ'
    },
    {
      title: 'Smart MACD',
      description: 'Indicador para TradingView. El mismo que utilizo en Trader Call y Smart Money para jerarquizar señales del MACD y evitar interpretaciones planas.',
      features: [
        'MACD optimizado con contexto manteniendo la estructura clásica',
        'Clasificación automática de señales en cuatro estados (Compra/Venta fuerte/débil)',
        'Nivel cero como eje de contexto para distinguir tendencias',
        'Etiquetas claras y legibles que se ajustan dinámicamente'
      ],
      href: '/smartmacd',
      backgroundColor: '#7c3aed',
      buttonTextColor: '#a855f7', 
      tag: 'TradingView',
      videoId: 'dQw4w9WgXcQ'
    },
    {
      title: 'Koncorde Pro',
      description: 'Indicador para TradingView. El mismo que utilizo en Trader Call y Smart Money para analizar flujo, acumulación y cambios de fase en el mercado.',
      features: [
        'Oscilador de flujo avanzado combinando volumen, precio y momentum',
        'Componentes Manos Grandes y Manos Chicas para detectar actividad informada',
        'Montaña que representa presión especulativa y dinero tardío',
        'Etiquetas automáticas de Traspaso de Manos para identificar acumulación'
      ],
      href: '/koncordepro',
      backgroundColor: '#7c3aed',
      buttonTextColor: '#a855f7', 
      tag: 'TradingView',
      videoId: 'dQw4w9WgXcQ'
    }
  ];

  return (
    <>
      <Head>
        <title>Indicadores de Trading - Nahuel Lozano</title>
        <meta name="description" content="Indicadores profesionales para TradingView y análisis técnico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Hero Section - Nuevo diseño con video */}
        <section className={styles.hero}>
          {/* Video de fondo */}
          <BackgroundVideo
            videoSrc="/logos/DiseñoWeb-LozanoNahuel-Alertas-TraderCall.mp4"
            className={styles.heroVideoBackground}
            autoPlay={true}
            muted={true}
            loop={true}
            showControls={false}
          />

          <div className={styles.container}>
            <motion.div
              className={styles.heroContent}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  Indicadores Profesionales
                </h1>
                <p className={styles.heroDescription}>
                  Herramientas avanzadas para TradingView que uso en mis servicios profesionales.
                  Accedé a los mismos indicadores que potencian Trader Call y Smart Money.
                </p>
                <button
                  className={styles.heroButton}
                  onClick={() => {
                    const servicesSection = document.querySelector(`.${styles.services}`);
                    if (servicesSection) {
                      servicesSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                      });
                    }
                  }}
                >
                  Empezá Ahora &gt;
                </button>
              </div>

              <motion.div 
                className={styles.heroVideo}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className={styles.videoContainer}>
                  <YouTubePlayer
                    videoId="0NpdClGWaY8"
                    title="Indicadores de Trading - Introducción"
                    autoplay={false}
                    muted={true}
                    loop={false}
                    controls={true}
                    fillContainer={true}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Services Section */}
        <section className={styles.services}>
          <div className={styles.container}>
            <motion.h2
              className={styles.sectionTitle}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Nuestros Indicadores
            </motion.h2>

            <div className={styles.servicesGrid}>
              {indicatorServices.map((service, index) => (
                <motion.div
                  key={service.title}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  <IndicatorService {...service} />
                </motion.div>
              ))}
            </div>

            {/* Pack de Indicadores - CTA destacado */}
            <motion.div
              className={styles.packCta}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.8 }}
            >
              <div className={styles.packCtaContent}>
                <h3 className={styles.packCtaTitle}>💎 Pack Completo de Indicadores</h3>
                <p className={styles.packCtaDescription}>
                  Ahorrá comprando todos los indicadores juntos. Acceso vitalicio a los 4 indicadores profesionales.
                </p>
                <p className={styles.packCtaPrice}>
                  <span className={styles.packCtaPriceOld}>$100.000</span>
                  <span className={styles.packCtaPriceNew}>$70.000</span>
                  <span className={styles.packCtaPriceLabel}> — Ahorrás $30.000</span>
                </p>
                {errorMessagePack && (
                  <p style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>
                    {errorMessagePack}
                  </p>
                )}
                <button
                  onClick={handleBuyPack}
                  className={styles.packCtaButton}
                  disabled={isProcessingPack}
                  style={{ 
                    cursor: isProcessingPack ? 'not-allowed' : 'pointer',
                    opacity: isProcessingPack ? 0.7 : 1
                  }}
                >
                  {isProcessingPack ? 'Procesando...' : 'Comprar Pack Completo >'}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats Section */}
        <section className={styles.stats}>
          <div className={styles.statsGrid}>
            <motion.div
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
            >
              <h3 className={styles.statNumber}>+1000</h3>
              <p className={styles.statLabel}>Usuarios</p>
            </motion.div>

            <motion.div
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <h3 className={styles.statNumber}>4</h3>
              <p className={styles.statLabel}>Indicadores Premium</p>
            </motion.div>

            <motion.div
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <h3 className={styles.statNumber}>100%</h3>
              <p className={styles.statLabel}>Satisfacción</p>
            </motion.div>

            <motion.div
              className={styles.statItem}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <h3 className={styles.statNumber}>24h</h3>
              <p className={styles.statLabel}>Activación</p>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.cta}>
          <div className={styles.ctaContent}>
            <motion.h2
              className={styles.ctaTitle}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              ¿Listo para llevar tus inversiones al siguiente nivel?
            </motion.h2>
            <motion.p
              className={styles.ctaDescription}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              Accedé a herramientas profesionales usadas por traders experimentados
            </motion.p>
            <motion.div
              className={styles.ctaButtons}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <Link href="/mediasmovilesautomaticas" className={styles.ctaButton}>
                Medias Móviles Automáticas &gt;
              </Link>
              <Link href="/rsiconhistoricos" className={styles.ctaButton}>
                RSI con Históricos &gt;
              </Link>
              <Link href="/smartmacd" className={styles.ctaButton}>
                Smart MACD &gt;
              </Link>
              <Link href="/koncordepro" className={styles.ctaButton}>
                Koncorde Pro &gt;
              </Link>
            </motion.div>
          </div>
        </section>

        {/* YouTube Community Section */}
        <section className={styles.youtubeSection}>
          <div className="container">
            <motion.div
              className={styles.youtubeContent}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <div className={styles.youtubeText}>
                <h2 className={styles.youtubeTitle}>
                  ¡Sumate a nuestra comunidad<br />
                  en YouTube!
                </h2>
                <p className={styles.youtubeSubtitle}>
                  No te pierdas nuestros últimos videos
                </p>
              </div>

              <div className={styles.youtubeVideoContainer}>
                <YouTubeAutoCarousel />
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default IndicadoresPage;
