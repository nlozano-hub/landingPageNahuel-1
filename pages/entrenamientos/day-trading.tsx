import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { toast } from 'react-hot-toast';
import { generateCircularAvatarDataURL } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Carousel from '@/components/Carousel';
import TrainingRoadmap from '@/components/TrainingRoadmap';
import ClassCalendar from '@/components/ClassCalendar';
import SwingTradingFAQ from '@/components/SwingTradingFAQ';
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
  Calendar,
  User,
  Quote,
  Loader,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import styles from '@/styles/SwingTrading.module.css';

interface TrainingData {
  tipo: string;
  nombre: string;
  descripcion: string;
  precio: number;
  duracion: number;
  metricas: {
    rentabilidad: string;
    estudiantesActivos: string;
    entrenamientosRealizados: string;
    satisfaccion: string;
  };
  contenido: {
    modulos: number;
    lecciones: number;
    certificacion: boolean;
    nivelAcceso: string;
  };
}

interface ProgramModule {
  module: number;
  title: string;
  duration: string;
  lessons: number;
  topics: string[];
  description: string;
}

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
  image: string;
  results: string;
}

interface RoadmapModule {
  id: number;
  titulo: string;
  descripcion: string;
  duracion: string;
  lecciones: number;
  temas: Array<{
    titulo: string;
    descripcion?: string;
  }>;
  dificultad: 'Básico' | 'Intermedio' | 'Avanzado';
  prerequisito?: number;
  orden: number;
  activo: boolean;
}

interface TrainingDate {
  id: string;
  date: Date;
  time: string;
  title: string;
  isActive: boolean;
  createdBy: string;
}

interface DayTradingPageProps {
  training: TrainingData;
  program: ProgramModule[];
  testimonials: Testimonial[];
  roadmap: RoadmapModule[];
  trainingDates: TrainingDate[];
}

const DayTradingPage: React.FC<DayTradingPageProps> = ({ 
  training, 
  program, 
  testimonials, 
  roadmap, 
  trainingDates 
}) => {
  const { data: session } = useSession();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [showEnrollForm, setShowEnrollForm] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [checkingEnrollment, setCheckingEnrollment] = useState(false);
  
  // Estados para roadmaps dinámicos
  const [roadmapModules, setRoadmapModules] = useState<RoadmapModule[]>([]);
  const [loadingRoadmap, setLoadingRoadmap] = useState(true);
  const [roadmapError, setRoadmapError] = useState<string>('');

  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    telefono: '',
    experienciaTrading: '',
    objetivos: '',
    nivelExperiencia: 'principiante',
    consulta: ''
  });

  // Estados para el countdown y fecha de inicio
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0
  });
  const [startDateText, setStartDateText] = useState('16 de agosto a las 10:00 hs');
  
  // Estados para gestión de fechas de entrenamiento
  const [trainingDatesState, setTrainingDatesState] = useState<TrainingDate[]>([]);
  const [nextTrainingDate, setNextTrainingDate] = useState<TrainingDate | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados para el carrusel de testimonios
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const carouselTestimonials = [
    {
      initial: 'D',
      name: 'Diego Ramírez',
      text: '"El programa me enseñó a ser consistente en el day trading. Ahora genero ingresos diarios estables."',
      backgroundColor: '#ef4444'
    },
    {
      initial: 'S', 
      name: 'Sofía Torres',
      text: '"Las estrategias de scalping cambiaron mi vida. Pude dejar mi trabajo y vivir del trading."',
      backgroundColor: '#06b6d4'
    },
    {
      initial: 'A',
      name: 'Andrés Vega', 
      text: '"La gestión de riesgo que enseñan es increíble. Nunca más tuve pérdidas devastadoras."',
      backgroundColor: '#84cc16'
    }
  ];

  // Función para calcular el countdown basado en la fecha de inicio
  const calculateCountdown = (startDate: Date, startTime: string) => {
    const now = new Date();
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const targetDate = new Date(startDate);
    targetDate.setHours(startHours, startMinutes, 0, 0);
    
    const diff = targetDate.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0 };
    }
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return { days, hours, minutes };
  };

  useEffect(() => {
    if (session?.user) {
      setFormData(prev => ({
        ...prev,
        nombre: session.user.name || '',
        email: session.user.email || ''
      }));
      
      // Verificar si el usuario ya está inscrito
      checkEnrollmentStatus();
    }
  }, [session]);

  // Cargar roadmaps dinámicos
  useEffect(() => {
    fetchRoadmaps();
  }, []);

  // Cargar fechas de entrenamiento y verificar admin
  useEffect(() => {
    loadTrainingDates();
    
    // Verificar si el usuario es admin
    if (session?.user) {
      setIsAdmin(session.user.role === 'admin');
    }
  }, [session]);

  // Countdown timer dinámico basado en la próxima fecha de entrenamiento
  useEffect(() => {
    const updateCountdown = () => {
      if (nextTrainingDate) {
        const newCountdown = calculateCountdown(nextTrainingDate.date, nextTrainingDate.time);
        setCountdown(newCountdown);
        
        // Actualizar texto de fecha de inicio
        const formattedDate = nextTrainingDate.date.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long'
        });
        setStartDateText(`${formattedDate} a las ${nextTrainingDate.time} hs`);
      } else {
        // Fallback si no hay próxima fecha
        const defaultDate = new Date('2024-08-16T10:00:00.000Z');
        const defaultTime = '10:00';
        const newCountdown = calculateCountdown(defaultDate, defaultTime);
        setCountdown(newCountdown);
        setStartDateText('Próximamente - Fechas por confirmar');
      }
    };

    // Actualizar countdown inicial
    updateCountdown();

    // Actualizar cada minuto
    const timer = setInterval(updateCountdown, 60000);

    return () => clearInterval(timer);
  }, [nextTrainingDate]);

  // Efecto para actualizar la próxima fecha cuando pasa el tiempo
  useEffect(() => {
    const checkForNextDate = () => {
      const nextDate = findNextTrainingDate(trainingDatesState);
      if (nextDate !== nextTrainingDate) {
        setNextTrainingDate(nextDate);
      }
    };

    // Verificar cada hora si hay que actualizar la próxima fecha
    const timer = setInterval(checkForNextDate, 3600000); // 1 hora

    return () => clearInterval(timer);
  }, [trainingDatesState, nextTrainingDate]);

  const fetchRoadmaps = async () => {
    try {
      setLoadingRoadmap(true);
      setRoadmapError('');
      
      const response = await fetch('/api/roadmaps/tipo/DayTrading');
      const data = await response.json();
      
      if (data.success && data.data.roadmaps.length > 0) {
        // Tomar el primer roadmap activo
        const activeRoadmap = data.data.roadmaps.find((r: any) => r.activo) || data.data.roadmaps[0];
        
        if (activeRoadmap) {
          // Cargar módulos independientes del roadmap
          const modulesResponse = await fetch(`/api/modules/roadmap/${activeRoadmap._id}`);
          const modulesData = await modulesResponse.json();
          
          if (modulesData.success && modulesData.data.modules.length > 0) {
            // Transformar módulos para ser compatibles con TrainingRoadmap
            const transformedModules = modulesData.data.modules.map((module: any) => ({
              id: module._id,
              titulo: module.nombre,
              descripcion: module.descripcion,
              duracion: module.duracion,
              lecciones: module.lecciones,
              temas: module.temas,
              dificultad: module.dificultad,
              prerequisito: module.prerequisito?._id,
              orden: module.orden,
              activo: module.activo
            }));
            
            setRoadmapModules(transformedModules);
          } else {
            setRoadmapError('Este roadmap aún no tiene módulos creados. Contacta al administrador.');
          }
        } else {
          setRoadmapError('No se encontró un roadmap activo para Day Trading');
        }
      } else {
        setRoadmapError('No se encontraron roadmaps para Day Trading');
      }
    } catch (error) {
      console.error('Error al cargar roadmaps:', error);
      setRoadmapError('Error al cargar el roadmap de aprendizaje');
    } finally {
      setLoadingRoadmap(false);
    }
  };

  const checkEnrollmentStatus = async () => {
    if (!session?.user?.email) return;
    
    setCheckingEnrollment(true);
    try {
      const response = await fetch('/api/user/entrenamientos');
      if (response.ok) {
        const data = await response.json();
        const hasDayTrading = data.data.tiposDisponibles.includes('DayTrading');
        setIsEnrolled(hasDayTrading);
      }
    } catch (error) {
      console.error('Error checking enrollment:', error);
    } finally {
      setCheckingEnrollment(false);
    }
  };

  // Función para encontrar la próxima fecha de entrenamiento
  const findNextTrainingDate = (dates: TrainingDate[]): TrainingDate | null => {
    const now = new Date();
    const futureDates = dates
      .filter(date => date.isActive && date.date > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return futureDates.length > 0 ? futureDates[0] : null;
  };

  // Función para cargar fechas de entrenamiento (simplificada)
  const loadTrainingDates = async () => {
    try {
      // console.log('📅 Cargando fechas específicas de Day Trading...');
      
      const response = await fetch('/api/training-dates/DayTrading');
      const data = await response.json();
      
      if (data.success && data.dates) {
        const dates = data.dates.map((date: any) => ({
          ...date,
          date: new Date(date.date)
        }));
        
        // console.log('✅ Fechas cargadas:', dates.length);
        
        setTrainingDatesState(dates);
        const nextDate = findNextTrainingDate(dates);
        setNextTrainingDate(nextDate);
        
        // Actualizar el countdown y texto de fecha
        if (nextDate) {
          const dateOptions: Intl.DateTimeFormatOptions = { 
            day: 'numeric', 
            month: 'long' 
          };
          const formattedDate = nextDate.date.toLocaleDateString('es-ES', dateOptions);
          setStartDateText(`${formattedDate} a las ${nextDate.time} hs`);
        } else {
          setStartDateText('Próximamente - Fechas por confirmar');
        }
      } else {
        // console.log('📭 No hay fechas específicas configuradas');
        setTrainingDatesState([]);
        setNextTrainingDate(null);
        setStartDateText('Próximamente - Fechas por confirmar');
      }
      
    } catch (error) {
      console.error('❌ Error cargando fechas:', error);
      setTrainingDatesState([]);
      setNextTrainingDate(null);
      setStartDateText('Próximamente - Fechas por confirmar');
    }
  };

  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handleEnroll = async () => {
    if (!session) {
      toast.error('Debes iniciar sesión primero para inscribirte');
      signIn('google');
      return;
    }
    
    if (isEnrolled) {
      // Si ya está inscrito, ir directamente a las lecciones
      window.location.href = '/entrenamientos/DayTrading/lecciones';
      return;
    }
    
    // Iniciar proceso de pago con MercadoPago
    setIsProcessingPayment(true);
    
    try {
      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          type: 'training',
          service: 'DayTrading',
          amount: training.precio,
          currency: 'ARS'
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error || 'Error al procesar el pago');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar el pago. Inténtalo nuevamente.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleSubmitEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEnrolling(true);

    try {
      const response = await fetch('/api/entrenamientos/inscribir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tipo: 'DayTrading',
          ...formData
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || '¡Inscripción exitosa! Redirigiendo a las lecciones...');
        setShowEnrollForm(false);
        
        // Resetear formulario
        setFormData({
          nombre: session?.user?.name || '',
          email: session?.user?.email || '',
          telefono: '',
          experienciaTrading: '',
          objetivos: '',
          nivelExperiencia: 'principiante',
          consulta: ''
        });

        // Redirigir a las lecciones después de 2 segundos
        setTimeout(() => {
          window.location.href = data.data.redirectUrl;
        }, 2000);
      } else {
        if (response.status === 409) {
          // Ya está inscrito
          toast.success('Ya tienes acceso a este entrenamiento. Redirigiendo a las lecciones...');
          setTimeout(() => {
            window.location.href = '/entrenamientos/DayTrading/lecciones';
          }, 1500);
        } else {
          toast.error(data.error || 'Error al procesar inscripción');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar inscripción. Inténtalo nuevamente.');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleModuleClick = (moduleId: number) => {
    // console.log(`Accediendo al módulo ${moduleId}`);
    // Aquí se implementaría la navegación al módulo específico
  };

  // Función para manejar selección de fechas en el calendario
  const handleCalendarDateSelect = (selectedDate: Date, existingEvents: any[]) => {
    if (!isAdmin) return;

    // Mostrar modal o form para agregar nueva fecha
    const time = prompt('Ingrese la hora (formato HH:MM):', '10:00');
    const title = prompt('Ingrese el título de la clase:', `Clase ${trainingDatesState.length + 1}`);
    
    if (time && title) {
      // Aquí se implementaría la lógica para agregar nueva fecha
      // console.log('Agregando nueva fecha:', { selectedDate, time, title });
    }
  };

  // Funciones para el carrusel de testimonios
  const nextTestimonial = () => {
    setCurrentTestimonialIndex((prev) => 
      prev === carouselTestimonials.length - 1 ? 0 : prev + 1
    );
  };

  const prevTestimonial = () => {
    setCurrentTestimonialIndex((prev) => 
      prev === 0 ? carouselTestimonials.length - 1 : prev - 1
    );
  };

  // Auto-play del carrusel
  useEffect(() => {
    const interval = setInterval(nextTestimonial, 5000); // Cambia cada 5 segundos
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Head>
        <title>Day Trading - Estrategias Avanzadas | Nahuel Lozano</title>
        <meta name="description" content="Domina el Day Trading con estrategias profesionales. Aprende técnicas avanzadas de trading intradía y maximiza tus ganancias." />
        <meta name="keywords" content="day trading, trading intradía, estrategias trading, curso trading, scalping" />
        <meta property="og:title" content="Day Trading - Estrategias Avanzadas" />
        <meta property="og:description" content="Domina el Day Trading con estrategias profesionales y técnicas avanzadas." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://lozanonahuel.vercel.app/entrenamientos/day-trading" />
        <link rel="canonical" href="https://lozanonahuel.vercel.app/entrenamientos/day-trading" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        {/* Hero Section con Video Explicativo */}
        <section className={styles.heroSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.heroContent}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  Day Trading
                </h1>
                <p className={styles.heroDescription}>
                  Experiencia de aprendizaje premium, personalizada y con acompañamiento constante, donde aprenderás a operar movimientos intradía, identificando oportunidades con análisis técnico y estrategias que combinan precisión y velocidad
                </p>
                
                <div className={styles.startDate}>
                  Fecha de inicio: {startDateText}
                </div>
                
                <div className={styles.countdownContainer}>
                  <div className={styles.countdownBox}>
                    <span className={styles.countdownNumber}>{countdown.days}</span>
                    <span className={styles.countdownLabel}>Días</span>
                  </div>
                  <div className={styles.countdownBox}>
                    <span className={styles.countdownNumber}>{countdown.hours}</span>
                    <span className={styles.countdownLabel}>Horas</span>
                  </div>
                  <div className={styles.countdownBox}>
                    <span className={styles.countdownNumber}>{countdown.minutes}</span>
                    <span className={styles.countdownLabel}>Minutos</span>
                  </div>
                </div>
                <button 
                  onClick={handleEnroll}
                  className={styles.enrollButton}
                  disabled={checkingEnrollment || isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader size={20} className={styles.spinner} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Inscribirme Ahora &gt;
                    </>
                  )}
                </button>
              </div>
              <div className={styles.heroVideo}>
                <div className={styles.videoContainer}>
                  <div className={styles.videoPlayer}>
                    <div className={styles.videoPlaceholder}>
                      <div className={styles.playButton}>
                        <PlayCircle size={60} />
                      </div>
                    </div>
                    <div className={styles.videoControls}>
                      <div className={styles.videoProgress}>
                        <span className={styles.currentTime}>2:21</span>
                        <div className={styles.progressBar}>
                          <div className={styles.progressFill}></div>
                        </div>
                        <span className={styles.totalTime}>20:00</span>
                      </div>
                      <div className={styles.controlButtons}>
                        <button className={styles.controlBtn}>⏮</button>
                        <button className={styles.controlBtn}>⏯</button>
                        <button className={styles.controlBtn}>⏭</button>
                        <button className={styles.controlBtn}>🔊</button>
                        <button className={styles.controlBtn}>⚙️</button>
                        <button className={styles.controlBtn}>⛶</button>
                        <button className={styles.controlBtn}>⛶</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Info Cards Section */}
        <section className={styles.infoCardsSection}>
          <div className={styles.infoCardsContainer}>
            {/* Card 1: ¿Por qué realizar este entrenamiento? */}
            <motion.div 
              className={styles.infoCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <h3 className={styles.infoCardTitle}>
                ¿Por qué realizar este entrenamiento?
              </h3>
              <ul className={styles.infoCardList}>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>🎯</span>
                  <span className={styles.infoCardText}>Porque hay que aplicar el análisis correcto</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>✅</span>
                  <span className={styles.infoCardText}>Necesitás una estrategia efectiva de scalping</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>🔧</span>
                  <span className={styles.infoCardText}>Método probado con guía paso a paso</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>⏰</span>
                  <span className={styles.infoCardText}>Ahorras tiempo, dinero y energía</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>🚀</span>
                  <span className={styles.infoCardText}>Transforma la teoría en resultados diarios</span>
                </li>
              </ul>
            </motion.div>

            {/* Card 2: ¿Para quién es esta experiencia? */}
            <motion.div 
              className={styles.infoCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <h3 className={styles.infoCardTitle}>
                ¿Para quién es esta experiencia?
              </h3>
              <ul className={styles.infoCardList}>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>📚</span>
                  <span className={styles.infoCardText}>Para quienes quieren empezar a invertir</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>✅</span>
                  <span className={styles.infoCardText}>Traders que buscan ganancias diarias</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>📈</span>
                  <span className={styles.infoCardText}>Quienes operan sin una estrategia eficaz</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>💼</span>
                  <span className={styles.infoCardText}>Personas comprometidas con la disciplina</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>🧠</span>
                  <span className={styles.infoCardText}>Para los que quieran operar con criterio</span>
                </li>
              </ul>
            </motion.div>

            {/* Card 3: ¿Cómo es el entrenamiento? */}
            <motion.div 
              className={styles.infoCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <h3 className={styles.infoCardTitle}>
                ¿Cómo es el entrenamiento?
              </h3>
              <ul className={styles.infoCardList}>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>⏰</span>
                  <span className={styles.infoCardText}>3 meses de entrenamiento intensivo</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>💻</span>
                  <span className={styles.infoCardText}>Clases semanales y en vivo 100% online</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>🔍</span>
                  <span className={styles.infoCardText}>Espacio para análisis de dudas y evolución</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>📂</span>
                  <span className={styles.infoCardText}>Material descargable y herramientas útiles</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>👥</span>
                  <span className={styles.infoCardText}>Grupo chico y con seguimiento constante</span>
                </li>
              </ul>
            </motion.div>
          </div>
        </section>



        {/* Roadmap Section */}
        <section className={styles.roadmapSection}>
          <div className={styles.container}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {loadingRoadmap ? (
                <div className={styles.loadingContainer}>
                  <Loader size={40} className={styles.loadingSpinner} />
                  <p>Cargando roadmap de aprendizaje...</p>
                </div>
              ) : roadmapError ? (
                <div className={styles.errorContainer}>
                  <p className={styles.errorMessage}>{roadmapError}</p>
                </div>
              ) : roadmapModules.length > 0 ? (
                <TrainingRoadmap
                  modules={roadmapModules}
                  onModuleClick={handleModuleClick}
                  title="Roadmap de Day Trading"
                  description="Progresión estructurada diseñada para llevarte de principiante a day trader avanzado"
                />
              ) : (
                <div className={styles.emptyContainer}>
                  <p>No hay módulos disponibles en este momento.</p>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Calendar Section */}
        <section className={styles.calendarSection}>
          <div className={styles.container}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className={styles.calendarTitle}>Próximas Clases en Vivo</h2>
              <p className={styles.calendarDescription}>
                Únete a nuestras sesiones en vivo para resolver dudas y practicar en tiempo real
              </p>
              
              <ClassCalendar 
                events={trainingDatesState}
                onDateSelect={handleCalendarDateSelect}
                isAdmin={isAdmin}
              />
            </motion.div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className={styles.testimonialsSection}>
          <div className={styles.container}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <h2 className={styles.testimonialsTitle}>Lo que dicen nuestros estudiantes</h2>
              <p className={styles.testimonialsDescription}>
                Resultados reales de traders que transformaron su futuro financiero
              </p>
              
              <div className={styles.testimonialsCarousel}>
                <button 
                  onClick={prevTestimonial}
                  className={styles.carouselArrow}
                  aria-label="Testimonio anterior"
                >
                  <ChevronLeft size={24} />
                </button>

                <div className={styles.testimonialCard}>
                  <div className={styles.testimonialAvatar}>
                    <div 
                      className={styles.avatarCircle}
                      style={{ backgroundColor: carouselTestimonials[currentTestimonialIndex].backgroundColor }}
                    >
                      {carouselTestimonials[currentTestimonialIndex].initial}
                    </div>
                  </div>
                  <div className={styles.testimonialContent}>
                    <p className={styles.testimonialText}>
                      {carouselTestimonials[currentTestimonialIndex].text}
                    </p>
                    <h4 className={styles.testimonialName}>
                      {carouselTestimonials[currentTestimonialIndex].name}
                    </h4>
                  </div>
                </div>

                <button 
                  onClick={nextTestimonial}
                  className={styles.carouselArrow}
                  aria-label="Siguiente testimonio"
                >
                  <ChevronRight size={24} />
                </button>
              </div>

              <div className={styles.carouselIndicators}>
                {carouselTestimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonialIndex(index)}
                    className={`${styles.indicator} ${
                      index === currentTestimonialIndex ? styles.indicatorActive : ''
                    }`}
                    aria-label={`Ver testimonio ${index + 1}`}
                  />
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className={styles.faqSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.sectionHeader}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.sectionTitle}>Preguntas Frecuentes</h2>
              <p className={styles.sectionDescription}>
                Resolvemos las dudas más comunes sobre el programa de Day Trading
              </p>
            </motion.div>

            <SwingTradingFAQ />
          </div>
        </section>

        {/* Final CTA Section */}
        <section className={styles.finalCtaSection}>
          <div className={styles.container}>
            <motion.div 
              className={styles.ctaContent}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className={styles.ctaTitle}>
                ¿Listo para llevar tus inversiones al siguiente nivel?
              </h2>
              <p className={styles.ctaDescription}>
                Únete a nuestra comunidad y comienza a construir tu libertad financiera
              </p>
              
              <div className={styles.ctaActions}>
                <button 
                  onClick={handleEnroll}
                  className={styles.ctaButton}
                  disabled={checkingEnrollment || isProcessingPayment}
                >
                  {isProcessingPayment ? (
                    <>
                      <Loader size={20} className={styles.spinner} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      Inscribirme ahora &gt;
                    </>
                  )}
                </button>
                
                {/* Se removió el bloque de precio a pedido del usuario */}
              </div>
            </motion.div>
          </div>
        </section>

        {/* YouTube Community Section */}
        <section className={styles.youtubeSection}>
          <div className={styles.container}>
            <div className={styles.youtubeContent}>
              <div className={styles.youtubeText}>
                <h2 className={styles.youtubeTitle}>¡Sumate a nuestra comunidad en YouTube!</h2>
                <p className={styles.youtubeDescription}>No te pierdas nuestros últimos videos</p>
              </div>
              
              <div className={styles.youtubeVideo}>
                <div className={styles.videoPlayer}>
                  <div className={styles.videoThumbnail}>
                    <div className={styles.playButton}>
                      <PlayCircle size={60} />
                    </div>
                  </div>
                  <div className={styles.videoInfo}>
                    <div className={styles.videoHeader}>
                      <div className={styles.channelIcon}>N</div>
                      <div className={styles.videoTitle}>Cómo Comprar Acciones desde...</div>
                      <div className={styles.videoOptions}>
                        <span>Ver más ta...</span>
                        <span>Compartir</span>
                      </div>
                    </div>
                    <div className={styles.videoFooter}>
                      <span>Mirar en</span>
                      <div className={styles.youtubeLogo}>YouTube</div>
                    </div>
                  </div>
                </div>
                
                <div className={styles.videoNavigation}>
                  <button className={styles.navButton}>
                    <ChevronLeft size={24} />
                  </button>
                  <button className={styles.navButton}>
                    <ChevronRight size={24} />
                  </button>
                </div>
                
                <div className={styles.videoIndicators}>
                  <div className={styles.indicator}></div>
                  <div className={styles.indicator}></div>
                  <div className={styles.indicator}></div>
                  <div className={styles.indicator}></div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Obtener datos del entrenamiento desde la API
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/entrenamientos/DayTrading`);
    
    if (!response.ok) {
      throw new Error('Error fetching training data');
    }
    
    const data = await response.json();
    
    // Obtener roadmap
    const roadmapResponse = await fetch(`${baseUrl}/api/roadmaps/tipo/DayTrading`);
    let roadmap = [];
    if (roadmapResponse.ok) {
      const roadmapData = await roadmapResponse.json();
      roadmap = roadmapData.data || [];
    }

    // Obtener fechas de entrenamientos
    const datesResponse = await fetch(`${baseUrl}/api/training-dates/DayTrading`);
    let trainingDates = [];
    if (datesResponse.ok) {
      const datesData = await datesResponse.json();
      trainingDates = datesData.data || [];
    }
    
    return {
      props: {
        training: data.data.training,
        program: data.data.program,
        testimonials: data.data.testimonials,
        roadmap,
        trainingDates
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    
    // Datos de fallback en caso de error
    return {
      props: {
        training: {
          tipo: 'DayTrading',
          nombre: 'Day Trading - Estrategias Avanzadas',
          descripcion: 'Domina el arte del Day Trading con estrategias profesionales y técnicas avanzadas de trading intradía.',
          precio: 997,
          duracion: 45,
          metricas: {
            rentabilidad: '250%',
            estudiantesActivos: '500',
            entrenamientosRealizados: '150',
            satisfaccion: '4.9'
          },
          contenido: {
            modulos: 12,
            lecciones: 85,
            certificacion: true,
            nivelAcceso: 'Avanzado'
          }
        },
        program: [
          {
            module: 1,
            title: "Fundamentos del Day Trading",
            duration: "4 horas",
            lessons: 12,
            topics: ["Conceptos básicos", "Mercados y horarios", "Plataformas de trading", "Tipos de órdenes"],
            description: "Establece las bases sólidas para tu carrera como day trader"
          },
          {
            module: 2,
            title: "Análisis Técnico Avanzado",
            duration: "5 horas",
            lessons: 15,
            topics: ["Patrones de velas", "Soportes y resistencias", "Indicadores técnicos", "Volume profile"],
            description: "Domina las herramientas de análisis técnico más efectivas"
          },
          {
            module: 3,
            title: "Gestión de Riesgo",
            duration: "3 horas",
            lessons: 10,
            topics: ["Position sizing", "Stop loss", "Risk/reward ratio", "Drawdown management"],
            description: "Protege tu capital con estrategias profesionales de gestión de riesgo"
          }
        ],
        testimonials: [
          {
            name: "Carlos Mendoza",
            role: "Day Trader Profesional",
            content: "Gracias al programa de Day Trading pude dejar mi trabajo y dedicarme completamente al trading. Los resultados han sido increíbles.",
            rating: 5,
            image: "",
            results: "+180% en 6 meses"
          }
        ],
        roadmap: [],
        trainingDates: []
      }
    };
  }
};

export default DayTradingPage;
