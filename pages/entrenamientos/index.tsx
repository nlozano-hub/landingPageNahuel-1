import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import YouTubePlayer from '@/components/YouTubePlayer';
import BackgroundVideo from '@/components/BackgroundVideo';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Users, 
  Clock,
  Star,
  CheckCircle,
  ArrowRight,
  BookOpen,
  Target,
  Award,
  PlayCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import styles from '@/styles/EntrenamientosIndex.module.css';

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

interface EntrenamientosPageProps {
  trainings: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    level: string;
    duration: string;
    lessons: number;
    students: number;
    rating: number;
    price: string;
    features: string[];
    href: string;
    image: string;
    badge?: string;
  }>;
  videoConfig: {
    youtubeId: string;
    title: string;
    description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
  swingTradingVideoConfig: {
    youtubeId: string;
    title: string;
    description: string;
    autoplay: boolean;
    muted: boolean;
    loop: boolean;
  };
}

const EntrenamientosPage: React.FC<EntrenamientosPageProps> = ({ trainings, videoConfig, swingTradingVideoConfig }) => {
  return (
    <>
      <Head>
        <title>Entrenamientos - Formación Especializada en Trading | Nahuel Lozano</title>
        <meta name="description" content="Entrenamientos especializados en trading y mercados financieros. Desde fundamentos hasta estrategias avanzadas con Nahuel Lozano." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />
      
      <main className={styles.main}>
        {/* Hero Section - Nuevo diseño basado en la imagen */}
        <section className={styles.heroSection}>
          {/* Video de fondo */}
          <BackgroundVideo
            videoSrc="/logos/Diseño Web-LozanoNahuel-Entrenamientos-SwingTrading.mp4"
            className={styles.heroVideoBackground}
            autoPlay={true}
            muted={true}
            loop={true}
            showControls={false}
          />
          
          <div className={styles.container}>
            <div className={styles.heroContent}>
              {/* Contenido izquierdo - Texto y botón */}
              <motion.div 
                className={styles.heroText}
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
              >
                <h1 className={styles.heroTitle}>
                  Entrenamientos
                </h1>
                <p className={styles.heroDescription}>
                  Experiencia premium, intensiva y personalizada con acompañamiento en cada paso de tu camino como trader profesional.
                </p>
                <Link href="https://lozanonahuel.vercel.app/entrenamientos/zero2trader" className={styles.heroCTA}>
                  Empezá Ahora &gt;
                </Link>
              </motion.div>

              {/* Contenido derecho - Video player */}
              <motion.div 
                className={styles.heroVideo}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
              >
                {videoConfig && videoConfig.youtubeId && videoConfig.youtubeId !== 'dQw4w9WgXcQ' ? (
                  <YouTubePlayer
                    videoId={videoConfig.youtubeId}
                    title={videoConfig.title}
                    autoplay={videoConfig.autoplay}
                    muted={videoConfig.muted}
                    loop={videoConfig.loop}
                    controls={true}
                    width="100%"
                    height="100%"
                    className={styles.videoPlayer}
                  />
                ) : (
                  <div className={styles.videoPlaceholder}>
                    <PlayCircle size={64} />
                    <p>Video no configurado</p>
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </section>

        {/* Zero 2 Trader Section - Nuevo diseño basado en la imagen */}
        <section className={styles.swingTradingSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.swingTradingCard}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {/* Video Player con Overlay */}
              <div className={styles.videoPlayerContainer}>
                {swingTradingVideoConfig && swingTradingVideoConfig.youtubeId && swingTradingVideoConfig.youtubeId !== 'dQw4w9WgXcQ' ? (
                  <YouTubePlayer
                    videoId={swingTradingVideoConfig.youtubeId}
                    title={swingTradingVideoConfig.title}
                    autoplay={swingTradingVideoConfig.autoplay}
                    muted={swingTradingVideoConfig.muted}
                    loop={swingTradingVideoConfig.loop}
                    controls={true}
                    width="100%"
                    height="100%"
                    className={styles.videoPlayer}
                  />
                ) : (
                  <div className={styles.videoPlaceholder}>
                    <PlayCircle size={64} />
                    <p>Video no configurado</p>
                  </div>
                )}

                {/* Overlay con información */}
                <div className={styles.videoOverlay}>
                  <div className={styles.videoInfo}>
                    <h3 className={styles.videoTitle}>Zero 2 Trader</h3>
                    <span className={styles.videoTag}>Entrenamiento</span>
                  </div>
                </div>
              </div>

              {/* Main Content */}
              <div className={styles.serviceContent}>
                <p className={styles.serviceDescription}>
                  Experiencia de entrenamiento integral para llevarte de cero a operar con independencia total. Aprendés a analizar el mercado como un profesional, aplicás una estrategia de trading probada y operás en un entorno real con acompañamiento en cada paso.
                </p>

                <ul className={styles.featureList}>
                  <li className={styles.featureItem}>
                    <span className={styles.checkmark}>✓</span>
                    Estrategias de análisis técnico de temporalidades medias (días y semanas)
                  </li>
                  <li className={styles.featureItem}>
                    <span className={styles.checkmark}>✓</span>
                    Análisis de riesgo del portafolio completo según contexto de los principales mercados
                  </li>
                  <li className={styles.featureItem}>
                    <span className={styles.checkmark}>✓</span>
                    Indicadores de momentum y lectura chartista
                  </li>
                  <li className={styles.featureItem}>
                    <span className={styles.checkmark}>✓</span>
                    Actualización de status diario y ejecución de operaciones durante toda la jornada
                  </li>
                  <li className={styles.featureItem}>
                    <span className={styles.checkmark}>✓</span>
                    Búsqueda de movimientos largos y altamente rentables
                  </li>
                </ul>

                <div className={styles.buttonContainer}>
                  <Link href="/entrenamientos/zero2trader" className={styles.serviceButton}>
                    Quiero saber más &gt;
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Sección CTA - Fondo Oscuro */}
        <section className={styles.ctaSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.ctaContent}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className={styles.ctaTitle}>
                ¿Listo para llevar tus inversiones al siguiente nivel? 
              </h2>
              <p className={styles.ctaDescription}>
                Únete a nuestra comunidad y comienza a construir tu libertad financiera
              </p>
              <Link href="/entrenamientos/zero2trader" className={styles.ctaButton}>
                Zero 2 Trader <ArrowRight size={20} />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Sección YouTube Community - Fondo Morado */}
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
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Conectar a la base de datos
    const dbConnect = (await import('@/lib/mongodb')).default;
    await dbConnect();
    
    // Importar el modelo SiteConfig
    const SiteConfig = (await import('@/models/SiteConfig')).default;
    
    // Obtener la configuración del sitio
    const siteConfig = await SiteConfig.findOne({});
    
    // Obtener la configuración del video de entrenamientos (hero)
    const videoConfig = siteConfig?.serviciosVideos?.entrenamientos || {
      youtubeId: 'dQw4w9WgXcQ',
      title: 'Video de Entrenamientos',
      description: 'Conoce nuestros programas de formación especializados',
      autoplay: false,
      muted: true,
      loop: false
    };

    // Obtener la configuración del video de Zero 2 Trader
    const swingTradingVideoConfig = siteConfig?.trainingVideos?.swingTrading?.heroVideo || {
      youtubeId: 'dQw4w9WgXcQ',
      title: 'Zero 2 Trader - Video Promocional',
      description: 'Descubre el programa completo de Zero 2 Trader',
      autoplay: false,
      muted: true,
      loop: false
    };

    // Obtener precio dinámico desde /api/pricing
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    let swingPriceStr = '$75000 ARS';
    try {
      const pricingRes = await fetch(`${baseUrl}/api/pricing`);
      if (pricingRes.ok) {
        const pricingData = await pricingRes.json();
        const priceVal = pricingData?.data?.entrenamientos?.swingTrading?.price;
        const currency = pricingData?.data?.currency || 'ARS';
        if (typeof priceVal === 'number' && priceVal > 0) {
          swingPriceStr = `$${priceVal} ${currency}`;
        }
      }
    } catch (e) {
      // ignorar, mantener fallback
    }

    const trainings = [
      {
        id: 'trading-fundamentals',
        title: 'Trading Fundamentals',
        subtitle: 'Fundamentos del Trading Profesional',
        description: 'Programa completo desde cero hasta nivel intermedio. Aprende análisis técnico, fundamental, gestión de riesgo y psicología del trading con metodología step-by-step.',
        level: 'Principiante - Intermedio',
        duration: '40 horas',
        lessons: 85,
        students: 850,
        rating: 4.8,
        price: swingPriceStr,
        features: [
          'Análisis técnico y fundamental',
          'Gestión de riesgo avanzada',
          'Psicología del trading',
          'Estrategias para diferentes mercados',
          'Acceso a comunidad privada',
          'Certificado de completación'
        ],
        href: '/entrenamientos/zero2trader',
        image: '/entrenamientos/swing-trading.jpg',
        badge: 'Más Popular'
      }
    ];

    return {
      props: {
        trainings,
        videoConfig: JSON.parse(JSON.stringify(videoConfig)),
        swingTradingVideoConfig: JSON.parse(JSON.stringify(swingTradingVideoConfig))
      }
    };
  } catch (error) {
    console.error('Error en getServerSideProps:', error);
    
    // Fallback en caso de error
    const videoConfig = {
      youtubeId: 'dQw4w9WgXcQ',
      title: 'Video de Entrenamientos',
      description: 'Conoce nuestros programas de formación especializados',
      autoplay: false,
      muted: true,
      loop: false
    };

    const swingTradingVideoConfig = {
      youtubeId: 'dQw4w9WgXcQ',
      title: 'Zero 2 Trader - Video Promocional',
      description: 'Descubre el programa completo de Zero 2 Trader',
      autoplay: false,
      muted: true,
      loop: false
    };

    const trainings = [
      {
        id: 'trading-fundamentals',
        title: 'Trading Fundamentals',
        subtitle: 'Fundamentos del Trading Profesional',
        description: 'Programa completo desde cero hasta nivel intermedio. Aprende análisis técnico, fundamental, gestión de riesgo y psicología del trading con metodología step-by-step.',
        level: 'Principiante - Intermedio',
        duration: '40 horas',
        lessons: 85,
        students: 850,
        rating: 4.8,
        price: '$75000 ARS',
        features: [
          'Análisis técnico y fundamental',
          'Gestión de riesgo avanzada',
          'Psicología del trading',
          'Estrategias para diferentes mercados',
          'Acceso a comunidad privada',
          'Certificado de completación'
        ],
        href: '/entrenamientos/zero2trader',
        image: '/entrenamientos/swing-trading.jpg',
        badge: 'Más Popular'
      }
    ];

    return {
      props: {
        trainings,
        videoConfig,
        swingTradingVideoConfig
      }
    };
  }
};

export default EntrenamientosPage; 