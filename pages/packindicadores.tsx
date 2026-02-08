import { useState, useEffect } from 'react';
import Head from 'next/head';
import { signIn, useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import YouTubePlayer from '@/components/YouTubePlayer';
import BackgroundVideo from '@/components/BackgroundVideo';
import { usePricing } from '@/hooks/usePricing';
import styles from '@/styles/PackIndicadores.module.css';

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

export default function PackIndicadoresPage() {
  // Landing page para el Pack de Indicadores
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
          product: 'PackIndicadores'
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

  // Calcular precio individual total
  const precioIndividual = 
    (pricing?.indicadores?.mediasMovilesAutomaticas?.price || 30000) +
    (pricing?.indicadores?.rsiConHistoricos?.price || 20000) +
    (pricing?.indicadores?.smartMACD?.price || 20000) +
    (pricing?.indicadores?.koncordePro?.price || 30000);
  
  const precioPack = pricing?.indicadores?.packIndicadores?.price || 70000;
  const ahorro = precioIndividual - precioPack;

  const indicators = [
    {
      name: 'Medias Móviles Automáticas',
      href: '/mediasmovilesautomaticas',
      description: 'Indicador avanzado con medias móviles diarias/semanales automáticas, etiquetas y panel de contexto.',
      price: pricing?.indicadores?.mediasMovilesAutomaticas?.price || 30000
    },
    {
      name: 'RSI con Históricos',
      href: '/rsiconhistoricos',
      description: 'RSI avanzado y configurable con zonas de sobrecompra/sobreventa, media móvil del RSI e históricos en tiempo real.',
      price: pricing?.indicadores?.rsiConHistoricos?.price || 20000
    },
    {
      name: 'Smart MACD',
      href: '/smartmacd',
      description: 'MACD optimizado que jerarquiza señales y evita interpretaciones planas con clasificación automática.',
      price: pricing?.indicadores?.smartMACD?.price || 20000
    },
    {
      name: 'Koncorde Pro',
      href: '/koncordepro',
      description: 'Oscilador de flujo avanzado que analiza acumulación, distribución y cambios de fase en el mercado.',
      price: pricing?.indicadores?.koncordePro?.price || 30000
    }
  ];

  return (
    <>
      <Head>
        <title>Pack de Indicadores | TradingView - Nahuel Lozano</title>
        <meta
          name="description"
          content="Pack completo con todos los indicadores profesionales para TradingView. Ahorrá comprando el pack completo con acceso vitalicio a todos los indicadores."
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
                  Pack de Indicadores
                </motion.h1>
                <motion.p 
                  className={styles.subtitle}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  Accedé a todos los indicadores profesionales que uso en Trader Call y Smart Money.
                  El pack completo con acceso vitalicio a los 4 indicadores esenciales para tu análisis técnico.
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
                  <a href="#contenido" className={styles.secondaryLink}>
                    Ver qué incluye
                  </a>
                </motion.div>
                {errorMessage && <p className={styles.error}>{errorMessage}</p>}
                <motion.p 
                  className={styles.note}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  Pago único • Acceso vitalicio a todos los indicadores
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
                    title="Pack de Indicadores - Video Explicativo"
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

        {/* Contenido del Pack */}
        <section id="contenido" className={styles.features}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              ¿Qué incluye el Pack?
            </motion.h2>
            <motion.p 
              className={styles.sectionDescription}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              El pack completo incluye acceso vitalicio a los 4 indicadores profesionales que utilizo en mis servicios de suscripción.
              Todos los indicadores funcionan en TradingView y están optimizados para análisis técnico avanzado.
            </motion.p>
            
            <div className={styles.indicatorsGrid}>
              {indicators.map((indicator, index) => (
                <motion.div 
                  key={indicator.name}
                  className={styles.indicatorCard}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                >
                  <div className={styles.indicatorHeader}>
                    <h3 className={styles.indicatorName}>{indicator.name}</h3>
                    <span className={styles.indicatorPrice}>
                      {formatPrice(indicator.price)}
                    </span>
                  </div>
                  <p className={styles.indicatorDescription}>{indicator.description}</p>
                  <Link href={indicator.href} className={styles.indicatorLink}>
                    Ver detalles <ArrowRight size={16} />
                  </Link>
                </motion.div>
              ))}
            </div>

            <motion.div 
              className={styles.benefitsSection}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <h3 className={styles.benefitsTitle}>Beneficios del Pack</h3>
              <div className={styles.benefitsGrid}>
                <div className={styles.benefitCard}>
                  <CheckCircle className={styles.benefitIcon} />
                  <h4>Ahorro significativo</h4>
                  <p>Comprando el pack ahorrás {formatPrice(ahorro)} comparado con comprar cada indicador por separado.</p>
                </div>
                <div className={styles.benefitCard}>
                  <CheckCircle className={styles.benefitIcon} />
                  <h4>Acceso completo</h4>
                  <p>Tenés acceso vitalicio a los 4 indicadores profesionales que uso en Trader Call y Smart Money.</p>
                </div>
                <div className={styles.benefitCard}>
                  <CheckCircle className={styles.benefitIcon} />
                  <h4>Análisis integral</h4>
                  <p>Combiná todos los indicadores para un análisis técnico completo y profesional.</p>
                </div>
                <div className={styles.benefitCard}>
                  <CheckCircle className={styles.benefitIcon} />
                  <h4>Actualizaciones incluidas</h4>
                  <p>Todas las mejoras y actualizaciones futuras están incluidas sin costo adicional.</p>
                </div>
              </div>
            </motion.div>
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
                En menos de 24 h habilito tu acceso a todos los indicadores del pack
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
                <h3>Pack Completo</h3>
                <div className={styles.priceComparison}>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>Precio individual:</span>
                    <span className={styles.priceOld}>{formatPrice(precioIndividual)}</span>
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>Precio del pack:</span>
                    <span className={styles.priceAmount}>
                      {pricingLoading ? 'Cargando...' : formatPrice(precioPack)}
                    </span>
                  </div>
                  <div className={styles.priceRow}>
                    <span className={styles.priceLabel}>Ahorrás:</span>
                    <span className={styles.priceSavings}>{formatPrice(ahorro)}</span>
                  </div>
                </div>
              </div>
              <button className={styles.primaryButton} onClick={handleBuy} disabled={isProcessing}>
                {isProcessing ? 'Procesando…' : 'Comprar Pack Completo'}
              </button>
              <p className={styles.priceNote}>Acceso vitalicio a los 4 indicadores. Sin suscripciones.</p>
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
                <summary>¿Qué indicadores incluye el pack?</summary>
                <p>El pack incluye acceso vitalicio a los 4 indicadores: Medias Móviles Automáticas, RSI con Históricos, Smart MACD y Koncorde Pro. Todos funcionan en TradingView y están optimizados para análisis técnico profesional.</p>
              </details>
              <details>
                <summary>¿Por cuánto tiempo tendré acceso?</summary>
                <p>El acceso es vitalicio. Pagás una sola vez y todos los indicadores quedan habilitados de forma permanente en tu usuario de TradingView, incluyendo futuras mejoras y actualizaciones.</p>
              </details>
              <details>
                <summary>¿Necesito TradingView Premium?</summary>
                <p>No. Todos los indicadores funcionan perfectamente con la cuenta gratuita de TradingView. Solo necesitás un usuario activo para que pueda habilitarte el acceso.</p>
              </details>
              <details>
                <summary>¿Dónde encuentro los indicadores?</summary>
                <p>Iniciá sesión en TradingView → Productos → Supergráficos → Indicadores → Requiere invitación. Ahí encontrarás todos los indicadores del pack y podrás marcarlos como favoritos.</p>
              </details>
              <details>
                <summary>¿Puedo comprar indicadores individuales después?</summary>
                <p>Sí, podés comprar cada indicador por separado si preferís. Sin embargo, el pack te ofrece un ahorro significativo comparado con comprar cada uno individualmente.</p>
              </details>
              <details>
                <summary>¿Puedo usarlos en cualquier activo?</summary>
                <p>Sí. Todos los indicadores funcionan en acciones, índices, criptomonedas, ETFs, futuros o cualquier instrumento disponible en TradingView.</p>
              </details>
              <details>
                <summary>¿Puedo instalarlos en varios dispositivos?</summary>
                <p>Sí. Mientras uses la misma cuenta de TradingView, podés acceder desde computadora, tablet o celular.</p>
              </details>
              <details>
                <summary>¿Puedo compartirlos con otras personas?</summary>
                <p>No. El acceso es personal e individual, vinculado a tu usuario de TradingView. Compartirlos o duplicarlos viola los términos de uso.</p>
              </details>
              <details>
                <summary>¿En cuánto tiempo recibiré el acceso?</summary>
                <p>Normalmente en menos de 24 horas desde que enviás tu usuario de TradingView. En muchos casos, dentro de 1–2 horas en días hábiles.</p>
              </details>
              <details>
                <summary>¿Recibiré actualizaciones y mejoras?</summary>
                <p>Sí. Todas las mejoras futuras de todos los indicadores estarán disponibles sin costo adicional para quienes tengan el pack.</p>
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
