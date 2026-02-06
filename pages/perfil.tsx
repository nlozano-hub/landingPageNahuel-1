import { GetServerSideProps } from 'next';
import { getSession, useSession } from 'next-auth/react';
import Head from 'next/head';
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { generateCircularAvatarDataURL } from '@/lib/utils';
import { 
  User, 
  ShoppingBag, 
  Bell,
  Mail,
  Building,
  GraduationCap,
  TrendingUp,
  Edit3,
  Download,
  Calendar,
  DollarSign,
  AlertTriangle,
  X,
  CheckCircle,
  AlertCircle,
  Send,
  Link2,
  Unlink,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import UserSubscriptions from '@/components/UserSubscriptions';
import { useUserSubscriptions } from '@/hooks/useUserSubscriptions';
import styles from '@/styles/Perfil.module.css';

// Links estáticos de canales de Telegram
const TELEGRAM_CHANNEL_LINKS = {
  TraderCall: 'https://t.me/+iV_hFto-Y90zODRh',
  SmartMoney: 'https://t.me/+9Q3WJ8kcNsdkNmE5'
};

// Componente para mostrar notificaciones reales
const NotificationsSection = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        
        // Primero intentar generar notificaciones automáticamente
        try {
          await fetch('/api/notifications/auto-generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (autoGenError) {
          // console.log('Auto-generación de notificaciones no disponible:', autoGenError);
        }
        
        // Luego obtener las notificaciones
        const response = await fetch('/api/notifications/get?limit=10');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
        }
      } catch (error) {
        console.error('Error cargando notificaciones:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Hace menos de 1 hora';
    if (diffInHours < 24) return `Hace ${diffInHours} hora${diffInHours > 1 ? 's' : ''}`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `Hace ${diffInDays} día${diffInDays > 1 ? 's' : ''}`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `Hace ${diffInWeeks} semana${diffInWeeks > 1 ? 's' : ''}`;
    
    return 'Hace más de 1 mes';
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'pago': return <DollarSign size={16} />;
      case 'advertencia': return <AlertTriangle size={16} />;
      case 'novedad': return <Bell size={16} />;
      case 'bienvenida': return <CheckCircle size={16} />;
      default: return <Bell size={16} />;
    }
  };

  if (loading) {
    return (
      <motion.div
        className={styles.sectionContent}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.sectionHeader}>
          <h2>Central de Notificaciones</h2>
        </div>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner} />
          <p>Cargando notificaciones...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={styles.sectionContent}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className={styles.sectionHeader}>
        <h2>Central de Notificaciones</h2>
      </div>
      
      <div className={styles.notificationsContainer}>
        {notifications.length === 0 ? (
          <div className={styles.emptyNotifications}>
            <Bell size={48} />
            <h3>Sin notificaciones</h3>
            <p>No tienes notificaciones nuevas por el momento.</p>
          </div>
        ) : (
          <div className={styles.notificationCard}>
            <div className={styles.cardHeader}>
              <Bell size={24} />
              <h3>Notificaciones Reales</h3>
            </div>
            <div className={styles.notificationsList}>
              {notifications.map((notification, index) => (
                <div key={notification.id || index} className={styles.notificationItem}>
                  <div className={styles.notificationIcon}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className={styles.notificationContent}>
                    <h4>{notification.title}</h4>
                    <div dangerouslySetInnerHTML={{ __html: notification.message }} />
                    <span className={styles.notificationTime}>
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Interfaz para los datos del perfil
interface UserProfile {
  email: string;
  name: string;
  image: string;
  fullName?: string;
  cuitCuil?: string;
  educacionFinanciera?: string;
  brokerPreferencia?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Función para mostrar el nombre del broker de forma legible
const getBrokerDisplayName = (brokerValue: string) => {
  const brokerNames: { [key: string]: string } = {
    'bull-market': 'Bull Market',
    'iol': 'IOL',
    'portfolio-personal': 'Portfolio Personal',
    'cocos-capital': 'Cocos Capital',
    'eco-valores': 'Eco Valores',
    'otros': 'Otros'
  };
  return brokerNames[brokerValue] || brokerValue;
};

export default function PerfilPage() {
  const { data: session, status, update } = useSession();
  const [activeSection, setActiveSection] = useState(1);
  const [showIncompleteNotification, setShowIncompleteNotification] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  const [formData, setFormData] = useState({
    fullName: '',
    cuitCuil: '',
    educacionFinanciera: '',
    brokerPreferencia: ''
  });

  // Estados para Telegram
  const [telegramData, setTelegramData] = useState<{
    isLinked: boolean;
    telegramUserId: number | null;
    telegramUsername: string | null;
    linkedAt: string | null;
  }>({ isLinked: false, telegramUserId: null, telegramUsername: null, linkedAt: null });
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkCodeExpiresAt, setLinkCodeExpiresAt] = useState<Date | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [inviteLinks, setInviteLinks] = useState<{ [key: string]: string }>({});
  const [generatingLink, setGeneratingLink] = useState<string | null>(null);

  // Hook para obtener suscripciones activas del usuario
  const { subscriptions } = useUserSubscriptions();

  // Función para verificar si el usuario tiene suscripción activa a un servicio
  const hasActiveSubscription = (service: string): boolean => {
    return subscriptions.some(sub => 
      sub.service === service && 
      sub.status === 'active' && 
      new Date(sub.expiryDate) > new Date()
    );
  };

  // Función para obtener estado de Telegram
  const fetchTelegramStatus = async () => {
    try {
      const response = await fetch('/api/telegram/link-account');
      if (response.ok) {
        const data = await response.json();
        setTelegramData({
          isLinked: data.isLinked,
          telegramUserId: data.telegramUserId,
          telegramUsername: data.telegramUsername,
          linkedAt: data.linkedAt
        });
      }
    } catch (error) {
      console.error('Error obteniendo estado de Telegram:', error);
    }
  };

  // Obtener información del bot (username)
  useEffect(() => {
    const fetchBotInfo = async () => {
      try {
        const response = await fetch('/api/telegram/bot-info');
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.username) {
            setBotUsername(data.username);
          }
        }
      } catch (error) {
        console.error('Error obteniendo info del bot:', error);
      }
    };
    fetchBotInfo();
  }, []);

  // Función para iniciar verificación periódica de vinculación
  const startLinkVerification = () => {
    const checkInterval = setInterval(async () => {
      const statusResponse = await fetch('/api/telegram/link-account');
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.isLinked) {
          clearInterval(checkInterval);
          setLinkCode(null);
          setLinkCodeExpiresAt(null);
          setTelegramData({
            isLinked: true,
            telegramUserId: statusData.telegramUserId,
            telegramUsername: statusData.telegramUsername,
            linkedAt: statusData.linkedAt
          });
          toast.success('¡Cuenta vinculada exitosamente!', { duration: 5000 });
        }
      }
    }, 3000); // Verificar cada 3 segundos

    // Limpiar intervalo después de 15 minutos
    setTimeout(() => {
      clearInterval(checkInterval);
      fetch('/api/telegram/link-account').then(r => r.json()).then(statusData => {
        if (!statusData.isLinked && linkCode) {
          setLinkCode(null);
          setLinkCodeExpiresAt(null);
          toast.error('El código expiró. Genera uno nuevo.', { duration: 5000 });
        }
      });
    }, 15 * 60 * 1000);
  };

  // Generar código de vinculación (mostrar en web)
  const handleGenerateLinkCode = async () => {
    setGeneratingCode(true);
    try {
      const response = await fetch('/api/telegram/generate-link-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        setLinkCode(data.code);
        setLinkCodeExpiresAt(new Date(data.expiresAt));
        toast.success('Código generado. Envíalo al bot de Telegram.', { duration: 5000 });
        startLinkVerification();
      } else {
        toast.error(data.error || 'Error generando código');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setGeneratingCode(false);
    }
  };

  // Enviar código por email
  const handleSendCodeByEmail = async () => {
    setSendingEmail(true);
    try {
      const response = await fetch('/api/telegram/send-link-code-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (response.ok) {
        setLinkCode(data.code);
        setLinkCodeExpiresAt(new Date(data.expiresAt));
        toast.success(`Código enviado por email. Revisa tu bandeja de entrada.`, { duration: 8000 });
        startLinkVerification();
      } else {
        toast.error(data.error || 'Error enviando código por email');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setSendingEmail(false);
    }
  };

  // Desvincular Telegram
  const handleUnlinkTelegram = async () => {
    if (!confirm('¿Estás seguro de desvincular tu cuenta de Telegram?')) return;

    setTelegramLoading(true);
    try {
      const response = await fetch('/api/telegram/link-account', {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Telegram desvinculado');
        setTelegramData({ isLinked: false, telegramUserId: null, telegramUsername: null, linkedAt: null });
        setInviteLinks({});
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al desvincular');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setTelegramLoading(false);
    }
  };

  // Generar link de invitación
  const handleGenerateInvite = async (service: string) => {
    setGeneratingLink(service);
    try {
      const response = await fetch('/api/telegram/generate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service })
      });

      const data = await response.json();

      if (response.ok) {
        setInviteLinks(prev => ({ ...prev, [service]: data.inviteLink }));
        toast.success(`Link generado para ${service}`);
      } else {
        toast.error(data.error || 'Error al generar link');
      }
    } catch (error) {
      toast.error('Error de conexión');
    } finally {
      setGeneratingLink(null);
    }
  };

  // Copiar link al portapapeles
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Link copiado al portapapeles');
  };

  // Función para obtener el perfil del usuario
  const fetchUserProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await fetch('/api/profile/get', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUserProfile(result.profile);
        
        // Inicializar formulario con datos reales
        setFormData({
          fullName: result.profile.fullName || result.profile.name || '',
          cuitCuil: result.profile.cuitCuil || '',
          educacionFinanciera: result.profile.educacionFinanciera || '',
          brokerPreferencia: result.profile.brokerPreferencia || ''
        });
      } else {
        console.error('Error al obtener perfil:', response.statusText);
      }
    } catch (error) {
      console.error('Error al obtener perfil:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  // Obtener perfil al cargar y cuando la sesión esté lista
  useEffect(() => {
    if (session?.user?.email) {
      fetchUserProfile();
      fetchTelegramStatus();
    }
  }, [session]);

  // Verificar información incompleta del perfil usando datos reales
  const profileIncomplete = useMemo(() => {
    if (!userProfile) return { incomplete: false, missingFields: [] };
    
    const missingFields = [];
    
    // Verificar campos obligatorios
    if (!userProfile.fullName || userProfile.fullName.trim() === '') {
      missingFields.push('Nombre completo');
    }
    
    if (!userProfile.cuitCuil) {
      missingFields.push('CUIT/CUIL');
    }
    
    if (!userProfile.educacionFinanciera) {
      missingFields.push('Educación Financiera');
    }
    
    if (!userProfile.brokerPreferencia) {
      missingFields.push('Broker de Preferencia');
    }
    
    return {
      incomplete: missingFields.length > 0,
      missingFields
    };
  }, [userProfile]);

  // Función para mostrar notificaciones
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message });
    setTimeout(() => {
      setNotification({ show: false, type: 'success', message: '' });
    }, 5000);
  };

  // Función para guardar el perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fullName.trim()) {
      showNotification('error', 'El nombre completo es obligatorio');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          cuitCuil: formData.cuitCuil,
          educacionFinanciera: formData.educacionFinanciera,
          brokerPreferencia: formData.brokerPreferencia,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        showNotification('success', 'Perfil actualizado exitosamente');
        setShowEditModal(false);
        setShowIncompleteNotification(false);
        
        // Actualizar los datos del perfil inmediatamente
        await fetchUserProfile();
        
        // También actualizar la sesión de NextAuth si es necesario
        await update();
      } else {
        showNotification('error', result.message || 'Error al actualizar el perfil');
      }
    } catch (error) {
      console.error('Error:', error);
      showNotification('error', 'Error al actualizar el perfil');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || profileLoading) {
    return (
      <>
        <Head>
          <title>Mi Cuenta - Nahuel Lozano</title>
        </Head>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.loadingSpinner}>
              <div className={styles.spinner} />
              <p>Cargando tu cuenta...</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!session || !userProfile) {
    return null;
  }

  const sections = [
    {
      id: 1,
      title: 'Información Personal',
      description: 'Nombre y Apellido, Avatar, CUIT/CUIL, Correo Electrónico, Educación Financiera, Broker de Preferencia',
      icon: <User size={20} />
    },
    {
      id: 2,
      title: 'Mis Compras',
      description: 'Suscripciones, Compras Entrenamientos, Compras Cursos, etc',
      icon: <ShoppingBag size={20} />
    },
    {
      id: 3,
      title: 'Notificaciones',
      description: 'Central de Notificaciones del usuario respecto al pago y novedades',
      icon: <Bell size={20} />
    },
    {
      id: 4,
      title: 'Telegram',
      description: 'Vincular cuenta de Telegram para recibir alertas en tu celular',
      icon: <Send size={20} />
    }
  ];

  return (
    <>
      <Head>
        <title>Mi Cuenta - Nahuel Lozano</title>
        <meta name="description" content="Gestiona tu cuenta, información personal y consulta tu historial de compras" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.profileContent}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className={styles.profileHeader}>
              <h1 className={styles.mainTitle}>Mi Cuenta</h1>
              <p className={styles.mainSubtitle}>
                Gestiona tu información personal y consulta tu historial de compras
              </p>
            </div>

            {/* Notificación de perfil incompleto */}
            {profileIncomplete.incomplete && showIncompleteNotification && (
              <motion.div
                className={styles.incompleteNotification}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className={styles.notificationContent}>
                  <div className={styles.notificationIcon}>
                    <AlertTriangle size={24} />
                  </div>
                  <div className={styles.notificationText}>
                    <h3>Completa tu perfil</h3>
                    <p>
                      Te faltan algunos datos importantes: {profileIncomplete.missingFields.join(', ')}. 
                      Completar tu perfil te ayudará a tener una mejor experiencia.
                    </p>
                  </div>
                  <div className={styles.notificationActions}>
                    <button 
                      className={styles.completeButton}
                      onClick={() => {
                        setActiveSection(1);
                        setShowIncompleteNotification(false);
                      }}
                    >
                      Completar Ahora
                    </button>
                    <button 
                      className={styles.dismissButton}
                      onClick={() => setShowIncompleteNotification(false)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Navigation Table */}
            <div className={styles.navigationTable}>
              <div className={styles.tableHeader}>
                <div className={styles.headerColumn}>Menú y Submenú Desplegable</div>
                <div className={styles.headerColumn}>
                  Servicios y Funcionalidades
                </div>
              </div>
              
              {sections.map((section, index) => (
                <motion.div
                  key={section.id}
                  className={`${styles.tableRow} ${activeSection === section.id ? styles.active : ''}`}
                  onClick={() => setActiveSection(section.id)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={styles.sectionNumber}>{section.id}</div>
                  <div className={styles.sectionInfo}>
                    <div className={styles.sectionTitle}>
                      {section.icon}
                      <span>{section.title}</span>
                    </div>
                  </div>
                  <div className={styles.sectionDescription}>
                    {section.description}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Content Sections */}
            <div className={styles.contentContainer}>
              {/* Información Personal */}
              {activeSection === 1 && (
                <motion.div
                  className={styles.sectionContent}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={styles.sectionHeader}>
                    <h2>Información Personal</h2>
                    <button 
                      className={styles.editButton}
                      onClick={() => setShowEditModal(true)}
                    >
                      <Edit3 size={16} />
                      Carga y Modificación
                    </button>
                  </div>
                  
                  <div className={styles.infoGrid}>
                    <div className={styles.infoCard}>
                      <div className={styles.cardIcon}>
                        <User size={24} />
                      </div>
                      <h3>Datos Personales</h3>
                      <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Nombre y Apellido:</span>
                          <span className={`${styles.value} ${!userProfile?.fullName ? styles.missing : ''}`}>
                            {userProfile?.fullName || 'No especificado'}
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>CUIT/CUIL:</span>
                          <span className={`${styles.value} ${!userProfile?.cuitCuil ? styles.missing : ''}`}>
                            {userProfile?.cuitCuil || 'No especificado'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.infoCard}>
                      <div className={styles.cardIcon}>
                        <Mail size={24} />
                      </div>
                      <h3>Contacto</h3>
                      <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Correo Electrónico:</span>
                          <span className={styles.value}>{userProfile?.email}</span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Avatar:</span>
                          <span className={styles.value}>
                            <img 
                              src={userProfile?.image || generateCircularAvatarDataURL(userProfile?.name || 'Usuario', '#3b82f6', '#ffffff', 120)}
                              alt="Foto de perfil"
                              className={styles.profileImage}
                            />
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.infoCard}>
                      <div className={styles.cardIcon}>
                        <GraduationCap size={24} />
                      </div>
                      <h3>Preferencias</h3>
                      <div className={styles.infoList}>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Educación Financiera:</span>
                          <span className={`${styles.value} ${!userProfile?.educacionFinanciera ? styles.missing : ''}`}>
                            {userProfile?.educacionFinanciera ? 
                              userProfile.educacionFinanciera.charAt(0).toUpperCase() + userProfile.educacionFinanciera.slice(1) : 
                              'No especificado'
                            }
                          </span>
                        </div>
                        <div className={styles.infoItem}>
                          <span className={styles.label}>Broker de Preferencia:</span>
                          <span className={`${styles.value} ${!userProfile?.brokerPreferencia ? styles.missing : ''}`}>
                            {userProfile?.brokerPreferencia ? 
                              getBrokerDisplayName(userProfile.brokerPreferencia) : 
                              'No especificado'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información sobre seguridad de pagos */}
                  <div className={styles.securityNotice}>
                    <div className={styles.securityIcon}>
                      🔒
                    </div>
                    <div className={styles.securityText}>
                      <h4>Seguridad en Pagos</h4>
                      <p>
                        Por tu seguridad, no almacenamos información de tarjetas de crédito. 
                        Todos los pagos se procesan de forma segura a través de <strong>Mercado Pago</strong> y <strong>transferencia bancaria </strong> 
                         al momento de realizar cada compra.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Mis Compras */}
              {activeSection === 2 && (
                <motion.div
                  className={styles.sectionContent}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <UserSubscriptions />
                </motion.div>
              )}

              {/* Notificaciones */}
              {activeSection === 3 && (
                <NotificationsSection />
              )}

              {/* Telegram */}
              {activeSection === 4 && (
                <motion.div
                  className={styles.sectionContent}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                >
                  <div className={styles.sectionHeader}>
                    <h2>Vincular Telegram</h2>
                  </div>

                  {/* Estado actual */}
                  <div className={styles.infoGrid}>
                    <div className={styles.infoCard} style={{ gridColumn: '1 / -1' }}>
                      <div className={styles.cardIcon}>
                        <Send size={24} />
                      </div>
                      <h3>Estado de Vinculación</h3>
                      
                      {telegramData.isLinked ? (
                        <div style={{ marginTop: '1rem' }}>
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            padding: '1rem',
                            backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            borderRadius: '8px',
                            marginBottom: '1rem'
                          }}>
                            <CheckCircle size={20} color="#10B981" />
                            <span style={{ color: '#10B981', fontWeight: 500 }}>
                              Telegram Vinculado
                            </span>
                          </div>
                          
                          <div className={styles.infoList}>
                            <div className={styles.infoItem}>
                              <span className={styles.label}>ID de Telegram:</span>
                              <span className={styles.value}>{telegramData.telegramUserId}</span>
                            </div>
                            {telegramData.telegramUsername && (
                              <div className={styles.infoItem}>
                                <span className={styles.label}>Username:</span>
                                <span className={styles.value}>@{telegramData.telegramUsername}</span>
                              </div>
                            )}
                            {telegramData.linkedAt && (
                              <div className={styles.infoItem}>
                                <span className={styles.label}>Vinculado el:</span>
                                <span className={styles.value}>
                                  {new Date(telegramData.linkedAt).toLocaleDateString('es-AR')}
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={handleUnlinkTelegram}
                            disabled={telegramLoading}
                            style={{
                              marginTop: '1rem',
                              padding: '0.75rem 1.5rem',
                              backgroundColor: '#EF4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.9rem'
                            }}
                          >
                            <Unlink size={16} />
                            {telegramLoading ? 'Desvinculando...' : 'Desvincular Telegram'}
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: '1rem' }}>
                          {!linkCode ? (
                            <>
                              <div style={{ 
                                padding: '1.25rem',
                                backgroundColor: '#EFF6FF',
                                borderRadius: '10px',
                                marginBottom: '1.5rem',
                                border: '2px solid #3B82F6'
                              }}>
                                <p style={{ margin: 0, color: '#1E3A8A', fontSize: '0.95rem', lineHeight: '1.7', fontWeight: 500 }}>
                                  <strong style={{ color: '#1E40AF', fontSize: '1.05rem' }}>🔗 Elige cómo vincular tu cuenta</strong><br />
                                  <span style={{ color: '#1E3A8A', marginTop: '0.5rem', display: 'block' }}>
                                    Puedes generar un código aquí en la web o recibirlo por email. ¡Tú eliges!
                                  </span>
                                </p>
                              </div>

                              <div style={{ 
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                gap: '1rem',
                                marginBottom: '1.5rem'
                              }}>
                                {/* Opción 1: Generar código en web */}
                                <div style={{ 
                                  padding: '1.5rem',
                                  backgroundColor: 'white',
                                  borderRadius: '12px',
                                  border: '2px solid #E5E7EB',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '1rem',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = '#3B82F6';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#E5E7EB';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '10px',
                                      backgroundColor: '#3B82F6',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '1.25rem'
                                    }}>
                                      📱
                                    </div>
                                    <h4 style={{ margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 600 }}>
                                      Ver código aquí
                                    </h4>
                                  </div>
                                  <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                    Genera un código y cópialo para enviarlo al bot de Telegram
                                  </p>
                                  <button
                                    onClick={handleGenerateLinkCode}
                                    disabled={generatingCode || sendingEmail}
                                    style={{
                                      padding: '0.875rem 1.5rem',
                                      backgroundColor: '#3B82F6',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: (generatingCode || sendingEmail) ? 'not-allowed' : 'pointer',
                                      opacity: (generatingCode || sendingEmail) ? 0.6 : 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.5rem',
                                      fontSize: '0.95rem',
                                      fontWeight: 600,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <Link2 size={18} />
                                    {generatingCode ? 'Generando...' : 'Generar Código'}
                                  </button>
                                </div>

                                {/* Opción 2: Enviar por email */}
                                <div style={{ 
                                  padding: '1.5rem',
                                  backgroundColor: 'white',
                                  borderRadius: '12px',
                                  border: '2px solid #E5E7EB',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '1rem',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = '#10B981';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#E5E7EB';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{
                                      width: '40px',
                                      height: '40px',
                                      borderRadius: '10px',
                                      backgroundColor: '#10B981',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontSize: '1.25rem'
                                    }}>
                                      📧
                                    </div>
                                    <h4 style={{ margin: 0, color: '#111827', fontSize: '1.05rem', fontWeight: 600 }}>
                                      Recibir por email
                                    </h4>
                                  </div>
                                  <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: '1.6' }}>
                                    Te enviaremos el código a tu correo electrónico para mayor comodidad
                                  </p>
                                  <button
                                    onClick={handleSendCodeByEmail}
                                    disabled={generatingCode || sendingEmail}
                                    style={{
                                      padding: '0.875rem 1.5rem',
                                      backgroundColor: '#10B981',
                                      color: 'white',
                                      border: 'none',
                                      borderRadius: '8px',
                                      cursor: (generatingCode || sendingEmail) ? 'not-allowed' : 'pointer',
                                      opacity: (generatingCode || sendingEmail) ? 0.6 : 1,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.5rem',
                                      fontSize: '0.95rem',
                                      fontWeight: 600,
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    <Mail size={18} />
                                    {sendingEmail ? 'Enviando...' : 'Enviar por Email'}
                                  </button>
                                </div>
                              </div>

                              <div style={{ 
                                padding: '1rem',
                                backgroundColor: '#FEF3C7',
                                borderRadius: '8px',
                                border: '1px solid #FCD34D'
                              }}>
                                <p style={{ margin: 0, color: '#92400E', fontSize: '0.85rem', lineHeight: '1.6' }}>
                                  <strong style={{ color: '#78350F' }}>💡 Tip:</strong> Si una opción no funciona, prueba con la otra. Ambas generan el mismo código válido.
                                </p>
                              </div>
                            </>
                          ) : (
                            <div style={{ marginTop: '1rem' }}>
                              <div style={{ 
                                padding: '1.5rem',
                                backgroundColor: '#ECFDF5',
                                borderRadius: '12px',
                                border: '2px solid #10B981',
                                marginBottom: '1.5rem',
                                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '1rem',
                                  marginBottom: '1rem'
                                }}>
                                  <div style={{
                                    width: '56px',
                                    height: '56px',
                                    borderRadius: '12px',
                                    backgroundColor: '#10B981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.75rem',
                                    fontWeight: 700,
                                    color: 'white',
                                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                                  }}>
                                    {linkCode}
                                  </div>
                                  <div>
                                    <h4 style={{ margin: 0, color: '#065F46', fontSize: '1.15rem', fontWeight: 600 }}>
                                      Código Generado
                                    </h4>
                                    <p style={{ margin: '0.25rem 0 0', color: '#047857', fontSize: '0.9rem', fontWeight: 500 }}>
                                      ⏰ {linkCodeExpiresAt && `Expira en ${Math.ceil((linkCodeExpiresAt.getTime() - Date.now()) / 1000 / 60)} minutos`}
                                    </p>
                                  </div>
                                </div>

                                <div style={{
                                  padding: '1.25rem',
                                  backgroundColor: 'white',
                                  borderRadius: '10px',
                                  marginBottom: '1rem',
                                  border: '1px solid #E5E7EB'
                                }}>
                                  <p style={{ margin: 0, fontSize: '0.95rem', color: '#111827', lineHeight: '1.8', fontWeight: 500 }}>
                                    <strong style={{ color: '#1F2937', fontSize: '1rem' }}>📱 Instrucciones:</strong>
                                  </p>
                                  <ol style={{ margin: '0.75rem 0 0 0', paddingLeft: '1.5rem', color: '#374151', lineHeight: '1.8' }}>
                                    <li style={{ marginBottom: '0.5rem' }}>Abre Telegram</li>
                                    <li style={{ marginBottom: '0.5rem' }}>
                                      {botUsername ? (
                                        <>
                                          Busca el bot: <strong style={{ color: '#0088cc' }}>@{botUsername}</strong> o{' '}
                                          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: '#0088cc', textDecoration: 'underline', fontWeight: 600 }}>abre este link</a>
                                        </>
                                      ) : (
                                        'Busca el bot de Telegram'
                                      )}
                                    </li>
                                    <li style={{ marginBottom: '0.5rem' }}>
                                      Envía este código: <strong style={{ fontSize: '1.3rem', color: '#10B981', fontWeight: 700, letterSpacing: '2px' }}>{linkCode}</strong>
                                    </li>
                                    <li>El bot te confirmará cuando esté vinculado</li>
                                  </ol>
                                </div>

                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(linkCode);
                                    toast.success('Código copiado al portapapeles');
                                  }}
                                  style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: 'white',
                                    color: '#10B981',
                                    border: '2px solid #10B981',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    width: 'fit-content',
                                    marginRight: '1rem'
                                  }}
                                >
                                  <Copy size={16} />
                                  Copiar Código
                                </button>

                                <button
                                  onClick={handleGenerateLinkCode}
                                  disabled={generatingCode}
                                  style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#F59E0B',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: generatingCode ? 'not-allowed' : 'pointer',
                                    opacity: generatingCode ? 0.6 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    width: 'fit-content'
                                  }}
                                >
                                  <RefreshCw size={16} />
                                  Generar Nuevo Código
                                </button>
                              </div>

                              <div style={{ 
                                padding: '1rem',
                                backgroundColor: '#DBEAFE',
                                borderRadius: '8px',
                                border: '1px solid #93C5FD'
                              }}>
                                <p style={{ margin: 0, color: '#1E3A8A', fontSize: '0.9rem', lineHeight: '1.7', fontWeight: 500 }}>
                                  💡 <strong style={{ color: '#1E40AF' }}>Tip:</strong> Si no encuentras el bot, puedes usar el comando /start en cualquier chat de Telegram y luego buscar el bot por su nombre.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Links de invitación a canales - Solo si está vinculado */}
                  {telegramData.isLinked && (
                    <div className={styles.infoGrid} style={{ marginTop: '2rem' }}>
                      <div className={styles.infoCard} style={{ gridColumn: '1 / -1' }}>
                        <div className={styles.cardIcon}>
                          <ExternalLink size={24} />
                        </div>
                        <h3>Canales de Alertas</h3>
                        <p style={{ color: '#9CA3AF', fontSize: '0.9rem', marginTop: '0.5rem' }}>
                          Únete a los canales de alertas de los servicios a los que estás suscrito.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                          {/* TraderCall */}
                          <div style={{
                            padding: '1rem',
                            backgroundColor: hasActiveSubscription('TraderCall') 
                              ? 'rgba(59, 130, 246, 0.1)' 
                              : 'rgba(107, 114, 128, 0.1)',
                            borderRadius: '8px',
                            border: hasActiveSubscription('TraderCall') 
                              ? '1px solid rgba(59, 130, 246, 0.2)' 
                              : '1px solid rgba(107, 114, 128, 0.2)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                              <div>
                                <h4 style={{ margin: 0, color: hasActiveSubscription('TraderCall') ? '#3B82F6' : '#6B7280' }}>
                                  📊 Trader Call
                                </h4>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#9CA3AF' }}>
                                  Canal de alertas de corto-mediano plazo
                                </p>
                              </div>
                              
                              {hasActiveSubscription('TraderCall') ? (
                                <a
                                  href={TELEGRAM_CHANNEL_LINKS.TraderCall}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#0088cc',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                    fontSize: '0.9rem'
                                  }}
                                >
                                  <Send size={16} />
                                  Unirse al Canal
                                </a>
                              ) : (
                                <div style={{
                                  padding: '0.75rem 1.5rem',
                                  backgroundColor: 'rgba(107, 114, 128, 0.2)',
                                  borderRadius: '8px',
                                  color: '#9CA3AF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  fontSize: '0.85rem'
                                }}>
                                  <AlertTriangle size={16} />
                                  Requiere suscripción activa
                                </div>
                              )}
                            </div>
                          </div>

                          {/* SmartMoney */}
                          <div style={{
                            padding: '1rem',
                            backgroundColor: hasActiveSubscription('SmartMoney') 
                              ? 'rgba(168, 85, 247, 0.1)' 
                              : 'rgba(107, 114, 128, 0.1)',
                            borderRadius: '8px',
                            border: hasActiveSubscription('SmartMoney') 
                              ? '1px solid rgba(168, 85, 247, 0.2)' 
                              : '1px solid rgba(107, 114, 128, 0.2)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                              <div>
                                <h4 style={{ margin: 0, color: hasActiveSubscription('SmartMoney') ? '#A855F7' : '#6B7280' }}>
                                  💰 Smart Money
                                </h4>
                                <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#9CA3AF' }}>
                                  Canal de alertas de largo plazo
                                </p>
                              </div>
                              
                              {hasActiveSubscription('SmartMoney') ? (
                                <a
                                  href={TELEGRAM_CHANNEL_LINKS.SmartMoney}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    padding: '0.75rem 1.5rem',
                                    backgroundColor: '#0088cc',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                    fontSize: '0.9rem'
                                  }}
                                >
                                  <Send size={16} />
                                  Unirse al Canal
                                </a>
                              ) : (
                                <div style={{
                                  padding: '0.75rem 1.5rem',
                                  backgroundColor: 'rgba(107, 114, 128, 0.2)',
                                  borderRadius: '8px',
                                  color: '#9CA3AF',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.5rem',
                                  fontSize: '0.85rem'
                                }}>
                                  <AlertTriangle size={16} />
                                  Requiere suscripción activa
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div style={{ 
                          marginTop: '1.5rem', 
                          padding: '1rem', 
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          color: '#10B981'
                        }}>
                          <strong>💡 Información:</strong>
                          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                            <li>Solo puedes unirte a los canales de los servicios que tengas activos (pago o prueba)</li>
                            <li>Una vez dentro del canal, recibirás las alertas en tiempo real</li>
                            <li>Si tu suscripción expira, deberás renovar para seguir recibiendo alertas</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Modal de Edición del Perfil */}
        {showEditModal && (
          <div className={styles.modalOverlay} onClick={() => setShowEditModal(false)}>
            <motion.div
              className={styles.modal}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Editar Información Personal</h2>
                <button 
                  className={styles.closeButton}
                  onClick={() => setShowEditModal(false)}
                >
                  <X size={24} />
                </button>
              </div>

              <div className={styles.modalContent}>
                <form className={styles.editForm} onSubmit={handleSaveProfile}>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label htmlFor="fullName">Nombre y Apellido</label>
                      <input
                        type="text"
                        id="fullName"
                        value={formData.fullName}
                        className={styles.formInput}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="cuitCuil">CUIT/CUIL</label>
                      <input
                        type="text"
                        id="cuitCuil"
                        value={formData.cuitCuil}
                        placeholder="Ej: 20-12345678-9"
                        className={styles.formInput}
                        onChange={(e) => setFormData({ ...formData, cuitCuil: e.target.value })}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="email">Correo Electrónico</label>
                      <input
                        type="email"
                        id="email"
                        value={userProfile?.email || ''}
                        className={styles.formInput}
                        disabled
                      />
                      <small className={styles.formNote}>
                        El email no se puede modificar por seguridad
                      </small>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="educacionFinanciera">Educación Financiera</label>
                      <select 
                        id="educacionFinanciera" 
                        className={styles.formSelect} 
                        value={formData.educacionFinanciera}
                        onChange={(e) => setFormData({ ...formData, educacionFinanciera: e.target.value })}
                      >
                        <option value="">Seleccionar nivel</option>
                        <option value="principiante">Principiante</option>
                        <option value="intermedio">Intermedio</option>
                        <option value="avanzado">Avanzado</option>
                        <option value="experto">Experto</option>
                      </select>
                    </div>

                    <div className={styles.formGroup}>
                      <label htmlFor="brokerPreferencia">Broker de Preferencia</label>
                      <select 
                        id="brokerPreferencia" 
                        className={styles.formSelect}
                        value={formData.brokerPreferencia}
                        onChange={(e) => setFormData({ ...formData, brokerPreferencia: e.target.value })}
                      >
                        <option value="">Seleccionar broker</option>
                        <option value="bull-market">Bull Market</option>
                        <option value="iol">IOL</option>
                        <option value="portfolio-personal">Portfolio Personal</option>
                        <option value="cocos-capital">Cocos Capital</option>
                        <option value="eco-valores">Eco Valores</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                  </div>

                  <div className={styles.modalActions}>
                    <button 
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => setShowEditModal(false)}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className={styles.saveButton}
                      disabled={isLoading}
                    >
                      {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {notification.show && (
        <motion.div
          className={`${styles.toast} ${styles[notification.type]}`}
          initial={{ opacity: 0, y: 50, x: '50%' }}
          animate={{ opacity: 1, y: 0, x: '50%' }}
          exit={{ opacity: 0, y: 50, x: '50%' }}
          transition={{ duration: 0.3 }}
        >
          <div className={styles.toastIcon}>
            {notification.type === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
          </div>
          <span className={styles.toastMessage}>{notification.message}</span>
          <button 
            className={styles.toastClose}
            onClick={() => setNotification({ show: false, type: 'success', message: '' })}
          >
            <X size={16} />
          </button>
        </motion.div>
      )}

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (!session) {
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }

  return {
    props: {
      session,
    },
  };
};