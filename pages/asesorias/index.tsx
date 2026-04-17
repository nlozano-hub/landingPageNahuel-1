import React from 'react';
import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  CheckCircle,
  ArrowRight,
  Calendar,
  Clock,
  TrendingUp,
  Shield,
  ChevronDown,
  ChevronUp,
  Users,
  Globe,
  FileText
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VideoPlayerMux from '@/components/VideoPlayerMux';
import { usePricing } from '@/hooks/usePricing';
import BackgroundVideo from '@/components/BackgroundVideo';
import YouTubePlayer from '@/components/YouTubePlayer';
import styles from '@/styles/AsesoriasIndex.module.css';

interface AsesoriasPageProps {
  session: any;
  asesorias: Array<{
    id: string;
    title: string;
    subtitle: string;
    description: string;
    duration: string;
    modality: string;
    price: string | number;
    features: string[];
    href: string;
    icon: string;
    badge?: string;
    videoId?: string;
    videoTitle?: string;
    infoPoints?: string[];
  }>;
  faqs: Array<{
    question: string;
    answer: string;
  }>;
}

/**
 * Página principal de Asesorías
 * Muestra los dos tipos: Consultorio Financiero y Cuenta Asesorada
 */
const AsesoriasPage: React.FC<AsesoriasPageProps> = ({ session, asesorias, faqs }) => {
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);
  const { pricing, loading: pricingLoading } = usePricing();

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const testimonios = [
    {
      nombre: 'Ana Martínez',
      resultado: '+127% en 8 meses',
      comentario: 'La asesoría personalizada transformó completamente mi estrategia de inversión.',
      servicio: 'Consultorio Financiero'
    },
    {
      nombre: 'Carlos Rivera',
      resultado: '+89% en 12 meses',
      comentario: 'La cuenta asesorada me permite invertir sin preocuparme por la gestión diaria.',
      servicio: 'Cuenta Asesorada'
    },
    {
      nombre: 'María González',
      resultado: '+156% en 10 meses',
      comentario: 'Excelente atención y resultados que superaron mis expectativas.',
      servicio: 'Cuenta Asesorada'
    }
  ];

  return (
    <>
      <Head>
        <title>Asesorías - Consultoría Financiera Personalizada | Nahuel Lozano</title>
        <meta name="description" content="Asesorías financieras personalizadas. Consultorio Financiero y Cuenta Asesorada para optimizar tus inversiones con estrategias profesionales." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Hero Section con Video Explicativo */}
        <section className={styles.heroSection}>
          <BackgroundVideo 
            videoSrc="/videos/Diseño Web-LozanoNahuel-Asesorías-ConsultorioFinanciero.mp4"
            posterSrc="/images/trading-office.jpg"
            autoPlay={true}
            muted={true}
            loop={true}
            showControls={false}
            className={styles.backgroundVideo}
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
                  Asesorías
                  <span className={styles.heroSubtitle}>Consultoría Financiera Personalizada</span>
                </h1>
                <p className={styles.heroDescription}>
                  Optimiza tu estrategia de inversión con asesoría profesional personalizada. 
                  Desde consultas individuales hasta gestión completa de portafolio, 
                  te acompañamos en cada paso hacia tus objetivos financieros.
                </p>
                <div className={styles.heroFeatures}>
                  <div className={styles.heroFeature}>
                    <CheckCircle size={20} />
                    <span>Estrategias personalizadas según tu perfil</span>
                  </div>
                  <div className={styles.heroFeature}>
                    <CheckCircle size={20} />
                    <span>Análisis profesional de mercados y oportunidades</span>
                  </div>
                  <div className={styles.heroFeature}>
                    <CheckCircle size={20} />
                    <span>Seguimiento continuo y ajustes estratégicos</span>
                  </div>
                </div>
              </div>
              <div className={styles.heroVideo}>
                <div className={styles.videoContainer}>
                  <YouTubePlayer
                    videoId="dQw4w9WgXcQ"
                    title="Asesorías - Consultoría Financiera Personalizada"
                    autoplay={false}
                    muted={true}
                    loop={false}
                    className={styles.videoPlayer}
                    fillContainer={true}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 2 Tarjetas de Asesorías */}
        <section className={styles.asesoriasSection}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Nuestros Servicios de Asesoría
            </motion.h2>
            <motion.p 
              className={styles.sectionDescription}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Elige la modalidad que mejor se adapte a tus objetivos financieros
            </motion.p>
            
            <div className={styles.servicesGrid}>
              {asesorias.map((asesoria, index) => (
                <motion.div
                  key={asesoria.id}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.2 }}
                >
                  <motion.div
                    className={styles.serviceCard}
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Video Player con Overlay */}
                    <div className={styles.videoPlayerContainer}>
                      <YouTubePlayer
                        videoId={asesoria.videoId || "dQw4w9WgXcQ"}
                        title={`${asesoria.title} - Introducción`}
                        autoplay={false}
                        muted={true}
                        loop={false}
                        className={styles.videoPlayer}
                      />

                      {/* Overlay con información */}
                      <div className={styles.videoOverlay}>
                        <div className={styles.videoInfo}>
                          <h3 className={styles.videoTitle}>{asesoria.title}</h3>
                          <span className={styles.videoTag}>Asesoría</span>
                        </div>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className={styles.serviceContent}>
                      <p className={styles.serviceDescription}>{asesoria.description}</p>

                      <ul className={styles.featureList}>
                        {(asesoria.infoPoints && asesoria.infoPoints.length > 0 
                          ? asesoria.infoPoints 
                          : asesoria.features.slice(0, 5)
                        ).map((feature, idx) => (
                          <li key={idx} className={styles.featureItem}>
                            <span className={styles.checkmark}>✓</span>
                            {feature}
                          </li>
                        ))}
                      </ul>

                      <div className={styles.buttonContainer}>
                        <Link href={asesoria.href} className={styles.serviceButton}>
                          Quiero saber más &gt;
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Preguntas Frecuentes */}
        <section className={styles.faqSection}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Preguntas Frecuentes
            </motion.h2>
            <motion.p 
              className={styles.sectionDescription}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Resolvemos las dudas más comunes sobre nuestros servicios de asesoría
            </motion.p>
            
            <div className={styles.faqContainer}>
              {faqs.map((faq, index) => (
                <motion.div 
                  key={index}
                  className={styles.faqItem}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <button 
                    className={styles.faqQuestion}
                    onClick={() => toggleFaq(index)}
                  >
                    <span>{faq.question}</span>
                    {openFaq === index ? 
                      <ChevronUp size={20} /> : 
                      <ChevronDown size={20} />
                    }
                  </button>
                  
                  {openFaq === index && (
                    <motion.div 
                      className={styles.faqAnswer}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <p>{faq.answer}</p>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.ctaSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.ctaCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className={styles.ctaContent}>
                <h2 className={styles.ctaTitle}>
                  ¿Listo para Optimizar tus Inversiones?
                </h2>
                <p className={styles.ctaDescription}>
                  Agenda tu primera consulta y descubre cómo maximizar el potencial de tu portafolio
                </p>
                <div className={styles.ctaActions}>
                  <Link href="/asesorias/consultorio-financiero" className={styles.ctaButton}>
                    Agendar Consulta
                    <ArrowRight size={20} />
                  </Link>

                </div>
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
    const session = await getSession(context);
    
    const asesorias = [
      {
        id: 'consultorio-financiero',
        title: 'Consultorio Financiero',
        subtitle: 'Consulta Individual Personalizada',
        description: 'Sesión one-on-one para analizar tu situación financiera actual y diseñar una estrategia de inversión personalizada según tu perfil de riesgo y objetivos.',
        duration: '45 minutos',
        modality: 'Videollamada',
        price: '50000',
        features: [
          'Análisis completo de tu portafolio actual',
          'Estrategia personalizada según tu perfil',
          'Recomendaciones de activos específicos',
          'Plan de acción con objetivos claros',
          'Material educativo personalizado',
          'Seguimiento por email (30 días)'
        ],
        href: '/asesorias/consultorio-financiero',
        icon: '🩺',
        badge: 'Más Solicitado',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Consultorio Financiero - Video Promocional',
        infoPoints: [
          'Análisis completo de tu portafolio actual',
          'Estrategia personalizada según tu perfil',
          'Recomendaciones de activos específicos',
          'Plan de acción con objetivos claros',
          'Material educativo personalizado'
        ]
      }
    ];

    const faqs = [
      {
        question: '¿Cuál es la diferencia entre Consultorio Financiero y Cuenta Asesorada?',
        answer: 'El Consultorio Financiero es una consulta puntual donde analizamos tu situación y te damos recomendaciones para que ejecutes por tu cuenta. La Cuenta Asesorada es un servicio continuo donde gestionamos directamente tu portafolio.'
      },
      {
        question: '¿Qué experiencia tienen en gestión de portafolios?',
        answer: 'Contamos con más de 7 años de experiencia en mercados financieros, habiendo gestionado más de $2M USD en portafolios de clientes privados con rentabilidades promedio del 120% anual.'
      },
      {
        question: '¿Cómo funciona el proceso de asesoría?',
        answer: 'Primero realizamos una evaluación completa de tu perfil de inversor, objetivos y situación actual. Luego diseñamos una estrategia personalizada y te acompañamos en la implementación con seguimiento continuo.'
      },
      {
        question: '¿Qué monto mínimo se requiere para la Cuenta Asesorada?',
        answer: 'El monto mínimo para el servicio de Cuenta Asesorada es de $10,000 USD. Para montos menores recomendamos comenzar con el Consultorio Financiero.'
      },
      {
        question: '¿En qué mercados invierten?',
        answer: 'Trabajamos principalmente en mercados de Estados Unidos (acciones, ETFs, opciones), criptomonedas principales, y selectivamente en mercados emergentes según las oportunidades y perfil del cliente.'
      },
      {
        question: '¿Cómo se realiza el seguimiento y reporting?',
        answer: 'Enviamos reportes mensuales detallados con performance, análisis de mercado y próximos movimientos. Además, tienes acceso 24/7 a una plataforma donde puedes ver el estado de tu portafolio en tiempo real.'
      },
      {
        question: '¿Puedo cancelar el servicio en cualquier momento?',
        answer: 'Sí, puedes cancelar el servicio con 30 días de anticipación. Para la Cuenta Asesorada, te ayudamos con la transición y transferencia de activos sin costos adicionales.'
      },
      {
        question: '¿Ofrecen garantías de rentabilidad?',
        answer: 'No ofrecemos garantías de rentabilidad ya que toda inversión conlleva riesgos. Sin embargo, trabajamos con estrategias probadas y gestión de riesgo profesional para maximizar las probabilidades de éxito.'
      }
    ];
    
    return {
      props: {
        session: session || null,
        asesorias,
        faqs
      },
    };
  } catch (error) {
    console.error('❌ Error in getServerSideProps:', error);
    return {
      props: {
        session: null,
        asesorias: [],
        faqs: []
      },
    };
  }
};

export default AsesoriasPage; 