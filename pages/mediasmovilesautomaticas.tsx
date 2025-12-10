import { useState, useEffect } from 'react';
import Head from 'next/head';
import { signIn, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import YouTubePlayer from '@/components/YouTubePlayer';
import BackgroundVideo from '@/components/BackgroundVideo';
import { usePricing } from '@/hooks/usePricing';
import styles from '@/styles/MediasMovilesAutomaticas.module.css';

/**
 * Componente de carousel automático para videos de YouTube
 */
const YouTubeAutoCarousel: React.FC = () => {
  const [currentVideo, setCurrentVideo] = useState(0);
  
  const videos = [
    {
      id: '0NpdClGWaY8',
      title: 'Video 1'
    },
    {
      id: 'jl3lUCIluAs',
      title: 'Video 2'
    },
    {
      id: '_AMDVmj9_jw',
      title: 'Video 3'
    },
    {
      id: 'sUktp76givU',
      title: 'Video 4'
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentVideo((prev) => (prev + 1) % videos.length);
    }, 5000); // Cambia cada 5 segundos

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
            className={`${styles.youtubeIndicator} ${
              index === currentVideo ? styles.youtubeIndicatorActive : ''
            }`}
            aria-label={`Ver video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default function MediasMovilesAutomaticasPage() {
  // Landing page para el indicador de Medias Móviles Automáticas
  const { data: session } = useSession();
  const { pricing, loading: pricingLoading, formatPrice } = usePricing();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleBuy = async () => {
    if (!session?.user?.email) {
      await signIn('google');
      return;
    }
    
    setIsProcessing(true);
    setErrorMessage('');
    
    try {
      // Usar el endpoint específico para indicadores
      const response = await fetch('/api/payments/mercadopago/create-indicator-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: 'MediasMovilesAutomaticas'
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setErrorMessage(data.error || 'Error al procesar el pago');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Error:', error);
      setErrorMessage('Error al procesar el pago. Inténtalo nuevamente.');
      setIsProcessing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Medias móviles automáticas | Indicador TradingView</title>
        <meta
          name="description"
          content="Indicador avanzado para TradingView con medias móviles diarias/semanales automáticas, etiquetas y panel de contexto."
        />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Hero */}
        <section className={styles.hero}>
          {/* Video Background */}
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className={styles.heroText}>
                <motion.h1 
                  className={styles.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  Medias móviles automáticas
                </motion.h1>
                <motion.p 
                  className={styles.subtitle}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Indicador para TradingView. El mismo que uso en Trader Call y Smart Money para
                  tomar decisiones reales de trading.
                </motion.p>
                <motion.div 
                  className={styles.heroCtas}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <button className={styles.primaryButton} onClick={handleBuy} disabled={isProcessing}>
                    {isProcessing ? 'Procesando…' : 'Comprar ahora'}
                  </button>
                  <a href="#caracteristicas" className={styles.secondaryLink}>
                    Ver características
                  </a>
                </motion.div>
                {errorMessage && <p className={styles.error}>{errorMessage}</p>}
                <motion.p 
                  className={styles.note}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  Pago único • Acceso vitalicio en TradingView
                </motion.p>
              </div>
              
              {/* Video Player en el Hero */}
              <motion.div 
                className={styles.heroVideo}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className={styles.videoContainer}>
                  <YouTubePlayer
                    videoId="2fd95k3BM9c"
                    title="Medias Móviles Automáticas - Video"
                    autoplay={true}
                    muted={true}
                    loop={false}
                    controls={true}
                    className={styles.videoPlayer}
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Características */}
        <section id="caracteristicas" className={styles.features}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              ¿Qué incluye?
            </motion.h2>
            <div className={styles.featuresGrid}>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.1 }}
              >
                <h3>Medias móviles automáticas</h3>
                <p>
                  Detección del marco temporal (diario/semanal) y configuración automática de WMA, SMA y
                  EMA clave.
                </p>
                <ul>
                  <li>Diario: WMA 21, SMA 30, EMA 150, SMA 200</li>
                  <li>Semanal: WMA 10, WMA 30, WMA 50, SMA 200</li>
                </ul>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h3>Etiquetas y distancias</h3>
                <p>
                  Etiquetas junto a cada media y distancias porcentuales para identificar soportes y
                  resistencias dinámicos.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <h3>Panel de contexto</h3>
                <p>Beta vs. SPY, industria, país y métricas clave en un panel compacto.</p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <h3>Método probado</h3>
                <p>
                  Es la misma herramienta que uso en mis servicios de suscripción para análisis y señales.
                </p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Modo de acceso */}
        <section className={styles.steps}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Así obtendrás tu acceso en TradingView
            </motion.h2>
            <motion.ol 
              className={styles.stepsList}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                Realizás el pago con MercadoPago
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                Completás el formulario con tu usuario exacto de TradingView
              </motion.li>
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                En menos de 24 h habilito tu acceso
              </motion.li>
            </motion.ol>
          </div>
        </section>

        {/* Precio */}
        <section className={styles.pricing}>
          <div className={styles.container}>
            <motion.div 
              className={styles.pricingCard}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <div className={styles.priceHeader}>
                <h3>Accede hoy mismo</h3>
                <p className={styles.priceTitle}>Pago único de</p>
                <p className={styles.priceAmount}>
                  {pricingLoading ? 'Cargando...' : formatPrice(pricing?.indicadores?.mediasMovilesAutomaticas?.price || 30000)}
                </p>
              </div>
              <button className={styles.primaryButton} onClick={handleBuy} disabled={isProcessing}>
                {isProcessing ? 'Procesando…' : 'Comprar ahora'}
              </button>
              <p className={styles.priceNote}>Acceso vitalicio. Sin suscripciones.</p>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className={styles.faq}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              Preguntas frecuentes
            </motion.h2>
            <motion.div 
              className={styles.faqList}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <details>
                <summary>¿Por cuánto tiempo tendré acceso?</summary>
                <p>El acceso es vitalicio: una vez que lo compras y se habilita en tu usuario de TradingView, podrás usarlo sin límite de tiempo. No es una suscripción mensual ni anual; es un pago único que te garantiza acceso permanente, incluso si actualizo o mejoro el indicador en el futuro.</p>
              </details>
              <details>
                <summary>¿Necesito TradingView Premium?</summary>
                <p>No. El indicador funciona perfectamente con la cuenta gratuita de TradingView. La única condición es que tengas un usuario en la plataforma y me lo envíes tras tu compra para habilitarte el acceso. Tené en cuenta que si ya alcanzaste el máximo de indicadores dentro del gráfico para tu plan, debés quitar uno de ellos para colocar este.</p>
              </details>
              <details>
                <summary>¿Donde encuentro el indicador?</summary>
                <p>Debes Iniciar sesión en TradingView, luego dirigirte a la sección Productos y abrir los Supergráficos. Una vez en los gráficos, ir al apartado indicadores y luego a Requiere invitación. Allí encontrarás todos los indicadores que ofrecemos. Podés hacer click en la “estrella” para agregarlos a indicadores favoritos.</p>
              </details>
              <details>
                <summary>¿Puedo usarlo en cualquier activo?</summary>
                <p>Sí. Puedes aplicarlo en acciones, índices, criptomonedas, ETFs, futuros o cualquier instrumento disponible en TradingView. El indicador ajusta automáticamente las medias según estés en gráfico diario o semanal.</p>
              </details>
              <details>
                <summary>¿Puedo instalarlo en varios dispositivos?</summary>
                <p>Sí. Mientras uses la misma cuenta de TradingView, puedes acceder al indicador desde tu computadora, tablet o celular sin problema.</p>
              </details>
              <details>
                <summary>¿Puedo compartirlo con otras personas?</summary>
                <p>No. Es de uso personal. El acceso se otorga de forma individual y está vinculado a tu usuario de TradingView. Compartirlo o intentar duplicarlo sin permiso viola los términos de uso.</p>
              </details>
              <details>
                <summary>¿En cuánto tiempo recibiré el acceso después de pagar?</summary>
                <p>Normalmente en menos de 24 horas desde que envías tu usuario de TradingView. En muchos casos, lo habilitamos en 1–2 horas durante días hábiles.</p>
              </details>
              <details>
                <summary>¿Recibiré actualizaciones y mejoras del indicador?</summary>
                <p>Sí. En caso de mejoras o nuevas funciones, tendrás acceso a la versión actualizada sin costo adicional, mientras mantengas activo tu acceso como comprador original.</p>
              </details>
              <details>
                <summary>¿Puedo usarlo en marcos temporales distintos a diario y semanal?</summary>
                <p>semanal?
                Puedes aplicarlo en cualquier marco temporal de TradingView, pero el indicador está optimizado para mostrar las medias móviles correspondientes al diario o semanal según el gráfico en el que trabajes.</p>
              </details>
              <details>
                <summary>¿Seguís con dudas?</summary>
                <p>Escribime un correo electrónico a la siguiente casilla para resolver las dudas que te puedan surgir: lozanonahuel@gmail.com</p>
              </details>
            </motion.div>
          </div>
        </section>

        {/* Sección YouTube Community */}
        <section className={styles.youtubeSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.youtubeContent}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className={styles.youtubeText}>
                <h2 className={styles.youtubeTitle}>
                  ¡Sumate a nuestra comunidad en YouTube!
                </h2>
                <p className={styles.youtubeDescription}>
                  No te pierdas nuestros últimos videos
                </p>
              </div>
              
              <div className={styles.youtubeCarousel}>
                <YouTubeAutoCarousel />
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}


