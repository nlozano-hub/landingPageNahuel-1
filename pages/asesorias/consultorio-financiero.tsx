import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { useSession, signIn } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { generateCircularAvatarDataURL } from '@/lib/utils';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Carousel from '@/components/Carousel';
import ComingSoon from '@/components/ComingSoon';
import { motion } from 'framer-motion';
import { 
  CheckCircle,
  ArrowRight,
  Calendar,
  Clock,
  User,
  Star,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  SkipForward,
  Volume2,
  Maximize2,
  Settings
} from 'lucide-react';
import styles from '@/styles/ConsultorioFinanciero.module.css';
import { useBookings } from '@/hooks/useBookings';
import YouTubePlayer from '@/components/YouTubePlayer';
import ClassCalendar from '@/components/ClassCalendar';
import { usePricing } from '@/hooks/usePricing';
import BackgroundVideo from '@/components/BackgroundVideo';

interface Testimonio {
  nombre: string;
  foto: string;
  comentario: string;
  resultado: string;
  rating: number;
}

interface TurnoDisponible {
  fecha: string;
  horarios: string[];
  disponibles: number;
}

interface AdvisoryDate {
  _id: string;
  advisoryType: 'ConsultorioFinanciero';
  date: string;
  time: string;
  title: string;
  description?: string;
  isActive: boolean;
  isBooked: boolean;
  tempReservationTimestamp?: string;
  tempReservationExpiresAt?: string;
  confirmedBooking?: boolean;
  createdBy: string;
  createdAt: string;
}

interface FAQ {
  question: string;
  answer: string;
}

interface ConsultorioPageProps {
  testimonios: Testimonio[];
  faqs: FAQ[];
}

const ConsultorioFinancieroPage: React.FC<ConsultorioPageProps> = ({ 
  testimonios, 
  faqs 
}) => {
  const { data: session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const { createBooking, loading } = useBookings();
  const { pricing, loading: pricingLoading } = usePricing();
  const [proximosTurnos, setProximosTurnos] = useState<TurnoDisponible[]>([]);
  const [advisoryDates, setAdvisoryDates] = useState<AdvisoryDate[]>([]);
  // selectedDate almacenará el día seleccionado en formato YYYY-MM-DD
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showLoginAlert, setShowLoginAlert] = useState(false);
  const [loadingTurnos, setLoadingTurnos] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [reservedSlot, setReservedSlot] = useState<{date: string, time: string} | null>(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    email: '',
    whatsapp: ''
  });

  // Verificar si el usuario es admin
  useEffect(() => {
    if (session?.user?.email) {
      fetch('/api/auth/verify-role')
        .then(res => res.json())
        .then(data => setIsAdmin(data.role === 'admin'))
        .catch(() => setIsAdmin(false));
    } else {
      setIsAdmin(false);
    }
  }, [session]);

  // Cargar fechas específicas de asesoría al montar el componente
  useEffect(() => {
    loadAdvisoryDates();
  }, []);

  // Inicializar datos del formulario con los datos de Google si están disponibles
  useEffect(() => {
    if (session?.user?.name) {
      const nameParts = session.user.name.split(' ');
      setFormData(prev => ({
        ...prev,
        nombre: nameParts[0] || '',
        apellido: nameParts.slice(1).join(' ') || '',
        email: session.user?.email || ''
      }));
    }
  }, [session]);

  // Función para validar si el formulario está completo
  const isFormValid = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const whatsappRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    
    return (
      formData.nombre.trim() !== '' &&
      formData.apellido.trim() !== '' &&
      formData.email.trim() !== '' &&
      emailRegex.test(formData.email.trim()) &&
      formData.whatsapp.trim() !== '' &&
      whatsappRegex.test(formData.whatsapp.trim())
    );
  };

  // Función para manejar cambios en los campos del formulario
  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Convertir fechas de asesoría al formato que espera ClassCalendar
  const calendarEvents = advisoryDates.map(advisoryDate => {
    // La fecha viene como string ISO desde la BD en UTC
    // Necesitamos ajustar la zona horaria para que se muestre correctamente
    const utcDate = new Date(advisoryDate.date);
    
    // Crear fecha en zona horaria local para evitar el desfase
    const localDate = new Date(
      utcDate.getUTCFullYear(),
      utcDate.getUTCMonth(),
      utcDate.getUTCDate(),
      12, // Hora del mediodía para evitar problemas de zona horaria
      0,
      0,
      0
    );
    
    // console.log('📅 Creando evento para calendario:', {
    //   originalDate: advisoryDate.date,
    //   utcDate: utcDate.toISOString(),
    //   localDate: localDate.toISOString(),
    //   title: advisoryDate.title,
    //   time: advisoryDate.time
    // });
    
    return {
      date: localDate,
      time: `${advisoryDate.time}hs`,
      title: advisoryDate.title,
      id: advisoryDate._id
    };
  });

  // Encontrar la fecha más temprana con turnos para posicionar el calendario
  const earliestDate = calendarEvents.length > 0 
    ? new Date(Math.min(...calendarEvents.map(event => event.date.getTime())))
    : new Date();
  
  // console.log('🎯 Fecha más temprana con turnos:', earliestDate);
  // console.log('📅 Fecha actual del calendario:', new Date());

  // Función para manejar la selección de fecha en el calendario
  const handleCalendarDateSelect = (date: Date, events: any[]) => {
    if (events.length > 0) {
      // Crear fecha directamente sin conversiones UTC para evitar desfases
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dayStr = `${year}-${month}-${day}`;
      
      setSelectedDate(dayStr);
      setSelectedTime('');
    }
  };

  // **OPTIMIZACIÓN: Reducir verificación automática a 5 minutos y solo si es necesario**
  useEffect(() => {
    const interval = setInterval(() => {
      // Solo verificar si hay slots seleccionados o si es probable que cambien
      const shouldRefresh = selectedDate && selectedTime;
      if (shouldRefresh && !loading && !loadingTurnos) {
        // console.log('🔄 Verificación automática de disponibilidad (5min)...');
        loadAdvisoryDates(); // Recargar fechas de asesoría
      }
    }, 300000); // **CAMBIO: 5 minutos en lugar de 30 segundos**

    return () => clearInterval(interval);
  }, [loading, loadingTurnos, selectedDate, selectedTime]);

  // **OPTIMIZACIÓN: Verificación de disponibilidad solo cuando es realmente necesario**
  useEffect(() => {
    // Solo verificar disponibilidad cuando se ha seleccionado completamente una cita
    if (selectedTime && selectedDate && advisoryDates.length > 0) {
      // Debounce para evitar verificaciones excesivas
      const timeoutId = setTimeout(() => {
        // Verificar si la fecha seleccionada sigue disponible
        const advisorySelected = advisoryDates.find(a => {
          const day = new Date(a.date).toISOString().split('T')[0];
          return day === selectedDate && a.time === selectedTime;
        });
        if (advisorySelected && advisorySelected.isBooked) {
          // console.log('⚠️ La fecha seleccionada ya no está disponible');
          setSelectedDate('');
          setSelectedTime('');
        }
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedTime, selectedDate, advisoryDates]);

  // **OPTIMIZACIÓN: Limpiar estado solo cuando cambian las fechas significativamente**
  useEffect(() => {
    // Solo limpiar si realmente hay cambios
    if (advisoryDates.length > 0) {
      setAvailabilityStatus({});
    }
  }, [advisoryDates.length]); // Cambiar dependencia a length para evitar re-renders innecesarios

  const loadProximosTurnos = async (forceRefresh = false) => {
    try {
      setLoadingTurnos(true);
      // console.log('🚀 Cargando turnos desde AvailableSlot...');
      
      // Usar la nueva API que lee directamente desde AvailableSlot
      const params = new URLSearchParams({
        serviceType: 'ConsultorioFinanciero',
        limit: '50'
      });
      
      // Con el nuevo sistema, no necesitamos caché ni timestamp
      const response = await fetch(`/api/turnos/available-slots?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        const turnos = data.turnos || [];
        
        // console.log(`✅ ${turnos.length} días con turnos disponibles cargados en ${data.responseTime || 'N/A'} (source: ${data.source || 'unknown'})`);
        
        setProximosTurnos(turnos);
        
        // Limpiar estado de disponibilidad al cargar nuevos turnos
        setAvailabilityStatus({});
      } else {
        console.error('❌ Error al cargar turnos:', data.error);
        setProximosTurnos([]);
      }
    } catch (error) {
      console.error('❌ Error al cargar turnos:', error);
      setProximosTurnos([]);
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Función para cargar fechas específicas de asesoría
  const loadAdvisoryDates = async () => {
    try {
      setLoadingTurnos(true);
      // console.log('📅 Cargando fechas específicas de asesoría...');
      
      const response = await fetch('/api/advisory-dates/ConsultorioFinanciero?available=true&futureOnly=true');
      const data = await response.json();
      
      if (data.success && data.dates) {
        const now = new Date();
        const dates = data.dates
          .filter((d: AdvisoryDate) => {
            // Filtrado defensivo en cliente: excluir pasados y reservadas
            const day = new Date(d.date);
            const [h, m] = (d.time || '00:00').split(':').map((n: string) => parseInt(n, 10));
            const slotUtc = new Date(Date.UTC(
              day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), h + 3, m, 0, 0
            ));
            
            // Verificar que no esté reservada y que sea futura
            const isNotBooked = !d.isBooked;
            const isFuture = slotUtc.getTime() > now.getTime();
            
            // Verificar que no tenga reserva temporal activa
            const hasActiveTempReservation = d.tempReservationExpiresAt && 
              new Date(d.tempReservationExpiresAt).getTime() > now.getTime();
            
            return isNotBooked && isFuture && !hasActiveTempReservation;
          })
          .map((date: AdvisoryDate) => ({
          ...date,
          date: new Date(date.date).toISOString()
        }));
        
        // console.log('✅ Fechas de asesoría cargadas:', dates.length);
        // console.log('📅 Detalles de fechas:', dates.map((d: AdvisoryDate) => ({
        //   id: d._id,
        //   date: d.date,
        //   title: d.title,
        //   time: d.time,
        //   isBooked: d.isBooked,
        //   hasTempReservation: !!d.tempReservationExpiresAt
        // })));
        setAdvisoryDates(dates);
      } else {
        // console.log('📭 No hay fechas específicas configuradas');
        setAdvisoryDates([]);
      }
      
    } catch (error) {
      console.error('❌ Error cargando fechas de asesoría:', error);
      setAdvisoryDates([]);
    } finally {
      setLoadingTurnos(false);
    }
  };

  // Función para formatear fechas correctamente (evitar problemas de zona horaria)
  const formatDateForDisplay = (dateString: string) => {
    // console.log('🔍 formatDateForDisplay - entrada:', dateString);
    
    // Si la fecha viene en formato DD/MM/YYYY, convertirla correctamente
    if (dateString.includes('/')) {
      const [day, month, year] = dateString.split('/');
      const date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
      // console.log('🔍 formatDateForDisplay - fecha UTC creada:', date.toISOString());
      
      const formatted = date.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      // console.log('🔍 formatDateForDisplay - fecha formateada:', formatted);
      return formatted;
    }
    
    // Si viene en otro formato, usar el método original
    return dateString;
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleDateSelect = (fecha: string) => {
    setSelectedDate(fecha);
    setSelectedTime(''); // Reset time when date changes
  };

  const handleTimeSelect = (horario: string) => {
    setSelectedTime(horario);
  };

  // Estado para verificación de disponibilidad en tiempo real
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<{[key: string]: boolean}>({});

  // Verificar si la fecha seleccionada sigue disponible
  const isSelectedTimeStillAvailable = () => {
    if (!selectedDate) return true; // Si no hay selección, no mostrar error
    
    // Verificar en la lista de fechas de asesoría
    const advisorySelected = advisoryDates.find(a => {
      const day = new Date(a.date).toISOString().split('T')[0];
      return day === selectedDate && a.time === selectedTime;
    });
    return advisorySelected ? !advisorySelected.isBooked : false;
  };

  // Función para verificar disponibilidad en tiempo real
  const checkRealTimeAvailability = async (fecha: string, horario: string) => {
    const key = `${fecha}-${horario}`;
    setIsCheckingAvailability(true);
    
    try {
      // console.log(`🔍 Verificando disponibilidad: ${fecha} ${horario}`);
      
      const response = await fetch('/api/turnos/check-availability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          fecha,
          horario,
          tipo: 'advisory',
          servicioTipo: 'ConsultorioFinanciero'
        })
      });

      if (!response.ok) {
        // console.error(`❌ Error en verificación: ${response.status}`);
        return false; // Si hay error, asumir que NO está disponible
      }

      const data = await response.json();
      
      // console.log(`📊 Respuesta de verificación:`, data);
      
      setAvailabilityStatus(prev => ({
        ...prev,
        [key]: data.available
      }));

      // console.log(`🔍 Verificación en tiempo real: ${fecha} ${horario} - ${data.available ? '✅ Disponible' : '❌ NO DISPONIBLE'}`);
      
      return data.available;
    } catch (error) {
      console.error('❌ Error al verificar disponibilidad:', error);
      return false; // En caso de error, asumir que NO está disponible
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  const handleSacarTurno = async () => {
    if (!session) {
      setShowLoginAlert(true);
      return;
    }

    if (!selectedDate) {
      alert('Por favor selecciona una fecha para tu consulta');
      return;
    }

    if (!selectedTime) {
      alert('Por favor selecciona una hora para tu consulta');
      return;
    }

    // Validar que el formulario esté completo (ya validado por isFormValid, pero por seguridad)
    if (!isFormValid()) {
      alert('Por favor completa todos los campos obligatorios correctamente');
      return;
    }

    // Buscar la fecha/horario seleccionados (día + hora)
    const advisorySelected = advisoryDates.find(a => {
      const day = new Date(a.date).toISOString().split('T')[0];
      return day === selectedDate && a.time === selectedTime;
    });
    if (!advisorySelected) {
      alert('Error: No se encontró la fecha seleccionada');
      return;
    }

    // Verificar que la fecha no esté reservada
    if (advisorySelected.isBooked) {
      alert('Esta fecha ya está reservada. Por favor selecciona otra fecha.');
      return;
    }

    // Crear fecha UTC para la reserva (día seleccionado + hora seleccionada)
    const targetDate = new Date(advisorySelected.date);
    const [hour, minute] = (advisorySelected.time || selectedTime).split(':').map(Number);
    
    // Crear fecha UTC agregando 3 horas (Uruguay es UTC-3)
    const utcDate = new Date(Date.UTC(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      hour + 3, // Agregar 3 horas para UTC
      minute,
      0,
      0
    ));

    // console.log(`🎯 Fecha y hora final para reserva: ${utcDate.toISOString()}`);
    // console.log(`📍 Hora local esperada: ${advisorySelected.time}`);
    // console.log(`📍 Hora UTC enviada: ${utcDate.getUTCHours()}:${String(utcDate.getUTCMinutes()).padStart(2, '0')}`);

    // Precio dinámico para Consultorio Financiero
    const bookingPrice = pricing?.asesorias?.consultorioFinanciero?.price || 50000;
    const bookingCurrency = 'ARS';

    // Crear checkout de MercadoPago PRIMERO (sin crear reserva)
    try {
      // console.log('💳 Creando checkout de MercadoPago...');
      
      const response = await fetch('/api/payments/mercadopago/create-booking-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: 'ConsultorioFinanciero',
          amount: bookingPrice,
          currency: bookingCurrency,
          // Datos de la reserva para crear después del pago
          reservationData: {
            type: 'advisory',
            serviceType: 'ConsultorioFinanciero',
            startDate: utcDate.toISOString(),
            duration: 45,
            price: bookingPrice,
            notes: `Reserva desde página de Consultorio Financiero - ${selectedDate} a las ${selectedTime}`,
            userEmail: session.user?.email,
            userName: session.user?.name || 'Usuario',
            advisoryDateId: advisorySelected?._id
          }
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        // console.log('✅ Checkout de MercadoPago creado, redirigiendo al pago');

        // Limpiar selección inmediatamente (la reserva real se hace en el webhook al aprobar pago)
        setSelectedDate('');
        setSelectedTime('');
        
        // NO refrescar las fechas aquí - la fecha debe seguir disponible hasta que el pago sea exitoso
        // La fecha solo desaparecerá cuando el webhook confirme el pago exitoso
        
        // Redirigir a MercadoPago
        window.location.href = data.checkoutUrl;
      } else {
        console.error('❌ Error creando checkout:', data.error);
        alert('Error al procesar el pago. Por favor intenta nuevamente.');
      }
    } catch (error: any) {
      console.error('❌ Error en el proceso de pago:', error);
      alert('Error al procesar el pago. Por favor intenta nuevamente.');
      
      // Si es un error de conflicto (409), recargar turnos para mostrar disponibilidad actualizada
      if (error.message?.includes('Horario no disponible') || error.message?.includes('409')) {
        // console.log('🔄 Recargando turnos debido a conflicto...');
        
        // Recargar turnos inmediatamente con forzado de recarga
        await loadProximosTurnos(true);
        
        // El mensaje de error ya se mostró en el hook useBookings
        // Ahora el sistema mostrará automáticamente el mensaje rojo porque el turno ya no estará disponible
        // console.log('⚠️ Turno ya no disponible, la UI se actualizará automáticamente');
      }
    }
  };

  const handleLogin = () => {
    signIn('google');
    setShowLoginAlert(false);
  };

  return (
    <>
      <Head>
        <title>Consultorio Financiero - Consulta Individual Personalizada | Nahuel Lozano</title>
        <meta name="description" content="Sesión individual de 45 minutos para optimizar tu estrategia de inversión. Análisis personalizado, recomendaciones específicas y plan de acción detallado." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      {/* ComingSoon solo visible para usuarios NO admin */}
      {!isAdmin && (
        <ComingSoon 
          title="Próximamente"
          message="Estamos trabajando en esta sección. Muy pronto estará disponible."
        />
      )}

      {/* Contenido visible solo para admin */}
      {isAdmin && (
      <main className={styles.main}>
        {/* Hero Section */}
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
          <div className={styles.heroOverlay}></div>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>Consultorio Financiero</h1>
              <p className={styles.heroDescription}>
                Sesiones virtuales e individuales para analizar tu situación financiera actual y diseñar una estrategia de inversión personalizada según tu perfil de riesgo y objetivos.
              </p>
              <a href="#formulario-turno" className={styles.heroButtonGold}>
                Agendar Turno &gt;
              </a>
            </div>
            <div className={styles.heroVideo}>
              <div className={styles.videoContainer}>
                <YouTubePlayer
                  videoId="dQw4w9WgXcQ"
                  title="Consultorio Financiero - Introducción"
                  autoplay={false}
                  muted={true}
                  loop={false}
                  fillContainer={true}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Sección Asesoramiento Personalizado */}
        <section className={styles.asesoramientoSection}>
          <div className={styles.asesoramientoContainer}>
            <div className={styles.asesoramientoImage}>
              <img 
                src="/logos/asesoria foto.png" 
                alt="Nahuel Lozano - Asesor Financiero"
                className={styles.nahuelImage}
              />
            </div>
          </div>
        </section>

        {/* Formulario de Reserva */}
        <section className={styles.reservaSection} id="formulario-turno">
          <div className={styles.reservaContainer}>
            <h2 className={styles.reservaTitle}>Próximos Turnos</h2>
            <p className={styles.reservaSubtitle}>
              Selecciona la fecha y hora que mejor se adapte a tu agenda. Sesiones de 45 minutos para un análisis completo de tu situación financiera.
            </p>
            
            <div className={styles.reservaCard}>
              <div className={styles.reservaContent}>
                {/* Calendario y Horarios */}
                <div className={styles.calendarioSection}>
                  <h3 className={styles.calendarioTitle}>Selecciona una fecha y hora</h3>
                  
                  {loadingTurnos ? (
                    <div className={styles.loadingTurnos}>
                      <p>Cargando fechas disponibles...</p>
                    </div>
                  ) : advisoryDates.length === 0 ? (
                    <div className={styles.noTurnos}>
                      <p>No hay fechas de asesoría disponibles en este momento. Intenta más tarde.</p>
                    </div>
                  ) : (
                    <>
                      {/* Calendario Interactivo */}
                      <div className={styles.calendarContainer}>
                        <ClassCalendar
                          events={calendarEvents}
                          onDateSelect={handleCalendarDateSelect}
                          isAdmin={true}
                          initialDate={earliestDate}
                          selectedDate={selectedDate ? (() => {
                            // Crear fecha directamente en zona horaria local para evitar desfases
                            const [year, month, day] = selectedDate.split('-').map(Number);
                            return new Date(year, month - 1, day);
                          })() : undefined}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Columna derecha: Horarios */}
                <div className={styles.horariosPanel}>
                  <h3 className={styles.calendarioTitle}>Horarios</h3>
                  {loadingTurnos ? (
                    <div className={styles.loadingTurnos}>
                      <p>Cargando horarios...</p>
                    </div>
                  ) : !selectedDate ? (
                    <div className={styles.horariosPlaceholder}>
                      <p>Elegí una fecha del calendario para ver horarios disponibles.</p>
                    </div>
                  ) : (
                    <div className={styles.horariosSection}>
                      <div className={styles.horariosHeader}>
                        <h4 className={styles.horariosTitle}>
                          Fecha y hora de asesoría seleccionada
                        </h4>
                        <button 
                          className={styles.closeHorariosButton}
                          onClick={() => {
                            setSelectedDate('');
                            setSelectedTime('');
                          }}
                        >
                          ×
                        </button>
                      </div>
                      <div className={styles.horariosGrid}>
                        {advisoryDates
                          .filter(advisory => {
                            // Crear fecha directamente sin conversiones UTC para evitar desfases
                            const advisoryYear = new Date(advisory.date).getFullYear();
                            const advisoryMonth = String(new Date(advisory.date).getMonth() + 1).padStart(2, '0');
                            const advisoryDay = String(new Date(advisory.date).getDate()).padStart(2, '0');
                            const advisoryDateStr = `${advisoryYear}-${advisoryMonth}-${advisoryDay}`;
                            return advisoryDateStr === selectedDate && !advisory.isBooked;
                          })
                          .map((advisory, index) => (
                            <button
                              key={`${advisory._id}-${index}`}
                              className={`${styles.horarioButton} ${selectedTime === advisory.time ? styles.horarioSelected : ''}`}
                              onClick={() => setSelectedTime(advisory.time)}
                            >
                              <Clock size={16} /> {advisory.time}hs
                            </button>
                          ))}
                      </div>
                      {selectedDate && (
                        <div className={styles.seleccionInfo}>
                          <div className={styles.infoItem}>
                            <strong>FECHA:</strong> {(() => {
                              // Crear fecha directamente sin conversiones UTC para evitar desfases
                              const [year, month, day] = selectedDate.split('-').map(Number);
                              const date = new Date(year, month - 1, day);
                              return date.toLocaleDateString('es-ES', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              });
                            })()}
                          </div>
                          {selectedTime && (
                            <div className={styles.infoItem}>
                              <strong>HORA:</strong> {selectedTime}hs
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Formulario de Datos dentro del panel de horarios */}
                  <div className={styles.formularioSection}>
                <h3 className={styles.formularioTitle}>Introduzca los detalles</h3>
                
                <form className={styles.formulario}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="nombre" className={styles.formLabel}>
                        Nombre *
                      </label>
                      <input
                        type="text"
                        id="nombre"
                        name="nombre"
                        className={`${styles.formInput} ${session?.user?.name ? styles.readOnlyInput : ''}`}
                        value={formData.nombre}
                        onChange={(e) => handleFormChange('nombre', e.target.value)}
                        placeholder="Tu nombre"
                        required
                        readOnly={!!session?.user?.name}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="apellido" className={styles.formLabel}>
                        Apellido *
                      </label>
                      <input
                        type="text"
                        id="apellido"
                        name="apellido"
                        className={`${styles.formInput} ${session?.user?.name ? styles.readOnlyInput : ''}`}
                        value={formData.apellido}
                        onChange={(e) => handleFormChange('apellido', e.target.value)}
                        placeholder="Tu apellido"
                        required
                        readOnly={!!session?.user?.name}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="email" className={styles.formLabel}>
                        Correo electrónico *
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        className={`${styles.formInput} ${session?.user?.email ? styles.readOnlyInput : ''}`}
                        value={formData.email}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                        placeholder="Tu email"
                        required
                        readOnly={!!session?.user?.email}
                      />
                      {session?.user?.email && (
                        <small className={styles.googleDataNote}>
                          ✓ Datos obtenidos de tu cuenta de Google
                        </small>
                      )}
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="whatsapp" className={styles.formLabel}>
                        Número de Whatsapp *
                      </label>
                      <input
                        type="tel"
                        id="whatsapp"
                        name="whatsapp"
                        className={styles.formInput}
                        value={formData.whatsapp}
                        onChange={(e) => handleFormChange('whatsapp', e.target.value)}
                        placeholder="+54 9 11 1234-5678"
                        required
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="comoConociste" className={styles.formLabel}>
                        Donde o como conociste
                      </label>
                      <textarea
                        id="comoConociste"
                        name="comoConociste"
                        className={styles.formTextarea}
                        rows={3}
                        placeholder="Cuéntanos cómo llegaste a nosotros..."
                      ></textarea>
                    </div>
                  </div>
                  
                  <div className={styles.precioSection}>
                    <span className={styles.precioLabel}>Valor de la consulta:</span>
                    <span className={styles.precioValor}>
                      {pricingLoading ? (
                        'Cargando precio...'
                      ) : pricing ? (
                        `$${pricing.asesorias.consultorioFinanciero.price.toLocaleString('es-AR')} ARS`
                      ) : (
                        '$50.000 ARS'
                      )}
                    </span>
                  </div>
                  
                  {session ? (
                    <button 
                      type="button"
                      className={styles.confirmarButton}
                      onClick={handleSacarTurno}
                      disabled={!selectedDate || !selectedTime || !isFormValid() || loading}
                    >
                      {loading ? 'Procesando...' : 'Confirmar Turno >'}
                    </button>
                  ) : (
                    <div className={styles.loginRequired}>
                      <p>Necesitas iniciar sesión para reservar un turno</p>
                      <button 
                        type="button"
                        className={styles.loginButton}
                        onClick={handleLogin}
                      >
                        Iniciar Sesión
                      </button>
                    </div>
                  )}
                </form>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recordatorio para Agendar Turno */}
        <section className={styles.recordatorioSection}>
          <div className={styles.recordatorioContainer}>
            <h2 className={styles.recordatorioTitle}>
              ¿Listo para llevar tus inversiones al siguiente nivel?
            </h2>
            <p className={styles.recordatorioSubtitle}>
              Únete a nuestra comunidad y comienza a construir tu libertad financiera
            </p>
            <a href="#formulario-turno" className={styles.recordatorioButton}>
              Agendar Turno {'>'}
            </a>
          </div>
        </section>

        {/* Recordatorio YouTube */}
        <section className={styles.youtubeSection}>
          <div className={styles.youtubeContainer}>
            <div className={styles.youtubeContent}>
              <div className={styles.youtubeText}>
                <h2 className={styles.youtubeTitle}>
                  ¡Sumate a nuestra comunidad
                  <br />
                  <span className={styles.youtubeHighlight}>en YouTube!</span>
                </h2>
                <p className={styles.youtubeSubtitle}>
                  No te pierdas nuestros últimos videos
                </p>
              </div>
              
              <div className={styles.youtubeVideoContainer}>
                <div className={styles.videoArrow}>
                  <ChevronLeft size={24} />
                </div>
                
                <div className={styles.youtubeVideoWrapper}>
                  <YouTubePlayer
                    videoId="dQw4w9WgXcQ"
                    title="Consultorio Financiero - Testimonios"
                    autoplay={false}
                    muted={true}
                    loop={false}
                    fillContainer={true}
                  />
                </div>
                
                <div className={styles.videoArrow}>
                  <ChevronRight size={24} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Testimonios Carrusel - Solo mostrar si hay testimonios */}
        {testimonios && testimonios.length > 0 && (
          <section className={styles.testimoniosSection}>
            <div className={styles.container}>
              <motion.h2 
                className={styles.sectionTitle}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                Testimonios
              </motion.h2>
              <motion.p 
                className={styles.sectionDescription}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
              >
                Resultados reales de clientes que transformaron sus finanzas
              </motion.p>
              
              <div className={styles.testimoniosCarousel}>
                <Carousel 
                  items={testimonios.map((testimonio, index) => (
                    <div key={index} className={styles.testimonioCard}>
                      <div className={styles.testimonioHeader}>
                        <img 
                          src={testimonio.foto} 
                          alt={testimonio.nombre}
                          className={styles.testimonioFoto}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = generateCircularAvatarDataURL(testimonio.nombre, '#3b82f6', '#ffffff', 80);
                          }}
                        />
                        <div className={styles.testimonioInfo}>
                          <h4 className={styles.testimonioNombre}>{testimonio.nombre}</h4>
                          <div className={styles.testimonioRating}>
                            {[...Array(testimonio.rating)].map((_, i) => (
                              <Star key={i} size={16} fill="currentColor" />
                            ))}
                          </div>
                          <span className={styles.testimonioResultado}>{testimonio.resultado}</span>
                        </div>
                      </div>
                      <p className={styles.testimonioComentario}>"{testimonio.comentario}"</p>
                    </div>
                  ))}
                  autoplay={true}
                  showDots={true}
                  className={styles.testimoniosCarouselWrapper}
                />
              </div>
            </div>
          </section>
        )}

        {/* Preguntas Frecuentes - Solo mostrar si hay FAQs */}
        {faqs && faqs.length > 0 && (
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
                Resolvemos las dudas más comunes sobre el Consultorio Financiero
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
        )}

        {/* Modal de Éxito */}
        {showSuccessModal && (
        <div className={styles.modalOverlay}>
          <motion.div 
            className={styles.successModal}
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className={styles.modalHeader}>
              <div className={styles.successIcon}>✅</div>
              <h2 className={styles.modalTitle}>¡Reserva Confirmada!</h2>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.reservationDetails}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>📅 Fecha:</span>
                  <span className={styles.detailValue}>{reservedSlot?.date}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>🕐 Hora:</span>
                  <span className={styles.detailValue}>{reservedSlot?.time}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>💼 Servicio:</span>
                  <span className={styles.detailValue}>Consultorio Financiero</span>
                </div>
                <div className={styles.detailItem}>
                                          <span className={styles.detailLabel}>💰 Precio:</span>
                        <span className={styles.detailValue}>
                          {pricingLoading ? (
                            'Cargando precio...'
                          ) : pricing ? (
                            `$${pricing.asesorias.consultorioFinanciero.price.toLocaleString('es-AR')} ARS`
                          ) : (
                            '$50.000 ARS'
                          )}
                        </span>
                </div>
              </div>
              
              <div className={styles.modalInfo}>
                <div className={styles.infoBox}>
                  <h4>💳 Proceso de Pago:</h4>
                  <ul>
                    <li>Serás redirigido a MercadoPago para completar el pago</li>
                    <li>Una vez confirmado el pago, recibirás un email de confirmación</li>
                    <li>El evento se agregará al calendario del administrador</li>
                    <li>Te contactaremos 24 horas antes con el link de la reunión</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className={styles.modalActions}>
              <button 
                onClick={() => {
                  setShowSuccessModal(false);
                  setReservedSlot(null);
                }}
                className={styles.modalButton}
              >
                Entendido
              </button>
            </div>
          </motion.div>
        </div>
        )}
      </main>
      )}

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    // Cargar testimonios específicos para consultorio financiero
    const testimoniosResponse = await fetch(`${baseUrl}/api/testimonials?servicio=consultorio`);
    let testimonios: Testimonio[] = [];
    
    if (testimoniosResponse.ok) {
      const testimoniosData = await testimoniosResponse.json();
      testimonios = testimoniosData.testimonials || [];
    }

    // Cargar FAQs específicas para consultorio financiero
    const faqsResponse = await fetch(`${baseUrl}/api/faqs?categoria=consultorio`);
    let faqs: FAQ[] = [];
    
    if (faqsResponse.ok) {
      const faqsData = await faqsResponse.json();
      faqs = faqsData.faqs || [];
    }

    // console.log(`✅ Cargados ${testimonios.length} testimonios y ${faqs.length} FAQs para consultorio`);

    return {
      props: {
        testimonios,
        faqs
      }
    };
  } catch (error) {
    console.error('❌ Error al cargar datos del consultorio:', error);
    
    // En caso de error, retornar arrays vacíos
    return {
      props: {
        testimonios: [],
        faqs: []
      }
    };
  }
};

export default ConsultorioFinancieroPage;