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
import styles from '@/styles/SmartMACD.module.css';

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

export default function SmartMACDPage() {
  // Landing page para el indicador Smart MACD
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
          product: 'SmartMACD'
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
        <title>Smart MACD | Indicador TradingView</title>
        <meta
          name="description"
          content="Indicador avanzado para TradingView que jerarquiza señales del MACD y evita interpretaciones planas. El mismo que utilizo en Trader Call y Smart Money."
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
                  Smart MACD
                </motion.h1>
                <motion.p 
                  className={styles.subtitle}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Indicador para TradingView. El mismo que utilizo en Trader Call y Smart Money para jerarquizar señales del
                  MACD y evitar interpretaciones planas.
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
                    title="Smart MACD - Video Explicativo"
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
                <h3>MACD optimizado con contexto</h3>
                <p>
                  SMART MACD mantiene intacta la estructura clásica del MACD (línea MACD,
                  línea de señal e histograma), pero agrega una capa clave de interpretación: no
                  todos los cruces son iguales.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                <h3>Clasificación automática de señales</h3>
                <p>
                  Cada cruce entre la línea MACD y la señal es clasificado automáticamente en
                  uno de cuatro estados posibles, según su dirección y su ubicación respecto al
                  nivel cero.
                </p>
                <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                  <li>Compra fuerte</li>
                  <li>Compra débil</li>
                  <li>Venta fuerte</li>
                  <li>Venta débil</li>
                </ul>
                <p style={{ marginTop: '12px', fontStyle: 'italic' }}>No existen señales neutras ni ambiguas.</p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.3 }}
              >
                <h3>Nivel cero como eje de contexto</h3>
                <p>
                  El indicador utiliza el nivel cero para distinguir si el cruce ocurre a favor o en
                  contra de la tendencia dominante, ayudando a interpretar si se trata de un
                  posible inicio de impulso o una continuación.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <h3>Etiquetas claras y legibles</h3>
                <p>
                  Cada cruce relevante se marca con una etiqueta automática, cuya separación
                  se ajusta dinámicamente según la volatilidad del MACD, mejorando la lectura
                  visual y evitando superposiciones.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.5 }}
              >
                <h3>Herramienta analítica, no un sistema</h3>
                <p>
                  SMART MACD no genera órdenes, no define entradas ni salidas y no reemplaza
                  el análisis de tendencia. Su función es aportar contexto y jerarquía a las
                  señales.
                </p>
              </motion.div>
              <motion.div 
                className={styles.featureCard}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.6 }}
              >
                <h3>Interpretación general</h3>
                <ul style={{ marginTop: '12px', paddingLeft: '20px' }}>
                  <li><strong>Compra fuerte:</strong> Cruce alcista por debajo de cero. Posible inicio de impulso desde zona negativa.</li>
                  <li><strong>Compra débil:</strong> Cruce alcista por encima de cero. Continuación del movimiento, con menor margen.</li>
                  <li><strong>Venta fuerte:</strong> Cruce bajista por encima de cero. Posible giro o corrección relevante.</li>
                  <li><strong>Venta débil:</strong> Cruce bajista por debajo de cero. Continuación bajista en desarrollo.</li>
                </ul>
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
                  {pricingLoading ? 'Cargando...' : formatPrice(pricing?.indicadores?.smartMACD?.price || 20000)}
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
                <p>No. Funciona con la cuenta gratuita de TradingView. Solo necesitás un usuario activo para que pueda habilitarte el acceso.</p>
              </details>
              <details>
                <summary>¿Dónde encuentro el indicador?</summary>
                <p>Iniciá sesión en TradingView → Productos → Supergráficos → Indicadores → Requiere invitación. Ahí encontrarás SMART MACD y podrás marcarlo como favorito.</p>
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
                <p>No. El acceso es personal e individual, vinculado a tu usuario de TradingView.</p>
              </details>
              <details>
                <summary>¿En cuánto tiempo recibiré el acceso?</summary>
                <p>Normalmente en menos de 24 horas desde que enviás tu usuario. En muchos casos, dentro de 1–2 horas en días hábiles.</p>
              </details>
              <details>
                <summary>¿Recibiré actualizaciones y mejoras?</summary>
                <p>Sí. Todas las mejoras futuras estarán disponibles sin costo adicional para los compradores.</p>
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
