import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getGlobalTimezone } from '@/lib/timeConfig';
import { toast } from 'react-hot-toast';
import { generateCircularAvatarDataURL } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Carousel from '@/components/Carousel';
import TrainingRoadmap from '@/components/TrainingRoadmap';
import SwingTradingMonthlyCalendar from '@/components/swing-trading/SwingTradingMonthlyCalendar';
import SwingTradingFAQ from '@/components/SwingTradingFAQ';
import BackgroundVideo from '@/components/BackgroundVideo';
import MonthlyTrainingSelector from '@/components/MonthlyTrainingSelector';
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
import YouTubePlayer from '@/components/YouTubePlayer';

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
  siteConfig?: {
    trainingVideos?: {
      swingTrading?: {
        heroVideo?: {
          youtubeId: string;
          title?: string;
          autoplay?: boolean;
          muted?: boolean;
          loop?: boolean;
        };
      };
    };
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

interface MonthlyTraining {
  _id: string;
  title: string;
  description: string;
  month: number;
  year: number;
  price: number;
  maxStudents: number;
  status: string;
  classes: Array<{
    _id: string;
    date: string;
    startTime: string;
    title: string;
    status: string;
  }>;
  students: Array<{
    userId: string;
    email: string;
    paymentStatus: string;
    enrolledAt: string;
  }>;
}

interface TrainingDate {
  id: string;
  date: Date;
  time: string;
  title: string;
  isActive: boolean;
  createdBy: string;
}

interface TradingPageProps {
  training: TrainingData;
  program: ProgramModule[];
  testimonials: Testimonial[];
  swingHeroVideo?: {
    youtubeId?: string;
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
  };
  siteTimezone?: string;
}

const SwingTradingPage: React.FC<TradingPageProps> = ({ 
  training,
  program, 
  testimonials,
  swingHeroVideo,
  siteTimezone = 'America/Montevideo'
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
  const [startDateText, setStartDateText] = useState('11 de octubre a las 13 hs');
  const [monthlyTrainings, setMonthlyTrainings] = useState<MonthlyTraining[]>([]);
  
  // Estados para gestión de fechas de entrenamiento
  const [trainingDates, setTrainingDates] = useState<TrainingDate[]>([]);
  const [nextTrainingDate, setNextTrainingDate] = useState<TrainingDate | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Estados de reserva y creación de fechas
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [selectedDateId, setSelectedDateId] = useState<string | null>(null);
  const [showReserveModal, setShowReserveModal] = useState(false);
  const [reserveTarget, setReserveTarget] = useState<TrainingDate | null>(null);
  const [showCreateDateModal, setShowCreateDateModal] = useState(false);
  const [newDateDraft, setNewDateDraft] = useState<{ date: Date | null; time: string; title: string }>({ date: null, time: '13:00', title: '' });

  // Modal de reserva
  const openReserveModal = () => {
    if (!selectedDateId) {
      toast.error('Seleccioná una fecha para reservar');
      return;
    }
    const td = trainingDates.find(d => d.id === selectedDateId) || (trainingDates as any).find((d: any) => d._id === selectedDateId);
    if (!td) {
      toast.error('Fecha no encontrada');
      return;
    }
    setReserveTarget(td as any);
    setShowReserveModal(true);
  };

  const confirmReserve = async () => {
    if (!reserveTarget) return;
    try {
      const [hh, mm] = (reserveTarget.time || '00:00').split(':').map((n: string) => parseInt(n, 10));
      const start = new Date(reserveTarget.date);
      start.setHours(hh || 0, mm || 0, 0, 0);
      const res = await fetch('/api/entrenamientos/reservar-sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startDate: start.toISOString(), duration: 120, serviceType: 'SwingTrading' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo reservar');
      toast.success('Reserva confirmada');
      setShowReserveModal(false);
      await checkEnrollmentStatus();
    } catch (e: any) {
      toast.error(e.message || 'Error al reservar');
    }
  };

  const handleReserve = () => openReserveModal();

  // Estados para el carrusel de testimonios
  const [currentTestimonialIndex, setCurrentTestimonialIndex] = useState(0);
  const carouselTestimonials = [
    {
      initial: 'C',
      name: 'Carlos Mendoza',
      text: '"Las alertas de Nahuel me han ayudado a incrementar mi cuenta un 25% en los últimos 6 meses."',
      backgroundColor: '#6366f1'
    },
    {
      initial: 'A', 
      name: 'Ana Laura Quiroga',
      text: '"Los cursos de análisis técnico son realmente muy buenos y didácticos. 100% recomendables!"',
      backgroundColor: '#ef4444'
    },
    {
      initial: 'T',
      name: 'Tamara Rodriguez', 
      text: '"Las recomendaciones que brindan en las asesorías a 1 a 1 son muy buenas. Estoy muy conforme"',
      backgroundColor: '#22c55e'
    },
    {
      initial: 'M',
      name: 'María González',
      text: '"Excelente servicio de trading. Las señales son muy precisas y me han ayudado mucho en mis inversiones."',
      backgroundColor: '#f59e0b'
    },
    {
      initial: 'R',
      name: 'Roberto Silva',
      text: '"Los webinars son increíbles, aprendí mucho sobre análisis técnico. Muy recomendado para principiantes."',
      backgroundColor: '#8b5cf6'
    },
    {
      initial: 'L',
      name: 'Laura Martínez',
      text: '"El soporte al cliente es excepcional. Siempre responden rápido y con mucha paciencia a mis dudas."',
      backgroundColor: '#06b6d4'
    }
  ];

  // Estados para gestión de meeting link de la próxima clase
  const [nextMeetingLink, setNextMeetingLink] = useState<string | null>(null);
  const [nextMeetingStart, setNextMeetingStart] = useState<Date | null>(null);
  
  // Estados para suscripción mensual
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>();
  const [selectedYear, setSelectedYear] = useState<number | undefined>();
  const [monthlyAccess, setMonthlyAccess] = useState<any>(null);
  const [checkingMonthlyAccess, setCheckingMonthlyAccess] = useState(false);

  // Función para cargar entrenamientos mensuales
  const loadMonthlyTrainings = async () => {
    try {
      const response = await fetch('/api/monthly-trainings');
      const data = await response.json();
      
      if (data.success) {
        setMonthlyTrainings(data.data);
      }
    } catch (error) {
      console.error('Error cargando entrenamientos mensuales:', error);
    }
  };

  // Función para verificar acceso mensual
  const checkMonthlyAccess = async () => {
    if (!session?.user?.email) return;
    
    setCheckingMonthlyAccess(true);
    try {
      const response = await fetch('/api/monthly-training-subscriptions/verify-access?trainingType=SwingTrading');
      if (response.ok) {
        const data = await response.json();
        setMonthlyAccess(data);
      }
    } catch (error) {
      console.error('Error checking monthly access:', error);
    } finally {
      setCheckingMonthlyAccess(false);
    }
  };

  // Función para manejar selección de mes
  const handleMonthSelect = (month: number, year: number) => {
    setSelectedMonth(month);
    setSelectedYear(year);
  };

  // Función para calcular el countdown basado en la próxima clase de entrenamientos mensuales
  // Considera clases con status 'scheduled' o sin status (clase creada aunque vacía); excluye solo 'cancelled'
  const calculateCountdownFromTrainings = () => {
    if (monthlyTrainings.length === 0) return { days: 0, hours: 0, minutes: 0 };

    let nextClass = null;
    const now = new Date();

    for (const training of monthlyTrainings) {
      if (!training.classes || training.classes.length === 0) continue;
      for (const classItem of training.classes) {
        if (classItem.status === 'cancelled') continue;
        const classDate = new Date(classItem.date);
        if (classDate > now) {
          if (!nextClass || classDate < nextClass.date) {
            nextClass = {
              date: classDate,
              title: classItem.title,
              training: training.title
            };
          }
        }
      }
    }

    if (nextClass) {
      const timeDiff = nextClass.date.getTime() - now.getTime();
      const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

      return { days, hours, minutes };
    } else {
      return { days: 0, hours: 0, minutes: 0 };
    }
  };

  // Función para calcular el countdown basado en la fecha de inicio (fallback)
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
    loadMonthlyTrainings(); // Cargar entrenamientos mensuales
    checkMonthlyAccess(); // Verificar acceso mensual
    
    // Verificar si el usuario es admin
    if (session?.user) {
      setIsAdmin(session.user.role === 'admin');
    }
  }, [session]);

  // Countdown timer dinámico basado en entrenamientos mensuales
  useEffect(() => {
    let currentNextClass: { date: Date; title: string; training: string } | null = null;
    
    const updateCountdown = () => {
      // Priorizar entrenamientos mensuales
      if (monthlyTrainings.length > 0) {
        // Encontrar la primera clase disponible (futura o la más próxima)
        let firstClass = null;
        let nextClass = null;
        const now = new Date();

        for (const training of monthlyTrainings) {
          if (!training.classes || training.classes.length === 0) continue;
          for (const classItem of training.classes) {
            if (classItem.status === 'cancelled') continue;
            const classDate = new Date(classItem.date);
            if (!firstClass || classDate < firstClass.date) {
              firstClass = { date: classDate, title: classItem.title, training: training.title };
            }
            if (classDate > now) {
              if (!nextClass || classDate < nextClass.date) {
                nextClass = { date: classDate, title: classItem.title, training: training.title };
              }
            }
          }
        }

        const classToShow = nextClass || firstClass;

        if (classToShow) {
          // Solo actualizar si la clase cambió o es la primera vez
          if (!currentNextClass || currentNextClass.date.getTime() !== classToShow.date.getTime()) {
            currentNextClass = classToShow;
            
            // Si hay una clase futura, calcular countdown, sino mostrar solo la fecha
            if (nextClass) {
              const newCountdown = calculateCountdownFromTrainings();
              setCountdown(newCountdown);
            } else {
              setCountdown({ days: 0, hours: 0, minutes: 0 });
            }
            
            const formattedDate = classToShow.date.toLocaleDateString('es-ES', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: siteTimezone
            });
            const formattedTime = classToShow.date.toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: siteTimezone
            });
            setStartDateText(`${formattedDate} a las ${formattedTime} hs`);
          } else if (nextClass) {
            // Solo actualizar el countdown si hay una clase futura
            const newCountdown = calculateCountdownFromTrainings();
            setCountdown(newCountdown);
          }
        } else if (nextTrainingDate) {
          const newCountdown = calculateCountdown(nextTrainingDate.date, nextTrainingDate.time);
          setCountdown(newCountdown);
          const formattedDate = nextTrainingDate.date.toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: siteTimezone
          });
          setStartDateText(`${formattedDate} a las ${nextTrainingDate.time} hs`);
        } else if (monthlyTrainings.length > 0) {
          // Hay entrenamientos creados pero sin clases: usar mes/año del primer entrenamiento
          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const future = monthlyTrainings
            .filter((t: any) => t.year > now.getFullYear() || (t.year === now.getFullYear() && t.month >= now.getMonth() + 1))
            .sort((a: any, b: any) => a.year !== b.year ? a.year - b.year : a.month - b.month)[0];
          if (future) {
            setStartDateText(`${monthNames[future.month - 1]} ${future.year} - Por confirmar`);
          } else {
            const first = monthlyTrainings[0];
            setStartDateText(`${monthNames[first.month - 1]} ${first.year} - Por confirmar`);
          }
        } else {
          setStartDateText('Próximamente - Fechas por confirmar');
        }
      } else if (nextTrainingDate) {
        // Fallback a fechas de entrenamiento tradicionales
        const newCountdown = calculateCountdown(nextTrainingDate.date, nextTrainingDate.time);
        setCountdown(newCountdown);
        
        const formattedDate = nextTrainingDate.date.toLocaleDateString('es-ES', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: siteTimezone
        });
        setStartDateText(`${formattedDate} a las ${nextTrainingDate.time} hs`);
      } else if (!currentNextClass) {
        // Solo mostrar "Fechas por confirmar" si nunca se encontró una fecha
        setStartDateText('Próximamente - Fechas por confirmar');
      }
    };

    // Actualizar countdown inicial
    updateCountdown();

    // Actualizar cada minuto
    const timer = setInterval(updateCountdown, 60000);

    return () => clearInterval(timer);
  }, [monthlyTrainings, nextTrainingDate, siteTimezone]);

  // Efecto para actualizar la próxima fecha cuando pasa el tiempo
  useEffect(() => {
    const checkForNextDate = () => {
      const nextDate = findNextTrainingDate(trainingDates);
      if (nextDate !== nextTrainingDate) {
        setNextTrainingDate(nextDate);
      }
    };

    // Verificar cada hora si hay que actualizar la próxima fecha
    const timer = setInterval(checkForNextDate, 3600000); // 1 hora

    return () => clearInterval(timer);
  }, [trainingDates, nextTrainingDate]);

  const fetchRoadmaps = async () => {
    try {
      setLoadingRoadmap(true);
      setRoadmapError('');
      
      const response = await fetch('/api/roadmaps/tipo/SwingTrading');
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
          setRoadmapError('No se encontró un roadmap activo para Zero 2 Trader');
        }
      } else {
        setRoadmapError('No se encontraron roadmaps para Zero 2 Trader');
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
        const hasSwingTrading = data.data.tiposDisponibles.includes('SwingTrading');
        setIsEnrolled(hasSwingTrading);
        
        // Si está inscrito, buscar su próxima reserva con link de Meet
        if (hasSwingTrading) {
          try {
            const bookingsRes = await fetch('/api/bookings');
            if (bookingsRes.ok) {
              const bookingsData = await bookingsRes.json();
              const now = Date.now();
              const upcoming = (bookingsData.bookings || [])
                .filter((b: any) => b.type === 'training' && (b.serviceType === 'SwingTrading' || b.serviceType === 'swingtrading'))
                .map((b: any) => ({ ...b, start: new Date(b.startDate).getTime() }))
                .filter((b: any) => b.start > now)
                .sort((a: any, b: any) => a.start - b.start)[0];
              if (upcoming) {
                setNextMeetingLink(upcoming.meetingLink || null);
                setNextMeetingStart(new Date(upcoming.startDate));
              } else {
                setNextMeetingLink(null);
                setNextMeetingStart(null);
              }
            }
          } catch (err) {
            console.error('Error obteniendo próximas reservas:', err);
          }
        } else {
          setNextMeetingLink(null);
          setNextMeetingStart(null);
        }
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

  // Función auxiliar para obtener el inicio de la semana (domingo)
  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  };

  // Función para cargar fechas de entrenamiento (simplificada)
  const loadTrainingDates = async () => {
    try {
      // console.log('📅 Cargando fechas específicas de Zero 2 Trader...');
      
      const response = await fetch('/api/training-dates/SwingTrading');
      const data = await response.json();
      
      if (data.success && data.dates) {
        const dates = data.dates.map((date: any) => ({
          ...date,
          date: new Date(date.date)
        }));
        
        // console.log('✅ Fechas cargadas:', dates.length);
        
        setTrainingDates(dates);
        const nextDate = findNextTrainingDate(dates);
        setNextTrainingDate(nextDate);
        
        // Solo actualizar el texto de fecha si no hay entrenamientos mensuales con clases
        // (los entrenamientos mensuales tienen prioridad)
        const hasMonthlyTrainingClasses = monthlyTrainings.some(
          training => training.classes && training.classes.length > 0 && 
          training.classes.some(c => c.status === 'scheduled')
        );
        
        if (!hasMonthlyTrainingClasses) {
          if (nextDate) {
            const dateOptions: Intl.DateTimeFormatOptions = { 
              day: 'numeric', 
              month: 'long',
              year: 'numeric',
              timeZone: siteTimezone
            };
            const formattedDate = nextDate.date.toLocaleDateString('es-ES', dateOptions);
            setStartDateText(`${formattedDate} a las ${nextDate.time} hs`);
          } else {
            setStartDateText('Próximamente - Fechas por confirmar');
          }
        }
      } else {
        // console.log('📭 No hay fechas específicas configuradas');
        setTrainingDates([]);
        setNextTrainingDate(null);
        
        // Solo actualizar si no hay entrenamientos mensuales con clases
        const hasMonthlyTrainingClasses = monthlyTrainings.some(
          training => training.classes && training.classes.length > 0 && 
          training.classes.some(c => c.status === 'scheduled')
        );
        
        if (!hasMonthlyTrainingClasses) {
          setStartDateText('Próximamente - Fechas por confirmar');
        }
      }
      
    } catch (error) {
      console.error('❌ Error cargando fechas:', error);
      setTrainingDates([]);
      setNextTrainingDate(null);
      
      // Solo actualizar si no hay entrenamientos mensuales con clases
      const hasMonthlyTrainingClasses = monthlyTrainings.some(
        training => training.classes && training.classes.length > 0 && 
        training.classes.some(c => c.status === 'scheduled')
      );
      
      if (!hasMonthlyTrainingClasses) {
        setStartDateText('Próximamente - Fechas por confirmar');
      }
    }
  };

  // Función para que el admin agregue una nueva fecha
  const handleAddTrainingDate = async (date: Date, time: string, title: string) => {
    if (!isAdmin) return;

    const newDate: TrainingDate = {
      id: `training-${Date.now()}`,
      date,
      time,
      title,
      isActive: true,
      createdBy: session?.user?.email || 'admin'
    };

    try {
      const response = await fetch('/api/training-dates/SwingTrading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newDate.date,
          time: newDate.time,
          title: newDate.title
        })
      });

      if (response.ok) {
        const updatedDates = [...trainingDates, newDate];
        setTrainingDates(updatedDates);
        
        const nextDate = findNextTrainingDate(updatedDates);
        setNextTrainingDate(nextDate);
        
        toast.success('Fecha de entrenamiento agregada exitosamente');
      }
    } catch (error) {
      console.error('Error adding training date:', error);
      toast.error('Error al agregar la fecha');
    }
  };

  // Reemplazar prompts por modal único para admin
  const handleCalendarDateSelect = (selectedDate: Date, existingEvents: any[]) => {
    if (!isAdmin) return;
    setNewDateDraft({ date: selectedDate, time: '13:00', title: `Clase ${trainingDates.length + 1}` });
    setShowCreateDateModal(true);
  };

  const handleEnroll = async () => {
    if (!session) {
      toast.error('Debes iniciar sesión primero para inscribirte');
      signIn('google');
      return;
    }
    
    // Verificar si ya tiene acceso mensual activo
    if (monthlyAccess?.hasAccess) {
      toast.success('Ya tienes acceso activo al entrenamiento mensual');
      return;
    }
    
    if (isEnrolled) {
      // Si ya está inscrito y hay link de reunión, ir al Meet
      if (nextMeetingLink) {
        window.open(nextMeetingLink, '_blank');
        return;
      }
      // Fallback: permanecer en la página para reservar un horario
      toast('Aún no tienes una clase programada. Elige un horario disponible.');
      return;
    }
    
    // Verificar que se haya seleccionado un mes
    if (!selectedMonth || !selectedYear) {
      toast.error('Por favor selecciona un mes para tu suscripción');
      return;
    }
    
    setIsProcessingPayment(true);
    try {
      // Usar el nuevo sistema de suscripciones mensuales
      const response = await fetch('/api/monthly-training-subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingType: 'SwingTrading',
          subscriptionMonth: selectedMonth,
          subscriptionYear: selectedYear
        })
      });
      
      const data = await response.json();
      
      if (data.success && (data.checkoutUrl || data.sandboxInitPoint)) {
        window.location.href = data.checkoutUrl || data.sandboxInitPoint;
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
          tipo: 'SwingTrading',
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
            window.location.href = '/entrenamientos/zero2trader/lecciones';
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

  // Funciones para el carrusel de testimonios
  const testimoniosPerGroup = 3;
  const totalTestimonialGroups = Math.ceil(carouselTestimonials.length / testimoniosPerGroup);

  const nextTestimonial = () => {
    setCurrentTestimonialIndex((prev) => 
      prev === totalTestimonialGroups - 1 ? 0 : prev + 1
    );
  };

  const prevTestimonial = () => {
    setCurrentTestimonialIndex((prev) => 
      prev === 0 ? totalTestimonialGroups - 1 : prev - 1
    );
  };

  // Sin auto-play - solo navegación manual

  return (
    <>
      <Head>
        <title>Zero 2 Trader - Entrenamiento Completo | Nahuel Lozano</title>
        <meta name="description" content="Experiencia de aprendizaje premium, personalizada y con acompañamiento constante, donde aprenderás a operar movimientos de varios días o semanas, identificando oportunidades con análisis técnico y estrategias que combinan precisión y paciencia" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />
      
      <main className={styles.main}>
        {/* Hero Section con Video Explicativo */}
        <section className={styles.heroSection}>
          <BackgroundVideo 
            videoSrc="/logos/Diseño Web-LozanoNahuel-Entrenamientos-SwingTrading.mp4"
            autoPlay={true}
            muted={true}
            loop={true}
            showControls={false}
            className={styles.backgroundVideo}
          />
          <div className={styles.heroOverlay}></div>
          <motion.div 
            className={styles.heroContent}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
              <div className={styles.heroText}>
                <h1 className={styles.heroTitle}>
                  Zero 2 Trader
                </h1>
                <p className={styles.heroDescription}>
                  Experiencia de entrenamiento integral para llevarte de cero a operar con independencia total. Aprendés a analizar el mercado como un profesional, aplicás una estrategia de trading probada y operás en un entorno real con acompañamiento en cada paso.
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
                
                
                {/* Mostrar estado de acceso mensual */}
                {monthlyAccess?.hasAccess && (
                  <div className={styles.accessStatus}>
                    <div className={styles.accessBadge}>
                      <CheckCircle size={20} />
                      <span>Acceso Activo: {monthlyAccess.subscription?.monthName} {monthlyAccess.subscription?.subscriptionYear}</span>
                    </div>
                    <p className={styles.accessInfo}>
                      Tienes acceso completo al entrenamiento durante {monthlyAccess.subscription?.daysRemaining} días más.
                    </p>
                  </div>
                )}
                
                <button 
                  onClick={() => {
                    // Hacer scroll a la sección del calendario
                    const calendarSection = document.querySelector(`.${styles.calendarSection}`);
                    if (calendarSection) {
                      calendarSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={styles.enrollButton}
                  disabled={checkingEnrollment || isProcessingPayment}
                >
                  Inscribirme ahora &gt;
                </button>
              </div>
              <div className={styles.heroVideo}>
                <div className={styles.videoContainer}>
                  <YouTubePlayer
                    videoId={swingHeroVideo?.youtubeId || "dQw4w9WgXcQ"}
                    title={swingHeroVideo?.title || "Zero 2 Trader - Introducción"}
                    autoplay={swingHeroVideo?.autoplay || false}
                    muted={swingHeroVideo?.muted !== undefined ? swingHeroVideo.muted : true}
                    loop={swingHeroVideo?.loop || false}
                    fillContainer={true}
                  />
                </div>
              </div>
            </motion.div>
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
                  <span className={styles.infoCardText}>Necesitás una estrategia efectiva</span>
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
                  <span className={styles.infoCardText}>Transforma la teoría en resultados</span>
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
                  <span className={styles.infoCardText}>Para quienes ya saben análisis técnico</span>
                </li>
                <li className={styles.infoCardItem}>
                  <span className={styles.infoCardIcon}>✅</span>
                  <span className={styles.infoCardText}>Traders que buscan resultados sostenibles</span>
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
                  <span className={styles.infoCardText}>1 mes de entrenamiento intensivo</span>
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
                  title="Roadmap de Zero 2 Trader"
                  description="Progresión estructurada diseñada para llevarte de cero a operar con independencia total"
                />
              ) : (
                <div className={styles.noRoadmapContainer}>
                  <p>No hay roadmap disponible para este entrenamiento.</p>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Formulario de Inscripción Modal */}
        {showEnrollForm && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContainer}>
              <div className={styles.modalHeader}>
                <h3>Inscripción a Zero 2 Trader</h3>
                <button 
                  onClick={() => setShowEnrollForm(false)}
                  className={styles.closeButton}
                >
                  ×
                </button>
              </div>
              
              <form onSubmit={handleSubmitEnrollment} className={styles.enrollForm}>
                <div className={styles.formGroup}>
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Nivel de experiencia en trading</label>
                  <select
                    value={formData.nivelExperiencia}
                    onChange={(e) => setFormData({...formData, nivelExperiencia: e.target.value})}
                  >
                    <option value="principiante">Principiante</option>
                    <option value="intermedio">Intermedio</option>
                    <option value="avanzado">Avanzado</option>
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>¿Cuáles son tus objetivos con el trading?</label>
                  <textarea
                    value={formData.objetivos}
                    onChange={(e) => setFormData({...formData, objetivos: e.target.value})}
                    placeholder="Describe qué esperas lograr con este entrenamiento..."
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Experiencia previa (opcional)</label>
                  <textarea
                    value={formData.experienciaTrading}
                    onChange={(e) => setFormData({...formData, experienciaTrading: e.target.value})}
                    placeholder="Cuéntanos sobre tu experiencia previa en trading..."
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Consulta adicional (opcional)</label>
                  <textarea
                    value={formData.consulta}
                    onChange={(e) => setFormData({...formData, consulta: e.target.value})}
                    placeholder="¿Tienes alguna pregunta específica?"
                  />
                </div>
                
                <div className={styles.formActions}>
                  <button 
                    type="button" 
                    onClick={() => setShowEnrollForm(false)}
                    className={styles.cancelButton}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isEnrolling}
                    className={styles.submitButton}
                  >
                    {isEnrolling ? 'Enviando...' : 'Enviar Solicitud'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Números con Datos Actualizables */}
        <section className={styles.metricsSection}>
          <div className={styles.container}>
            <motion.h2 
              className={styles.sectionTitle}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              Números que Respaldan la Calidad
            </motion.h2>
            
            <div className={styles.metricsGrid}>
              <motion.div 
                className={styles.metricCard}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
              >
                <div className={styles.metricIcon}>
                  <Users size={40} />
                </div>
                <h3 className={styles.metricNumber}>{training.metricas.estudiantesActivos}</h3>
                <p className={styles.metricLabel}>Estudiantes Formados</p>
              </motion.div>

              <motion.div 
                className={styles.metricCard}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
              >
                <div className={styles.metricIcon}>
                  <Target size={40} />
                </div>
                <h3 className={styles.metricNumber}>{training.metricas.rentabilidad}</h3>
                <p className={styles.metricLabel}>Rentabilidad Promedio</p>
              </motion.div>

              <motion.div 
                className={styles.metricCard}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
              >
                <div className={styles.metricIcon}>
                  <Star size={40} />
                </div>
                <h3 className={styles.metricNumber}>{training.metricas.satisfaccion}/5</h3>
                <p className={styles.metricLabel}>Satisfacción Promedio</p>
              </motion.div>

              <motion.div 
                className={styles.metricCard}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
              >
                <div className={styles.metricIcon}>
                  <Award size={40} />
                </div>
                <h3 className={styles.metricNumber}>{training.metricas.entrenamientosRealizados}</h3>
                <p className={styles.metricLabel}>Entrenamientos Realizados</p>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Roadmap de Aprendizaje - Visible solo para admin */}
        <section className={styles.roadmapSection} style={{ display: isAdmin ? 'block' : 'none' }}>
          <div className={styles.container}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {loadingRoadmap ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <Loader size={48} className="spinning" style={{ margin: '0 auto 1rem', color: '#3b82f6' }} />
                  <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>Cargando roadmap de aprendizaje...</p>
                </div>
              ) : roadmapError ? (
                <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <h3 style={{ color: '#dc2626', marginBottom: '1rem' }}>Error al cargar roadmap</h3>
                  <p style={{ color: '#6b7280', marginBottom: '2rem' }}>{roadmapError}</p>
                  <button 
                    onClick={fetchRoadmaps}
                    style={{ 
                      padding: '0.75rem 1.5rem', 
                      background: '#3b82f6', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '0.5rem',
                      cursor: 'pointer'
                    }}
                  >
                    Reintentar
                  </button>
                </div>
              ) : roadmapModules.length > 0 ? (
                <TrainingRoadmap
                  modules={roadmapModules}
                  onModuleClick={handleModuleClick}
                  title="Roadmap de Zero 2 Trader"
                  description="Progresión estructurada desde principiante hasta trader competente"
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                  <p style={{ color: '#6b7280', fontSize: '1.1rem' }}>
                    Roadmap no disponible en este momento
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </section>

        {/* Selector de meses para suscripción mensual */}
        {!monthlyAccess?.hasAccess && !isEnrolled && (
          <section className={styles.monthSelectorSection}>
            <div className={styles.container}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
              >
                <MonthlyTrainingSelector
                  trainingType="SwingTrading"
                  onMonthSelect={handleMonthSelect}
                  selectedMonth={selectedMonth}
                  selectedYear={selectedYear}
                  disabled={isProcessingPayment}
                  onSubscribe={(month, year) => {
                    setSelectedMonth(month);
                    setSelectedYear(year);
                    handleEnroll();
                  }}
                />
              </motion.div>
            </div>
          </section>
        )}

        {/* Calendario de Clases */}
        <section className={styles.calendarSection}>
          <div className={styles.container}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <SwingTradingMonthlyCalendar 
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
              />
            </motion.div>
          </div>
        </section>

        {/* Testimonios */}
        <section className={styles.testimonialsSection}>
          <div className={styles.container}>
            <motion.div
              className={styles.testimonialsCard}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              {/* Título y Contador en la sección de testimonios */}
              <div className={styles.testimonialsHeader}>
                <h2 className={styles.testimonialsTitle}>
                  Zero 2 Trader
                </h2>
                
                <div className={styles.testimonialsDate}>
                  Fecha de inicio: {startDateText}
                </div>
                
                <div className={styles.testimonialsCountdown}>
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
                  onClick={() => {
                    // Hacer scroll a la sección del calendario
                    const calendarSection = document.querySelector(`.${styles.calendarSection}`);
                    if (calendarSection) {
                      calendarSection.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className={styles.testimonialsButton}
                  disabled={checkingEnrollment || isProcessingPayment}
                >
                  Inscribirme Ahora &gt;
                </button>
              </div>

            </motion.div>
            
            {/* Testimonios horizontales con carrusel */}
            <motion.div
              className={styles.testimonialsHorizontalContainer}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <div className={styles.testimonialsCarousel}>
                <button 
                  className={styles.testimonialNavButton}
                  onClick={prevTestimonial}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                <div className={styles.testimonialsSlider}>
                  {carouselTestimonials
                    .slice(currentTestimonialIndex * testimoniosPerGroup, (currentTestimonialIndex + 1) * testimoniosPerGroup)
                    .map((testimonial, index) => (
                    <div key={index} className={styles.testimonialSlide}>
                      <div className={styles.testimonialHorizontalItem}>
                        <div 
                          className={styles.testimonialAvatar} 
                          style={{backgroundColor: testimonial.backgroundColor}}
                        >
                          <span className={styles.testimonialInitial}>{testimonial.initial}</span>
                        </div>
                        <div className={styles.testimonialVerticalInfo}>
                          <h4 className={styles.testimonialName}>{testimonial.name}</h4>
                          <div className={styles.testimonialRating}>
                            {[...Array(4)].map((_, i) => (
                              <Star key={i} size={16} className={styles.testimonialStar} fill="#fbbf24" />
                            ))}
                            <Star key={4} size={16} className={styles.testimonialStarEmpty} fill="none" stroke="#fbbf24" />
                          </div>
                          <p className={styles.testimonialText}>
                            {testimonial.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  className={styles.testimonialNavButton}
                  onClick={nextTestimonial}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ Section */}
        <SwingTradingFAQ />

        {/* CTA Section - Fondo Oscuro */}
        <section className={styles.ctaSection}>
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
                Únete a nuestra comunidad y comienza construir tu libertad financiera
              </p>
              <button 
                onClick={() => {
                  // Hacer scroll a la sección del calendario
                  const calendarSection = document.querySelector(`.${styles.calendarSection}`);
                  if (calendarSection) {
                    calendarSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className={`${styles.ctaButton} ${styles.ctaRed}`}
                disabled={checkingEnrollment}
              >
                {checkingEnrollment ? 'Verificando...' : 'Inscribirme ahora >'}
              </button>
            </motion.div>
          </div>
        </section>

        {/* YouTube Community Section */}
        <section className={styles.youtubeSection}>
          <div className={styles.container}>
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

      {/* Modal confirmación reserva */}
      {showReserveModal && reserveTarget && (
        <div className={styles.modalOverlay} onClick={() => setShowReserveModal(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Confirmar reserva</h3>
              <button className={styles.closeButton} onClick={() => setShowReserveModal(false)}>×</button>
            </div>
            <div className={styles.enrollForm}>
              <p>
                Vas a reservar tu lugar para el {new Date(reserveTarget.date).toLocaleDateString('es-ES')} a las {reserveTarget.time} hs.
              </p>
              <p>Duración: 120 minutos.</p>
              <div className={styles.formActions}>
                <button className={styles.cancelButton} onClick={() => setShowReserveModal(false)}>Cancelar</button>
                <button className={styles.submitButton} onClick={confirmReserve}>Confirmar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal creación de fecha (admin) */}
      {showCreateDateModal && (
        <div className={styles.modalOverlay} onClick={() => setShowCreateDateModal(false)}>
          <div className={styles.modalContainer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Nueva fecha de entrenamiento</h3>
              <button className={styles.closeButton} onClick={() => setShowCreateDateModal(false)}>×</button>
            </div>
            <div className={styles.enrollForm}>
              <div className={styles.formGroup}>
                <label>Fecha</label>
                <input type="date" value={newDateDraft.date ? new Date(newDateDraft.date).toISOString().slice(0,10) : ''} onChange={e => setNewDateDraft(d => ({ ...d, date: e.target.value ? new Date(e.target.value) : null }))} />
              </div>
              <div className={styles.formGroup}>
                <label>Hora (HH:MM)</label>
                <input type="time" value={newDateDraft.time} onChange={e => setNewDateDraft(d => ({ ...d, time: e.target.value }))} />
              </div>
              <div className={styles.formGroup}>
                <label>Título</label>
                <input type="text" value={newDateDraft.title} onChange={e => setNewDateDraft(d => ({ ...d, title: e.target.value }))} />
              </div>
              <div className={styles.formActions}>
                <button className={styles.cancelButton} onClick={() => setShowCreateDateModal(false)}>Cancelar</button>
                <button className={styles.submitButton} onClick={async () => {
                  if (!newDateDraft.date || !newDateDraft.time || !newDateDraft.title) {
                    toast.error('Completá fecha, hora y título');
                    return;
                  }
                  await handleAddTrainingDate(newDateDraft.date, newDateDraft.time, newDateDraft.title);
                  setShowCreateDateModal(false);
                }}>Crear</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

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

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    // Obtener datos del entrenamiento desde la API
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const [trainingRes, siteConfigRes] = await Promise.all([
      fetch(`${baseUrl}/api/entrenamientos/SwingTrading`),
      fetch(`${baseUrl}/api/site-config`)
    ]);
    
    if (!trainingRes.ok) {
      throw new Error('Error fetching training data');
    }
    
    const data = await trainingRes.json();
    const siteConfig = siteConfigRes.ok ? await siteConfigRes.json() : null;

    const swingHeroVideo = siteConfig?.trainingVideos?.swingTrading?.heroVideo || null;
    
    const siteTimezone = getGlobalTimezone();

    return {
      props: {
        training: data.data.training,
        program: data.data.program,
        testimonials: data.data.testimonials,
        swingHeroVideo,
        siteTimezone
      }
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    
    // Datos de fallback en caso de error
    const siteTimezone = getGlobalTimezone();
    return {
      props: {
        training: {
          tipo: 'SwingTrading',
          nombre: 'Zero 2 Trader',
          descripcion: 'Experiencia de entrenamiento integral para llevarte de cero a operar con independencia total. Aprendés a analizar el mercado como un profesional, aplicás una estrategia de trading probada y operás en un entorno real con acompañamiento en cada paso.',
          precio: 10,
          duracion: 40,
          metricas: {
            rentabilidad: '120%',
            estudiantesActivos: '850',
            entrenamientosRealizados: '150',
            satisfaccion: '4.8'
          },
          contenido: {
            modulos: 12,
            lecciones: 85,
            certificacion: true,
            nivelAcceso: 'Básico a Intermedio'
          }
        },
        program: [],
        testimonials: [],
        swingHeroVideo: null,
        siteTimezone
      }
    };
  }
};

export default SwingTradingPage; 