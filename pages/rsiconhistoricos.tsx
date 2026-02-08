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
import styles from '@/styles/RSIConHistoricos.module.css';

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

export default function RSIConHistoricosPage() {
  // Landing page para el indicador de RSI con Históricos
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
          product: 'RSIConHistoricos'
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
        <title>RSI con Históricos | Indicador TradingView</title>
        <meta
          name="description"
          content="Indicador avanzado para TradingView con RSI configurable, zonas de sobrecompra/sobreventa, media móvil del RSI e históricos en tiempo real."
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
                  RSI con Históricos
                </motion.h1>
                <motion.p 
                  className={styles.subtitle}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Indicador para TradingView. El mismo que utilizo en Trader Call y Smart Money para analizar momentum,
                  extremos y cambios de contexto.
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
              
              {/* Video Player en el Hero - Oculto hasta tener el video */}
              {/* <motion.div 
                className={styles.heroVideo}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                <div className={styles.videoContainer}>
                  <YouTubePlayer
                    videoId="dQw4w9WgXcQ"
                    title="RSI con Históricos - Video Explicativo"
                    autoplay={true}
                    muted={true}
                    loop={false}
                    controls={true}
                    className={styles.videoPlayer}
                  />
                </div>
              </motion.div> */}
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
                <h3>RSI avanzado y configurable</h3>
                <p>
                  RSI ajustable desde la fuente de datos que prefieras (cierre, apertura, máximo,
                  mínimo, etc.), permitiendo adaptar el indicador a distintas estrategias y estilos
                  operativos.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h3>Zonas de sobrecompra y sobreventa</h3>
                <p>
                  Niveles clásicos de 70 y 30 claramente visibles, con fondo suavizado para
                  identificar rápidamente zonas de tensión del precio.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <h3>Media móvil del RSI</h3>
                <p>
                  Incorpora una media móvil totalmente configurable sobre el RSI:
                  SMA, EMA, RMA/SMMA, WMA o VWMA, para mejorar la lectura de tendencia y
                  momentum.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <h3>Históricos en tiempo real</h3>
                <p>
                  Muestra automáticamente el máximo y mínimo histórico del RSI alcanzado en
                  todo el gráfico, con etiquetas visibles que aportan contexto real al valor actual.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <h3>Visual y funcional</h3>
                <p>
                  Todos los valores clave se anclan sobre la última vela, con colores intuitivos
                  que facilitan la interpretación sin sobrecargar el gráfico.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <h3>Método probado</h3>
                <p>
                  Es la misma herramienta que utilizo en mis servicios de suscripción para
                  evaluar cambios de momentum y zonas extremas con contexto histórico.
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
                Realizás el pago con Mercado Pago
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
                <h3>Accedé hoy mismo</h3>
                <p className={styles.priceTitle}>Pago único de</p>
                <p className={styles.priceAmount}>
                  {pricingLoading ? 'Cargando...' : formatPrice(pricing?.indicadores?.rsiConHistoricos?.price || 20000)}
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
                <p>El acceso es vitalicio. Pagás una sola vez y el indicador queda habilitado de forma permanente en tu usuario de TradingView, incluyendo futuras mejoras o actualizaciones.</p>
              </details>
              <details>
                <summary>¿Necesito TradingView Premium?</summary>
                <p>No. Funciona perfectamente con la cuenta gratuita de TradingView. Solo necesitás un usuario activo para que pueda habilitarte el acceso.</p>
              </details>
              <details>
                <summary>¿Dónde encuentro el indicador?</summary>
                <p>Iniciá sesión en TradingView → Productos → Supergráficos → Indicadores → Requiere invitación. Ahí vas a encontrar el RSI con Históricos. Podés marcarlo con la estrella para dejarlo en favoritos.</p>
              </details>
              <details>
                <summary>¿Puedo usarlo en cualquier activo?</summary>
                <p>Sí. Funciona en acciones, índices, criptomonedas, ETFs, futuros o cualquier instrumento disponible en TradingView.</p>
              </details>
              <details>
                <summary>¿Puedo instalarlo en varios dispositivos?</summary>
                <p>Sí. Mientras uses la misma cuenta de TradingView, podés acceder desde computadora, tablet o celular.</p>
              </details>
              <details>
                <summary>¿Puedo compartirlo con otras personas?</summary>
                <p>No. El acceso es personal e individual, vinculado a tu usuario de TradingView. Compartirlo o duplicarlo viola los términos de uso.</p>
              </details>
              <details>
                <summary>¿En cuánto tiempo recibiré el acceso?</summary>
                <p>Normalmente en menos de 24 horas desde que enviás tu usuario de TradingView. En muchos casos, dentro de 1–2 horas en días hábiles.</p>
              </details>
              <details>
                <summary>¿Recibiré actualizaciones y mejoras?</summary>
                <p>Sí. Todas las mejoras futuras estarán disponibles sin costo adicional para quienes tengan acceso habilitado.</p>
              </details>
              <details>
                <summary>¿Puedo usarlo en cualquier marco temporal?</summary>
                <p>Sí. El indicador funciona en cualquier marco temporal de TradingView y adapta la lectura del RSI al contexto del gráfico que estés analizando.</p>
              </details>
              <details>
                <summary>¿Seguís con dudas?</summary>
                <p>Escribime a soporte@lozanonahuel.com y te ayudo a resolver cualquier consulta.</p>
              </details>
            </motion.div>
          </div>
        </section>

        {/* Sección YouTube Community - Oculto hasta tener los videos */}
        {/* <section className={styles.youtubeSection}>
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
        </section> */}
      </main>

      <Footer />
    </>
  );
}
