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
import styles from '@/styles/KoncordePro.module.css';

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

export default function KoncordeProPage() {
  // Landing page para el indicador Koncorde Pro
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
          product: 'KoncordePro'
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
        <title>Koncorde Pro | Indicador TradingView</title>
        <meta
          name="description"
          content="Indicador avanzado para TradingView que analiza flujo, acumulación y cambios de fase en el mercado. El mismo que utilizo en Trader Call y Smart Money."
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
                  Koncorde Pro
                </motion.h1>
                <motion.p 
                  className={styles.subtitle}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Indicador para TradingView. El mismo que utilizo en Trader Call y Smart Money para analizar flujo,
                  acumulación y cambios de fase en el mercado.
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
                    videoId="dQw4w9WgXcQ"
                    title="Koncorde Pro - Video Explicativo"
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
                <h3>Oscilador de flujo avanzado</h3>
                <p>
                  Koncorde Pro combina información de volumen, precio y momentum para
                  interpretar quién está operando realmente el activo: dinero informado o dinero
                  tardío.
                </p>
                <p style={{ marginTop: '12px', fontStyle: 'italic' }}>No mide tendencia ni genera entradas. Su función es contextual.</p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h3>Manos Grandes</h3>
                <p>
                  Componente asociado a actividad informada, derivada de la lógica del NVI
                  (Negative Volume Index).
                </p>
                <p style={{ marginTop: '12px' }}>
                  Busca detectar movimientos relevantes que ocurren con menor volumen,
                  típicos de acumulación o distribución profesional.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <h3>Montaña</h3>
                <p>
                  Representa la presión especulativa y el comportamiento del dinero tardío.
                  Se construye a partir del promedio de varios osciladores:
                </p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                  <li>RSI</li>
                  <li>MFI</li>
                  <li>Oscilador tipo Bollinger</li>
                  <li>Estocástico</li>
                </ul>
                <p style={{ marginTop: '12px' }}>Refleja entusiasmo, euforia o pánico del mercado minorista.</p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <h3>Manos Chicas</h3>
                <p>
                  Señal compuesta que surge de la montaña más la oscilación del PVI (Positive
                  Volume Index).
                </p>
                <p style={{ marginTop: '12px' }}>
                  Suele amplificar los cambios de fase y mostrar cuándo la participación
                  especulativa se vuelve dominante.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <h3>Media de confirmación</h3>
                <p>
                  Línea de suavizado aplicada sobre la montaña para filtrar ruido.
                  Cambia de color según su relación con la montaña, ayudando a distinguir
                  movimientos consistentes de simples fluctuaciones.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <h3>Traspaso de Manos</h3>
                <p>
                  Etiqueta automática que aparece cuando:
                </p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                  <li>Manos chicas &lt; 0</li>
                  <li>Manos grandes &gt; 0</li>
                </ul>
                <p style={{ marginTop: '12px' }}>
                  Este evento se interpreta como un posible traspaso de papeles desde mano
                  débil hacia mano fuerte, típico de procesos de acumulación.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.7 }}
              >
                <h3>Línea 0 de referencia</h3>
                <p>
                  Incluye una línea cero que separa zonas positivas y negativas, facilitando la
                  lectura estructural del flujo.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.8 }}
              >
                <h3>Interpretación general</h3>
                <p>
                  Koncorde Pro está diseñado para responder preguntas como:
                </p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                  <li>¿Quién está participando en el movimiento?</li>
                  <li>¿Hay acumulación o distribución detrás del precio?</li>
                  <li>¿El impulso viene de mano fuerte o de presión especulativa?</li>
                </ul>
                <p style={{ marginTop: '12px', fontStyle: 'italic' }}>No indica compras ni ventas. Aporta contexto de fondo.</p>
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
                  {pricingLoading ? 'Cargando...' : formatPrice(pricing?.indicadores?.koncordePro?.price || 30000)}
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
                <p>El acceso es vitalicio. Pagás una sola vez y el indicador queda habilitado de forma permanente en tu usuario de TradingView, incluyendo futuras mejoras.</p>
              </details>
              <details>
                <summary>¿Necesito TradingView Premium?</summary>
                <p>No. Funciona con la cuenta gratuita de TradingView. Solo necesitás un usuario activo.</p>
              </details>
              <details>
                <summary>¿Dónde encuentro el indicador?</summary>
                <p>TradingView → Productos → Supergráficos → Indicadores → Requiere invitación. Ahí encontrarás Koncorde Pro y podrás marcarlo como favorito.</p>
              </details>
              <details>
                <summary>¿Puedo usarlo en cualquier activo?</summary>
                <p>Sí. Funciona en acciones, índices, criptomonedas, ETFs, futuros o cualquier instrumento disponible en TradingView.</p>
              </details>
              <details>
                <summary>¿Es un sistema de trading?</summary>
                <p>No. Es una herramienta de análisis de flujo y contexto. Debe combinarse con tendencia, soportes y resistencias.</p>
              </details>
              <details>
                <summary>¿Puedo compartirlo con otras personas?</summary>
                <p>No. El acceso es personal e individual, vinculado a tu usuario de TradingView.</p>
              </details>
              <details>
                <summary>¿En cuánto tiempo recibiré el acceso?</summary>
                <p>Normalmente en menos de 24 horas desde que enviás tu usuario. En muchos casos, dentro de 1–2 horas en días hábiles.</p>
              </details>
              <details>
                <summary>¿Recibiré actualizaciones y mejoras?</summary>
                <p>Sí. Todas las mejoras futuras estarán disponibles sin costo adicional.</p>
              </details>
              <details>
                <summary>¿Seguís con dudas?</summary>
                <p>Escribime a soporte@lozanonahuel.com y te ayudo a resolver cualquier consulta.</p>
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
