import React, { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../lib/googleAuth';
import dynamic from 'next/dynamic';

// ✅ OPTIMIZADO: Modales cargados dinámicamente para reducir bundle inicial
const ReportViewModal = dynamic(() => import('@/components/alerts/ReportViewModal'), {
  ssr: false,
  loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
});

const CreateReportModal = dynamic(() => import('@/components/alerts/CreateReportModal'), {
  ssr: false,
  loading: () => <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>
});

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VideoPlayerMux from '@/components/VideoPlayerMux';
import YouTubePlayer from '@/components/YouTubePlayer';
import SubscriptionBanner from '@/components/SubscriptionBanner';

import Carousel from '@/components/Carousel';
import ImageUploader, { CloudinaryImage } from '@/components/ImageUploader';
import AlertExamplesCarousel from '@/components/AlertExamplesCarousel';
import FAQAccordion from '@/components/FAQAccordion';
import SP500Comparison from '@/components/SP500Comparison';
// ✅ OPTIMIZADO: Usar LazyMotion para reducir el bundle de framer-motion (~60% más pequeño)
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown,
  Users, 
  Activity, 
  Download, 
  BarChart3,
  CheckCircle,
  Star,
  Bell,
  Filter,
  Search,
  MessageCircle,
  Clock,
  ThumbsUp,
  Send,
  Reply,
  X,
  AlertTriangle,
  DollarSign,
  PlusCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader,
  ChevronLeft,
  ChevronRight,
  Trash2
} from 'lucide-react';
import styles from '@/styles/SmartMoney.module.css';
import { useRouter } from 'next/router';
import { calculateDaysRemaining, calculateDaysSinceSubscription } from '../../utils/dateUtils';
import { htmlToText, textToHtml } from '../../lib/textUtils';
import SPY500Indicator from '@/components/SPY500Indicator';
import PortfolioTimeRange from '@/components/PortfolioTimeRange';
import { usePricing } from '@/hooks/usePricing';
import ScreenshotProtection from '@/components/ScreenshotProtection';
import OperationsTable from '@/components/OperationsTable';
import { toast } from 'react-hot-toast';
import TrialUsedModal from '@/components/TrialUsedModal';

interface AlertExample {
  id: string;
  title: string;
  description: string;
  chartImage?: string;
  entryPrice: string;
  exitPrice: string;
  profit: string;
  profitPercentage: string;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
  country: string;
  ticker: string;
  order: number;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'smart-money' | 'trader-call' | 'general';
  order: number;
  visible: boolean;
}

interface HistoricalAlert {
  date: string;
  riskLevel: 'BAJO' | 'MEDIO' | 'ALTO';
  status: 'CERRADO TP1' | 'CERRADO TP1 Y SL' | 'CERRADO SL';
  country: string;
  ticker: string;
  entryPrice: string;
  currentPrice: string;
  takeProfit1: string;
  takeProfit2?: string;
  stopLoss?: string;
  div?: string;
  exitPrice: string;
  profitPercentage: string;
}

interface SmartMoneyPageProps {
  isSubscribed: boolean;
  metrics: {
    performance: string;
    activeUsers: string;
    alertsSent: string;
    accuracy: string;
  };
  historicalAlerts: HistoricalAlert[];
  alertExamples: AlertExample[];
  faqs: FAQ[];
  smartHeroVideo?: {
    youtubeId?: string;
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
  };
}

// Vista No Suscripto
const NonSubscriberView: React.FC<{ 
  metrics: any, 
  historicalAlerts: HistoricalAlert[], 
  alertExamples: AlertExample[], 
  faqs: FAQ[],
  smartHeroVideo?: {
    youtubeId?: string;
    title?: string;
    autoplay?: boolean;
    muted?: boolean;
    loop?: boolean;
  }
}> = ({ 
  metrics, 
  historicalAlerts,
  alertExamples,
  faqs,
  smartHeroVideo
}) => {
  const { data: session } = useSession();
  const { pricing, loading: pricingLoading } = usePricing();

  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingTrial, setIsProcessingTrial] = useState(false);
  const [showTrialUsedModal, setShowTrialUsedModal] = useState(false);
  const [hasUsedTrial, setHasUsedTrial] = useState(false); // ✅ NUEVO: Verificar si ya usó el trial
  // Rango de rentabilidad (vista pública)
  const [publicPortfolioRange, setPublicPortfolioRange] = useState('30d');

  // ✅ NUEVO: Verificar si el usuario ya usó su prueba gratis
  useEffect(() => {
    const checkTrialStatus = async () => {
      if (!session?.user?.email) {
        setHasUsedTrial(false);
        return;
      }

      try {
        const response = await fetch('/api/user/trial-status?service=SmartMoney');
        if (response.ok) {
          const data = await response.json();
          setHasUsedTrial(data.hasUsedTrial || false);
        }
      } catch (error) {
        // console.error('Error verificando estado del trial:', error);
      }
    };

    checkTrialStatus();
  }, [session]);

  const handleTrial = async () => {
    if (!session) {
      signIn('google');
      return;
    }

    setIsProcessingTrial(true);
    
    try {
      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'SmartMoney',
          currency: 'ARS',
          type: 'trial'
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // console.error('Error creando checkout:', data.error);
        // Si el error es que ya usó el trial, mostrar el modal
        if (data.error && data.error.includes('Ya has utilizado tu prueba')) {
          setShowTrialUsedModal(true);
        } else {
          alert(data.error || 'Error al procesar el pago. Por favor intenta nuevamente.');
        }
      }
    } catch (error) {
      // console.error('Error:', error);
      alert('Error al procesar el pago. Por favor intenta nuevamente');
    } finally {
      setIsProcessingTrial(false);
    }
  };

  const handleSubscribe = async () => {
    if (!session) {
      signIn('google');
      return;
    }

    setIsProcessing(true);
    
    try {
      // Obtener el precio dinámico del sistema (requerido)
      const subscriptionPrice = pricing?.alertas?.smartMoney?.monthly;
      if (!subscriptionPrice) {
        toast.error('No se pudo obtener el precio. Intenta nuevamente en unos segundos.');
        setIsProcessing(false);
        return;
      }
      
      const response = await fetch('/api/payments/mercadopago/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          service: 'SmartMoney',
          amount: subscriptionPrice,
          currency: 'ARS',
          type: 'subscription'
        }),
      });

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        // console.error('Error creando checkout:', data.error);
        alert('Error al procesar el pago. Por favor intenta nuevamente.');
      }
    } catch (error) {
      // console.error('Error:', error);
      alert('Error al procesar el pago. Por favor intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportPDF = () => {
    // console.log('Exportando PDF...');
  };

  const exampleImages = [
    {
      src: '/logos/ALERTA SM COMPRA.png',
      alt: 'Ejemplo de alerta Smart Money - Compra',
      title: 'Alerta Smart Money - Compra',
      description: 'Señal de compra siguiendo el dinero inteligente con análisis institucional'
    },
    {
      src: '/logos/ALERTA SM VENTA PARCIAL.png',
      alt: 'Ejemplo de alerta Smart Money - Venta Parcial',
      title: 'Alerta Smart Money - Venta Parcial',
      description: 'Toma de ganancias parcial siguiendo movimientos institucionales'
    },
    {
      src: '/logos/ALERTA SM VENTA PARCIAL 2.png',
      alt: 'Ejemplo de alerta Smart Money - Venta Parcial 2',
      title: 'Alerta Smart Money - Venta Parcial 2',
      description: 'Segunda toma de ganancias parcial con análisis de flujo institucional'
    },
    {
      src: '/logos/ALERTA SM VENTA TOTAL.png',
      alt: 'Ejemplo de alerta Smart Money - Venta Total',
      title: 'Alerta Smart Money - Venta Total',
      description: 'Cierre completo de posición siguiendo salida del dinero inteligente'
    }
  ];

  return (
    <div className={styles.nonSubscriberView}>
      <TrialUsedModal
        isOpen={showTrialUsedModal}
        onClose={() => setShowTrialUsedModal(false)}
        onSubscribe={handleSubscribe}
        serviceName="SmartMoney"
      />
      {/* ✅ OPTIMIZADO: LazyMotion reduce el bundle de framer-motion ~60% */}
      <LazyMotion features={domAnimation}>
      {/* Hero Section con Imagen de Fondo */}
      <section className={styles.heroSection}>
        {/* Image Background */}
        <div className={styles.imageBackground}>
          <div className={styles.imageOverlay}></div>
        </div>
        
        <div className={styles.container}>
          <m.div 
            className={styles.heroContent}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <div className={styles.heroText}>
              <h1 className={styles.heroTitle}>
                Smart Money
              </h1>
              <p className={styles.heroDescription}>
                Servicio de alertas de compra y venta con estrategia de corto plazo, informes detallados y seguimiento activo, para que puedas invertir en CEDEARs y acciones de forma simple y estratégica. Ideal para quienes buscan grandes rendimientos.
              </p>
              <div className={styles.heroFeatures}>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {!hasUsedTrial && (
                    <button 
                      className={styles.heroFeature}
                      onClick={handleTrial}
                      disabled={isProcessingTrial}
                      style={{ 
                        backgroundColor: '#10b981', 
                        borderColor: '#10b981',
                        flex: '1',
                        minWidth: '200px'
                      }}
                    >
                      {isProcessingTrial ? (
                        <>
                          <Loader size={20} />
                          Procesando...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={20} />
                          <span>Probar por 30 días</span>
                        </>
                      )}
                    </button>
                  )}
                <button 
                  className={styles.heroFeature}
                  onClick={handleSubscribe}
                  disabled={isProcessing}
                    style={{ flex: '1', minWidth: '200px' }}
                >
                  {isProcessing ? (
                    <>
                      <Loader size={20} />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={20} />
                        <span>Suscribirme</span>
                    </>
                  )}
                </button>
                </div>
                {!hasUsedTrial && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    textAlign: 'center',
                    marginTop: '8px',
                    fontStyle: 'italic',
                    lineHeight: '1.4'
                  }}>
                    * El pago es a modo de comprobación de identidad
                  </p>
                )}
                <div className={styles.heroPricing}>
                  <span className={styles.price}>
                    {pricingLoading ? (
                      'Cargando precio...'
                    ) : pricing ? (
                      `$${pricing.alertas.smartMoney.monthly} ARS/mes`
                    ) : (
                      '$15000 ARS/mes'
                    )}
                  </span>
                </div>
              </div>
            </div>
            <div className={styles.heroVideo}>
              <div className={styles.videoContainer}>
                {smartHeroVideo?.youtubeId ? (
                  <YouTubePlayer
                    videoId={smartHeroVideo.youtubeId}
                    title={smartHeroVideo.title || 'Smart Money - Video'}
                    autoplay={!!smartHeroVideo.autoplay}
                    muted={!!smartHeroVideo.muted}
                    loop={!!smartHeroVideo.loop}
                    controls={true}
                    className={styles.video}
                    fillContainer={true}
                  />
                ) : (
                  <YouTubePlayer
                    videoId="dQw4w9WgXcQ"
                    title="Smart Money - Video"
                    autoplay={false}
                    muted={true}
                    loop={false}
                    controls={true}
                    className={styles.video}
                    fillContainer={true}
                  />
                )}
              </div>
            </div>
          </m.div>
        </div>
      </section>

      {/* Ejemplo de Alertas */}
      <section className={styles.examplesSection}>
        <div className={styles.container}>
          <m.h2 
            className={styles.sectionTitle}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Ejemplo de Alertas
          </m.h2>
          
          <m.div 
            className={styles.carouselContainer}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <AlertExamplesCarousel 
              examples={alertExamples}
              autoplay={true}
              interval={5000}
            />
          </m.div>
        </div>
      </section>


      {/* Evolución del Portafolio Real */}
      <section className={styles.historySection}>
        <div className={styles.container}>
          <PortfolioTimeRange 
            selectedRange={publicPortfolioRange}
            onRangeChange={(range) => setPublicPortfolioRange(range)}
            serviceType="SmartMoney"
          />
        </div>
      </section>

      {/* Rendimiento Comparado */}
      <section className={styles.comparisonSection}>
        <div className={styles.container}>
          <SP500Comparison serviceType="SmartMoney" />
        </div>
      </section>

      {/* Preguntas Frecuentes */}
      <section className={styles.faqSection}>
        <div className={styles.container}>
          <m.h2 
            className={styles.sectionTitle}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Preguntas Frecuentes
          </m.h2>
          
          <m.div 
            className={styles.faqContainer}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <FAQAccordion 
              faqs={faqs}
              category="smart-money"
              maxItems={10}
            />
          </m.div>
        </div>
      </section>

      {/* CTA Final */}
      <section className={styles.finalCtaSection}>
        <div className={styles.container}>
          <m.div 
            className={styles.finalCtaCard}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className={styles.finalCtaContent}>
              <h2 className={styles.finalCtaTitle}>
                ¿Listo para llevar tus inversiones al siguiente nivel?
              </h2>
              <p className={styles.finalCtaDescription}>
                Únete a nuestra comunidad y comienza construir tu libertad financiera
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {!hasUsedTrial && (
                  <button 
                    className={styles.finalCtaButton}
                    onClick={handleTrial}
                    disabled={isProcessingTrial}
                    style={{ 
                      backgroundColor: '#10b981', 
                      borderColor: '#10b981',
                      minWidth: '200px'
                    }}
                  >
                    {isProcessingTrial ? (
                      <>
                        <Loader size={16} className={styles.spinner} />
                        Procesando...
                      </>
                    ) : (
                      'Probar por 30 días >'
                    )}
                  </button>
                )}
              <button 
                className={styles.finalCtaButton}
                onClick={handleSubscribe}
                disabled={isProcessing}
                  style={{ minWidth: '200px' }}
              >
                {isProcessing ? (
                  <>
                    <Loader size={16} className={styles.spinner} />
                    Procesando...
                  </>
                ) : session ? (
                    'Suscribirme >'
                ) : (
                  'Iniciar Sesión y Suscribirme >'
                )}
              </button>
              </div>
              {!hasUsedTrial && (
                <p style={{
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                  textAlign: 'center',
                  marginTop: '12px',
                  fontStyle: 'italic',
                  lineHeight: '1.4'
                }}>
                  * El pago es a modo de comprobación de identidad
                </p>
              )}
            </div>
          </m.div>
        </div>
      </section>

      {/* YouTube Community Section */}
      <section className={styles.youtubeSection}>
        <div className="container">
          <m.div
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
          </m.div>
        </div>
      </section>
      </LazyMotion>
    </div>
  );
};

// Interfaces para tipos
interface CommunityMessage {
  id: number;
  user: string;
  message: string;
  timestamp: string;
}

// Vista de suscriptor completa
const SubscriberView: React.FC<{ faqs: FAQ[] }> = ({ faqs }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [communityMessages, setCommunityMessages] = useState<CommunityMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateAlert, setShowCreateAlert] = useState(false);
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    action: 'BUY',
    stopLoss: '',
    takeProfit: '',
    analysis: '',
    tipoAlerta: 'precio' as 'precio' | 'rango',
    precioMinimo: '',
    precioMaximo: '',
    horarioCierre: '17:30',
    emailMessage: '',
    emailImageUrl: '',
    liquidityPercentage: 0, // Nuevo campo para el porcentaje de liquidez
    // ✅ NUEVO: Campos para operaciones históricas
    esOperacionHistorica: false,
    fechaEntrada: '',
    ventasParciales: [] as Array<{ fecha: string; precio: string; porcentajeVendido: string }>
  });
  
  const [emailImage, setEmailImage] = useState<CloudinaryImage | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  
  // Funciones para manejar la subida de imagen
  const handleImageUploaded = (image: CloudinaryImage) => {
    setEmailImage(image);
    setNewAlert(prev => ({ ...prev, emailImageUrl: image.secure_url }));
    setUploadingImage(false);
    // console.log('✅ Imagen de email subida:', image.public_id);
  };

  const handleImageUploadStart = () => {
    setUploadingImage(true);
  };

  const handleImageUploadError = (error: string) => {
    setUploadingImage(false);
    toast.error(`Error subiendo imagen: ${error}`);
  };

  const removeEmailImage = () => {
    setEmailImage(null);
    setNewAlert(prev => ({ ...prev, emailImageUrl: '' }));
  };
  
  const [stockPrice, setStockPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [liquidityMap, setLiquidityMap] = useState<Record<string, { alertId: string; allocatedAmount: number; shares: number; entryPrice: number; currentPrice: number; profitLoss: number; profitLossPercentage: number; realizedProfitLoss: number }>>({});
  // ✅ NUEVO: Mapa de distribuciones individuales por alertId (para el gráfico de torta)
  const [liquidityMapByAlertId, setLiquidityMapByAlertId] = useState<Record<string, { alertId: string; symbol: string; allocatedAmount: number; shares: number; entryPrice: number; currentPrice: number; profitLoss: number; profitLossPercentage: number; realizedProfitLoss: number }>>({});
  const [liquidityTotal, setLiquidityTotal] = useState<number>(0);
  
  // ✅ NUEVO: Estado para el resumen completo de liquidez
  const [liquiditySummary, setLiquiditySummary] = useState({
    liquidezInicial: 0,
    liquidezTotal: 0,
    liquidezDisponible: 0,
    liquidezDistribuida: 0,
    ganancia: 0,
    gananciaPorcentaje: 0,
    porcentajeRestante: 0  // ✅ NUEVO: % restante
  });

  // Estados para edición de alertas
  const [showEditAlert, setShowEditAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);
  const [editAlert, setEditAlert] = useState({
    symbol: '',
    action: 'BUY',
    entryPrice: '',
    stopLoss: '',
    takeProfit: '',
    analysis: '',
    availableForPurchase: false,
    // ✅ NUEVO: Campos para liquidez y venta rápida
    liquidityPercentage: 0,
    quickSellPercentage: 0
  });
  const [editLoading, setEditLoading] = useState(false);
  
  // Estados para venta parcial
  const [showPartialSaleModal, setShowPartialSaleModal] = useState(false);
  const [partialSaleAlert, setPartialSaleAlert] = useState<any>(null);
  const [partialSaleLoading, setPartialSaleLoading] = useState(false);
  
  // ✅ NUEVO: Estados para venta con rango de precios
  const [sellPercentage, setSellPercentage] = useState<number>(50);
  const [sellPriceMin, setSellPriceMin] = useState<string>('');
  const [sellPriceMax, setSellPriceMax] = useState<string>('');
  const [sellEmailMessage, setSellEmailMessage] = useState<string>('');
  const [sellEmailImageUrl, setSellEmailImageUrl] = useState<string>('');
  const [sellEmailImageFile, setSellEmailImageFile] = useState<File | null>(null);
  const [sellEmailImagePreview, setSellEmailImagePreview] = useState<string>('');
  const [uploadingSellImage, setUploadingSellImage] = useState<boolean>(false);
  
  // Estados para imágenes del gráfico de TradingView
  const [chartImage, setChartImage] = useState<CloudinaryImage | null>(null);
  const [additionalImages, setAdditionalImages] = useState<CloudinaryImage[]>([]);
  const [uploadingChart, setUploadingChart] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // Estado para refrescar operaciones
  const [refreshOperationsTrigger, setRefreshOperationsTrigger] = useState(0);
  const [realAlerts, setRealAlerts] = useState<any[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [updatingPrices, setUpdatingPrices] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [informes, setInformes] = useState<any[]>([]);
  const [loadingInformes, setLoadingInformes] = useState(true);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCreateReportModal, setShowCreateReportModal] = useState(false);
  const [showEditReportModal, setShowEditReportModal] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [creatingReport, setCreatingReport] = useState(false);
  const [userRole, setUserRole] = React.useState<string>('');
  const [refreshingActivity, setRefreshingActivity] = useState(false);
  
  // Estados para filtros
  const [filterSymbol, setFilterSymbol] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  
  // Estados para modales de imágenes
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<CloudinaryImage | null>(null);
  const [showAdditionalImagesModal, setShowAdditionalImagesModal] = useState(false);
  const [selectedAlertImages, setSelectedAlertImages] = useState<CloudinaryImage[]>([]);
  
  // Estados para información del mercado
  const [marketStatus, setMarketStatus] = useState<string>('');
  const [isUsingSimulatedPrices, setIsUsingSimulatedPrices] = useState(false);

  // Estados para paginación de informes
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInformes, setTotalInformes] = useState(0);
  const [informesPerPage] = useState(8);

  const { data: session } = useSession();
  const router = useRouter();

  // Leer query parameter 'tab' para establecer la pestaña activa inicialmente
  React.useEffect(() => {
    if (router.query.tab && typeof router.query.tab === 'string') {
      const validTabs = ['dashboard', 'seguimiento', 'operaciones', 'vigentes', 'informes', 'comunidad', 'faq'];
      if (validTabs.includes(router.query.tab)) {
        setActiveTab(router.query.tab);
      }
    }
  }, [router.query.tab]);

  // Verificar rol del usuario
  React.useEffect(() => {
    const checkUserRole = async () => {
      try {
        // console.log('🔍 Verificando rol del usuario...');
        // console.log('🔍 Sesión actual:', session);
        
        const response = await fetch('/api/profile/get', {
          credentials: 'same-origin',
        });
        
        if (response.ok) {
          const data = await response.json();
          // console.log('✅ Datos del perfil obtenidos:', {
          //   email: data.user?.email,
          //   role: data.user?.role,
          //   success: data.success,
          //   fullResponse: data
          // });
          
          if (data.success && data.user?.role) {
            setUserRole(data.user.role);
            // console.log('👤 Rol del usuario establecido:', data.user.role);
            // console.log('👤 Estado userRole actualizado:', data.user.role);
          } else {
            // console.warn('⚠️ No se pudo obtener el rol del usuario:', data);
            setUserRole('');
          }
        } else {
          // console.error('❌ Error al obtener perfil:', response.status, response.statusText);
          const errorData = await response.json().catch(() => ({}));
          // console.error('❌ Detalles del error:', errorData);
        }
      } catch (error) {
        // console.error('❌ Error al verificar rol:', error);
        setUserRole('');
      }
    };

    if (session?.user) {
      // console.log('🔐 Sesión activa, verificando rol para:', session.user.email);
      checkUserRole();
    } else {
      // console.log('❌ No hay sesión activa');
      setUserRole('');
    }
  }, [session]);

  // Función para calcular métricas reales del dashboard usando alertas reales
  const calculateDashboardMetrics = () => {
    // Usar alertas reales en lugar de datos simulados
    const alertasActivas = realAlerts.filter(alert => alert.status === 'ACTIVE').length;
    const alertasCerradas = realAlerts.filter(alert => alert.status === 'CLOSED');
    
    // Calcular ganadoras y perdedoras basándose en el profit
    const alertasGanadoras = alertasCerradas.filter(alert => {
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace('%', '').replace('+', ''))
        : Number(alert.profit) || 0;
      return profitValue > 0;
    }).length;
    
    const alertasPerdedoras = alertasCerradas.filter(alert => {
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace('%', '').replace('+', ''))
        : Number(alert.profit) || 0;
      return profitValue < 0;
    }).length;
    
    // **CAMBIO: Calcular alertas del año actual (en lugar de semanal)**
    const ahora = new Date();
    const inicioAño = new Date(ahora.getFullYear(), 0, 1);
    const alertasAnuales = realAlerts.filter(alert => {
      const fechaAlert = new Date(alert.date);
      return fechaAlert >= inicioAño;
    }).length;

    // **CAMBIO: Calcular rentabilidad anual usando alertas reales**
    const alertasAnualConGanancias = realAlerts.filter(alert => {
      const fechaAlert = new Date(alert.date);
      return fechaAlert >= inicioAño;
    });

    const gananciasAnual = alertasAnualConGanancias.reduce((total, alert) => {
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace('%', '').replace('+', ''))
        : Number(alert.profit) || 0;
      return total + profitValue;
    }, 0);

    const rentabilidadAnual = gananciasAnual.toFixed(1);

    return {
      alertasActivas,
      alertasGanadoras,
      alertasPerdedoras,
      rentabilidadAnual: `${gananciasAnual >= 0 ? '+' : ''}${rentabilidadAnual}%`,
      alertasAnuales
    };
  };

  // Calcular métricas reactivamente cuando cambien las alertas reales
  const dashboardMetrics = React.useMemo(() => {
    return calculateDashboardMetrics();
  }, [realAlerts]);

  // Generar actividad reciente con alertas e informes
  const generateRecentActivity = () => {
    const activities: any[] = [];
    
    // Agregar alertas recientes
    realAlerts.forEach((alert) => {
      const alertDate = new Date(alert.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - alertDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffTime / (1000 * 60));

      let timestamp;
      if (diffDays > 0) {
        timestamp = `${diffDays}d`;
      } else if (diffHours > 0) {
        timestamp = `${diffHours}h`;
      } else {
        timestamp = `${diffMinutes}min`;
      }

      let message = '';
      let type = 'alert';
      
      if (alert.status === 'ACTIVE') {
        const currentPrice = typeof alert.currentPrice === 'string' 
          ? parseFloat(alert.currentPrice.replace('$', ''))
          : Number(alert.currentPrice) || 0;
        const entryPrice = typeof alert.entryPrice === 'string' 
          ? parseFloat(alert.entryPrice.replace('$', ''))
          : Number(alert.entryPrice) || 0;
        const currentPnL = entryPrice > 0 
          ? ((currentPrice - entryPrice) / entryPrice * 100).toFixed(2)
          : '0.00';
        const pnlValue = parseFloat(currentPnL);
        message = `${alert.symbol} actualizado: ${pnlValue > 0 ? '+' : ''}${currentPnL}% P&L #${alert.symbol}`;
      } else if (alert.status === 'CLOSED') {
        const profitString = String(alert.profit || '0%').replace('%', '').replace('+', '');
        const profit = parseFloat(profitString) || 0;
        message = `${alert.symbol} cerrado: ${profit > 0 ? '+' : ''}${profit.toFixed(2)}% ${profit > 0 ? 'ganancia' : 'pérdida'} #${alert.symbol}`;
      } else {
        const entryPriceFormatted = typeof alert.entryPrice === 'string' 
          ? alert.entryPrice.replace('$', '')
          : String(alert.entryPrice || '0');
        message = `Nueva alerta: ${alert.symbol} ${alert.action} a $${entryPriceFormatted} #${alert.symbol}`;
      }

      activities.push({
        id: alert._id,
        type,
        message,
        timestamp,
        dateCreated: alertDate
      });
    });

    // Agregar informes recientes
    informes.forEach((informe) => {
      const informeDate = new Date(informe.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - informeDate.getTime());
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
      const diffMinutes = Math.floor(diffTime / (1000 * 60));

      let timestamp;
      if (diffDays > 0) {
        timestamp = `${diffDays}d`;
      } else if (diffHours > 0) {
        timestamp = `${diffHours}h`;
      } else {
        timestamp = `${diffMinutes}min`;
      }

      const typeIcon = informe.type === 'video' ? '🎥' : informe.type === 'analisis' ? '📊' : '📄';
      const message = `Nuevo ${informe.type}: ${informe.title} ${typeIcon}`;

      activities.push({
        id: informe.id || informe._id,
        type: 'informe',
        message,
        timestamp,
        dateCreated: informeDate,
        reportData: informe
      });
    });

    // Ordenar por fecha más reciente y tomar los primeros 6
    return activities
      .sort((a, b) => b.dateCreated.getTime() - a.dateCreated.getTime())
      .slice(0, 6);
  };

  // Generar actividad reciente reactivamente cuando cambien las alertas
  const recentActivity = React.useMemo(() => {
    return generateRecentActivity();
  }, [realAlerts, informes]);

  // ✅ NUEVO: Función para cargar alertas vigentes (solo las marcadas como disponibles para compra)
  const loadVigentesAlerts = async () => {
    setLoadingAlerts(true);
    try {
      // ✅ CAMBIO: Usar API global para datos consistentes
      const response = await fetch('/api/alerts/global?tipo=SmartMoney&availableForPurchase=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No incluir credentials para datos globales
      });

      if (response.ok) {
        const data = await response.json();
        setRealAlerts(data.alerts || []);
        // console.log('📊 [GLOBAL] Alertas vigentes cargadas:', data.alerts?.length || 0);
      } else {
        // console.error('Error al cargar alertas vigentes:', response.status);
        setRealAlerts([]); // Establecer array vacío en caso de error
      }
    } catch (error) {
      // console.error('Error al cargar alertas vigentes:', error);
      setRealAlerts([]); // Establecer array vacío en caso de error
    } finally {
      setLoadingAlerts(false);
    }
  };

  // ✅ Función para cargar TODAS las alertas (para seguimiento) - Todas las alertas aparecen en seguimiento
  const loadSeguimientoAlerts = async () => {
    // console.log('🔄 Cargando alertas de seguimiento SmartMoney - versión actualizada');
    setLoadingAlerts(true);
    try {
      // ✅ CAMBIO: Usar API global para datos consistentes
      const response = await fetch('/api/alerts/global?tipo=SmartMoney', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No incluir credentials para datos globales
      });

      if (response.ok) {
        const data = await response.json();
        setRealAlerts(data.alerts || []);
        // console.log('📊 [GLOBAL] Alertas de seguimiento cargadas:', data.alerts?.length || 0);
      } else {
        // console.error('Error al cargar alertas de seguimiento:', response.status);
        setRealAlerts([]); // Establecer array vacío en caso de error
      }
    } catch (error) {
      // console.error('Error al cargar alertas de seguimiento:', error);
      setRealAlerts([]); // Establecer array vacío en caso de error
    } finally {
      setLoadingAlerts(false);
    }
  };

  // ✅ MODIFICADO: Función principal para cargar alertas según la pestaña activa
  const loadAlerts = async () => {
    try {
      if (activeTab === 'vigentes') {
        await loadVigentesAlerts();
      } else if (activeTab === 'seguimiento') {
        await loadSeguimientoAlerts();
      } else {
        // ✅ CORREGIDO: Para dashboard, cargar TODAS las alertas activas (necesario para el gráfico de torta)
        // El gráfico necesita todas las alertas activas con liquidez, no solo las vigentes
        await loadSeguimientoAlerts();
      }
    } catch (error) {
      // console.error('Error cargando alertas:', error);
      // Continuar sin alertas si hay error
    }
  };

  // Función para actualizar precios en tiempo real
  const updatePrices = async (silent: boolean = false) => {
    if (!silent) setUpdatingPrices(true);
    
    try {
      const response = await fetch('/api/alerts/update-prices-manual', {
        method: 'POST',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        // console.log('Precios actualizados:', data.updated, 'alertas');
        setLastPriceUpdate(new Date());
        
        // Actualizar información del mercado
        setIsUsingSimulatedPrices(data.isSimulated || false);
        setMarketStatus(data.marketStatus || 'UNKNOWN');
        
        // Recargar alertas para mostrar los nuevos precios
        await loadAlerts();
      } else {
        // console.error('Error al actualizar precios:', response.status);
      }
    } catch (error) {
      // console.error('Error al actualizar precios:', error);
    } finally {
      if (!silent) setUpdatingPrices(false);
    }
  };

  // Función para cargar informes desde la API con paginación
  const loadInformes = async (page: number = 1) => {
    setLoadingInformes(true);
    try {
      // Filtrar solo informes de Smart Money con paginación
      const response = await fetch(`/api/reports?page=${page}&limit=${informesPerPage}&featured=false&category=smart-money`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        setInformes(data.data?.reports || []);
        setTotalPages(data.data?.pagination?.totalPages || 1);
        setTotalInformes(data.data?.pagination?.total || 0);
        setCurrentPage(page);
        // console.log('Informes Smart Money cargados:', data.data?.reports?.length || 0, 'Página:', page);
      } else {
        // console.error('Error al cargar informes:', response.status);
      }
    } catch (error) {
      // console.error('Error al cargar informes:', error);
    } finally {
      setLoadingInformes(false);
    }
  };

  // Funciones para manejar la paginación
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadInformes(page);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  // Función para abrir informe completo - Ahora redirige a la página de reportes
  const openReport = async (reportId: string) => {
    try {
      // console.log('🔍 Redirigiendo a informe:', reportId);
      
      // Redirigir directamente a la página de reportes individuales
      router.push(`/reports/${reportId}`);
      
    } catch (error) {
      // console.error('Error al redirigir al informe:', error);
      alert('Error al abrir el informe. Intenta nuevamente.');
    }
  };

  const closeReportModal = () => {
    setShowReportModal(false);
    setSelectedReport(null);
  };

  const handleCreateReport = async (formData: any) => {
    setCreatingReport(true);
    try {
      // Convertir el contenido de texto plano a HTML antes de enviar
      const dataToSend = {
        ...formData,
        content: textToHtml(formData.content || ''), // Convertir texto plano a HTML
        category: 'smart-money' // Asignar categoría Smart Money
      };

      // console.log('📤 Enviando datos del informe:', {
      //   title: dataToSend.title,
      //   type: dataToSend.type,
      //   category: dataToSend.category,
      //   readTime: dataToSend.readTime,
      //   hasArticles: !!dataToSend.articles,
      //   articlesCount: dataToSend.articles?.length || 0
      // });
      
      const response = await fetch('/api/reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      // console.log('📡 Respuesta recibida del servidor:', response.status);

      if (response.ok) {
        const result = await response.json();
        // console.log('✅ Informe Smart Money creado exitosamente:', result);
        const newReport = result.data.report;
        setInformes(prev => [newReport, ...prev]);
        setShowCreateReportModal(false);
        // Mostrar mensaje de éxito
        alert('Informe creado exitosamente.');
      } else {
        const errorData = await response.json();
        // console.error('❌ Error del servidor:', errorData);
        alert(`Error: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (error) {
      // console.error('❌ Error al crear informe:', error);
      alert('Error al crear el informe: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      // console.log('🔄 Finalizando creación de informe...');
      setCreatingReport(false);
    }
  };

  const handleEditReportClick = async (report: any) => {
    // console.log('✏️ Editando informe:', report.title);
    
    // Obtener el informe completo desde la API para asegurar que tenemos el contenido completo
    try {
      const reportId = report._id || report.id;
      if (!reportId) {
        // console.error('❌ No se pudo obtener el ID del informe');
        alert('Error: No se pudo identificar el informe a editar');
        return;
      }

      // console.log('📥 Obteniendo informe completo desde API:', reportId);
      const response = await fetch(`/api/reports/${reportId}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const result = await response.json();
        const fullReport = result.data?.report;
        
        if (fullReport) {
          // console.log('✅ Informe completo obtenido:', {
          //   title: fullReport.title,
          //   contentLength: fullReport.content?.length || 0,
          //   hasContent: !!fullReport.content
          // });
          
          setEditingReport(fullReport);
          setShowEditReportModal(true);
        } else {
          // console.error('❌ No se encontró el informe en la respuesta');
          alert('Error: No se pudo cargar el informe completo');
        }
      } else {
        // console.error('❌ Error al obtener informe:', response.status);
        // Si falla, intentar con el reporte que ya tenemos
        setEditingReport(report);
        setShowEditReportModal(true);
      }
    } catch (error) {
      // console.error('❌ Error al obtener informe completo:', error);
      // Si falla, intentar con el reporte que ya tenemos
      setEditingReport(report);
      setShowEditReportModal(true);
    }
  };

  const handleEditReport = async (formData: any) => {
    if (!editingReport) return;

    setCreatingReport(true);
    try {
      // console.log('📝 Editando informe:', editingReport._id || editingReport.id);

      // Convertir el contenido de texto plano a HTML antes de enviar
      const dataToSend = {
        ...formData,
        content: textToHtml(formData.content || ''), // Convertir texto plano a HTML
        category: 'smart-money' // Mantener categoría Smart Money
      };

      // console.log('📤 Enviando datos para actualizar:', {
      //   title: dataToSend.title,
      //   contentLength: dataToSend.content?.length || 0,
      //   contentPreview: dataToSend.content?.substring(0, 100)
      // });

      const response = await fetch(`/api/reports/${editingReport._id || editingReport.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      });

      if (response.ok) {
        const result = await response.json();
        // console.log('✅ Informe editado exitosamente:', result);
        const updatedReport = result.data.report;

        // Actualizar el informe en la lista
        setInformes(prev => prev.map(report =>
          (report._id || report.id) === (editingReport._id || editingReport.id) ? updatedReport : report
        ));

        // Si el informe que se está viendo es el que se editó, actualizarlo
        if (selectedReport && (selectedReport._id || selectedReport.id) === (editingReport._id || editingReport.id)) {
          setSelectedReport(updatedReport);
        }

        setShowEditReportModal(false);
        setEditingReport(null);
        alert('Informe actualizado exitosamente.');
      } else {
        const errorData = await response.json();
        // console.error('❌ Error del servidor:', errorData);
        alert(`Error: ${errorData.message || 'Error desconocido'}`);
      }
    } catch (error) {
      // console.error('❌ Error al editar informe:', error);
      alert('Error al editar el informe: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setCreatingReport(false);
    }
  };

  // Refrescar actividad
  const refreshActivity = async () => {
    setRefreshingActivity(true);
    try {
      // Recargar alertas y informes
      await Promise.all([
        loadAlerts(),
        loadInformes()
      ]);
      // console.log('✅ Actividad actualizada correctamente');
    } catch (error) {
      // console.error('❌ Error al actualizar actividad:', error);
    } finally {
      setRefreshingActivity(false);
    }
  };

  // Función para filtrar alertas
  const getFilteredAlerts = () => {
    let filtered = [...realAlerts];

    // Filtrar por símbolo
    if (filterSymbol) {
      filtered = filtered.filter(alert => 
        alert.symbol && typeof alert.symbol === 'string' && alert.symbol.toLowerCase().includes(filterSymbol.toLowerCase())
      );
    }

    // Filtrar por estado
    if (filterStatus) {
      filtered = filtered.filter(alert => alert.status === filterStatus);
    }

    // Filtrar por fecha
    if (filterDate) {
      const filterDateObj = new Date(filterDate);
      filtered = filtered.filter(alert => {
        const alertDate = new Date(alert.date || alert.createdAt);
        return alertDate >= filterDateObj;
      });
    }

    return filtered;
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilterSymbol('');
    setFilterStatus('');
    setFilterDate('');
  };

  // Cargar alertas y informes al montar el componente
  React.useEffect(() => {
    loadAlerts();
    loadInformes(1); // Cargar primera página
  }, []);

  // ✅ NUEVO: Recargar alertas cuando cambie la pestaña activa
  React.useEffect(() => {
    loadAlerts();
  }, [activeTab]);

  // ✅ OPTIMIZADO: Sistema de actualización automática de precios cada 2 minutos
  React.useEffect(() => {
    // Solo actualizar si hay alertas activas
    const hasActiveAlerts = realAlerts.some(alert => alert.status === 'ACTIVE');
    
    if (!hasActiveAlerts) return;

    // ✅ OPTIMIZADO: Solo actualizar si no se actualizó recientemente
    if (!lastPriceUpdate) {
      updatePrices(true);
    } else {
      const timeSinceLastUpdate = Date.now() - lastPriceUpdate.getTime();
      const shouldUpdate = timeSinceLastUpdate >= 2 * 60 * 1000; // 2 minutos
      
      if (shouldUpdate) {
        updatePrices(true);
      }
    }

    // ✅ OPTIMIZADO: Intervalo más eficiente (2 minutos en lugar de 30 segundos)
    const interval = setInterval(() => {
      const hasActiveAlerts = realAlerts.some(alert => alert.status === 'ACTIVE');
      if (hasActiveAlerts) {
        updatePrices(true); // silent = true para no mostrar loading
      }
    }, 2 * 60 * 1000); // 2 minutos

    return () => clearInterval(interval);
  }, [realAlerts, lastPriceUpdate, updatePrices]);

  // ✅ OPTIMIZADO: Cargar liquidez una sola vez y cachear
  // ✅ MEJORADO: Cargar liquidez con mejor manejo de errores y logging
  const loadLiquidity = async () => {
    try {
      // console.log('🔄 [LIQUIDITY] Iniciando carga de resumen de liquidez para SmartMoney...');
      
      // Agregar timestamp para evitar cache del browser
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/liquidity/summary?pool=SmartMoney&_t=${timestamp}`);
      
      if (res.ok) {
        const json = await res.json();
        // console.log('✅ [LIQUIDITY] Respuesta de API recibida:', {
        //   success: json.success,
        //   hasData: !!json.data,
        //   liquidezTotal: json.data?.liquidezTotal,
        //   distributionsCount: json.data?.distributions?.length || 0
        // });
        
        if (json.success && json.data) {
          // ✅ Mapa consolidado por símbolo (para compatibilidad)
          const map: Record<string, any> = {};
          (json.data?.distributions || []).forEach((d: any) => {
            map[d.symbol] = d;
            // console.log(`📊 [LIQUIDITY] Distribución consolidada cargada: ${d.symbol} - $${d.allocatedAmount}`);
          });
          
          // ✅ NUEVO: Mapa individual por alertId (para el gráfico de torta)
          const mapByAlertId: Record<string, any> = {};
          (json.data?.individualDistributions || []).forEach((d: any) => {
            if (d.alertId) {
              mapByAlertId[d.alertId] = d;
              // console.log(`📊 [LIQUIDITY] Distribución individual cargada: ${d.symbol} (alertId: ${d.alertId}) - $${d.allocatedAmount}`);
            }
          });
          
          setLiquidityMap(map);
          setLiquidityMapByAlertId(mapByAlertId);
          // ✅ NUEVO: Usar liquidez total del nuevo resumen
          setLiquidityTotal(Number(json.data?.liquidezTotal || 0));
          
          // ✅ NUEVO: Guardar todos los datos del resumen para mostrar en la UI
          setLiquiditySummary({
            liquidezInicial: json.data.liquidezInicial || 0,
            liquidezTotal: json.data.liquidezTotal || 0,
            liquidezDisponible: json.data.liquidezDisponible || 0,
            liquidezDistribuida: json.data.liquidezDistribuida || 0,
            ganancia: json.data.ganancia || 0,
            gananciaPorcentaje: json.data.gananciaPorcentaje || 0,
            porcentajeRestante: json.data.porcentajeRestante || 0  // ✅ NUEVO: % restante
          });
          
          // console.log('✅ [LIQUIDITY] Resumen de liquidez cargado exitosamente:', {
          //   mapKeys: Object.keys(map).length,
          //   liquidezInicial: json.data.liquidezInicial,
          //   liquidezTotal: json.data.liquidezTotal,
          //   liquidezDisponible: json.data.liquidezDisponible,
          //   liquidezDistribuida: json.data.liquidezDistribuida,
          //   ganancia: json.data.ganancia
          // });
        } else {
          // console.warn('⚠️ [LIQUIDITY] Respuesta de API sin datos de liquidez');
        }
      } else {
        // console.error('❌ [LIQUIDITY] Error en respuesta de API:', res.status, res.statusText);
      }
    } catch (e) {
      // console.error('❌ [LIQUIDITY] Error cargando liquidez:', e);
    }
  };

  // ✅ ARREGLADO: Cargar liquidez solo una vez al montar el componente
  React.useEffect(() => {
    loadLiquidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Solo ejecutar al montar

  // Función para obtener precio individual de una acción (modal crear alerta)
  const fetchStockPrice = async (symbol: string) => {
    if (!symbol.trim()) {
      alert('Por favor ingresa un símbolo válido');
      return;
    }

    setPriceLoading(true);
    setStockPrice(null);
    
    try {
      // console.log(`🔍 Obteniendo precio para: ${symbol}`);
      
      const response = await fetch(`/api/stock-price?symbol=${symbol.toUpperCase()}`, {
        method: 'GET',
        credentials: 'same-origin',
      });

      if (response.ok) {
        const data = await response.json();
        // console.log(`💰 Precio obtenido para ${symbol}: $${data.price}`);
        // console.log(`📊 Estado del mercado: ${data.marketStatus}`);
        
        const price = data.price;
        setStockPrice(price);
        
        // Si es alerta de rango, llenar el precio mínimo con el precio obtenido
        if (newAlert.tipoAlerta === 'rango') {
          setNewAlert(prev => ({ ...prev, precioMinimo: price.toString() }));
        }
        
      } else {
        // console.error('Error al obtener precio:', response.status);
        alert('Error al obtener el precio. Intenta nuevamente.');
      }
    } catch (error) {
      // console.error('Error al obtener precio:', error);
      alert('Error de conexión. Verifica tu internet e intenta nuevamente.');
    } finally {
      setPriceLoading(false);
    }
  };

  // Funciones para manejar imágenes
  const handleChartImageUploaded = (image: CloudinaryImage) => {
    setChartImage(image);
    setUploadingChart(false);
    // console.log('✅ Gráfico de TradingView subido:', image.public_id);
  };

  const handleAdditionalImageUploaded = (image: CloudinaryImage) => {
    setAdditionalImages(prev => [...prev, image]);
    setUploadingImages(false);
    // console.log('✅ Imagen adicional subida:', image.public_id);
  };

  const removeChartImage = () => {
    setChartImage(null);
  };

  const removeAdditionalImage = (indexToRemove: number) => {
    setAdditionalImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const updateImageCaption = (index: number, caption: string) => {
    setAdditionalImages(prev => prev.map((img, i) => 
      i === index ? { ...img, caption } : img
    ));
  };

  // Funciones para manejar modales de imágenes
  const handleShowChart = (chartImage: CloudinaryImage) => {
    setSelectedImage(chartImage);
    setShowImageModal(true);
  };

  const handleShowAdditionalImages = (images: CloudinaryImage[]) => {
    setSelectedAlertImages(images);
    setShowAdditionalImagesModal(true);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  const closeAdditionalImagesModal = () => {
    setShowAdditionalImagesModal(false);
    setSelectedAlertImages([]);
  };

  const handleCreateAlert = async () => {
    // Validación: Solo requerir stockPrice para alertas de precio específico
    if (!newAlert.symbol || (newAlert.tipoAlerta === 'precio' && !stockPrice)) {
      alert('Por favor completa todos los campos obligatorios');
      return;
    }
    
    // Validación para alertas de rango
    if (newAlert.tipoAlerta === 'rango') {
      if (!newAlert.precioMinimo || !newAlert.precioMaximo) {
        alert('Por favor completa el precio mínimo y máximo del rango');
        return;
      }
      if (parseFloat(newAlert.precioMinimo) >= parseFloat(newAlert.precioMaximo)) {
        alert('El precio mínimo debe ser menor al precio máximo');
        return;
      }
    }
    
    // ✅ NUEVO: Validar que haya suficiente liquidez disponible
    const liquidityAmount = newAlert.liquidityPercentage > 0 ? (liquidityTotal * newAlert.liquidityPercentage / 100) : 0;
    if (liquidityAmount > 0) {
      const availableLiquidity = liquiditySummary.liquidezDisponible || 0;
      if (liquidityAmount > availableLiquidity) {
        alert(`❌ Liquidez insuficiente. Disponible: $${availableLiquidity.toFixed(2)}. Intenta asignar: $${liquidityAmount.toFixed(2)}`);
        return;
      }
    }
    
    // ✅ NUEVO: Obtener precio actual para alertas de rango (para entryPrice estático)
    let currentPriceForRange: number | undefined = undefined;
    if (newAlert.tipoAlerta === 'rango') {
      try {
        // console.log(`🔍 Obteniendo precio actual para alerta de rango: ${newAlert.symbol.toUpperCase()}`);
        const priceResponse = await fetch(`/api/stock-price?symbol=${newAlert.symbol.toUpperCase()}`, {
          method: 'GET',
          credentials: 'same-origin',
        });
        
        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          currentPriceForRange = priceData.price;
          // console.log(`✅ Precio actual obtenido para rango: $${currentPriceForRange}`);
        } else {
          // console.warn('⚠️ No se pudo obtener precio actual, se usará el precio mínimo del rango');
          // Si no se puede obtener, usar el precio mínimo como fallback
          currentPriceForRange = parseFloat(newAlert.precioMinimo);
        }
      } catch (error) {
        // console.error('Error obteniendo precio actual para rango:', error);
        // Si falla, usar el precio mínimo como fallback
        currentPriceForRange = parseFloat(newAlert.precioMinimo);
      }
    }
    
    // ✅ DEBUG: Log de datos antes de enviar
    // console.log('🔍 [DEBUG] Datos de liquidez antes de enviar:', {
    //   liquidityPercentage: newAlert.liquidityPercentage,
    //   liquidityTotal,
    //   liquidityAmount,
    //   availableLiquidity: liquiditySummary.liquidezDisponible,
    //   symbol: newAlert.symbol.toUpperCase(),
    //   tipoAlerta: newAlert.tipoAlerta,
    //   currentPriceForRange: currentPriceForRange
    // });
    
    setLoading(true);
    try {
      const response = await fetch('/api/alerts/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          tipo: 'SmartMoney',
          symbol: newAlert.symbol.toUpperCase(),
          action: newAlert.action,
          // ✅ CORREGIDO: Para alertas de rango, usar el precio actual obtenido como entryPrice estático
          // Para operaciones históricas, usar el precio manual ingresado
          entryPrice: newAlert.esOperacionHistorica 
            ? stockPrice 
            : (newAlert.tipoAlerta === 'precio' ? stockPrice : (currentPriceForRange || parseFloat(newAlert.precioMinimo))),
          stopLoss: parseFloat(newAlert.stopLoss),
          takeProfit: parseFloat(newAlert.takeProfit),
          analysis: newAlert.analysis || '',
          date: new Date().toISOString(),
          chartImage: chartImage,
          images: additionalImages,
          // ✅ NUEVO: Campos para alertas de rango
          tipoAlerta: newAlert.tipoAlerta,
          precioMinimo: newAlert.tipoAlerta === 'rango' ? parseFloat(newAlert.precioMinimo) : undefined,
          precioMaximo: newAlert.tipoAlerta === 'rango' ? parseFloat(newAlert.precioMaximo) : undefined,
          horarioCierre: newAlert.horarioCierre,
          // Campos de email opcionales
          emailMessage: newAlert.emailMessage || undefined,
          emailImageUrl: newAlert.emailImageUrl || (chartImage?.secure_url || chartImage?.url),
          // ✅ NUEVO: Campo de liquidez
          liquidityPercentage: newAlert.liquidityPercentage,
          liquidityAmount: newAlert.liquidityPercentage > 0 ? (liquiditySummary.liquidezTotal * newAlert.liquidityPercentage / 100) : 0,
          // ✅ NUEVO: Campos para operaciones históricas
          esOperacionHistorica: newAlert.esOperacionHistorica,
          fechaEntrada: newAlert.esOperacionHistorica ? newAlert.fechaEntrada : undefined,
          ventasParciales: newAlert.esOperacionHistorica && newAlert.ventasParciales.length > 0
            ? newAlert.ventasParciales.map(v => ({
                fecha: v.fecha,
                precio: parseFloat(v.precio),
                porcentajeVendido: parseFloat(v.porcentajeVendido)
              }))
            : []
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // console.log('✅ Alerta Smart Money creada:', result.alert);
        
        // Recargar alertas y limpiar formulario
        await loadAlerts();
        setNewAlert({
          symbol: '',
          action: 'BUY',
          stopLoss: '',
          takeProfit: '',
          analysis: '',
          tipoAlerta: 'precio',
          precioMinimo: '',
          precioMaximo: '',
          horarioCierre: '17:30',
          emailMessage: '',
          emailImageUrl: '',
          liquidityPercentage: 0,
          esOperacionHistorica: false,
          fechaEntrada: '',
          ventasParciales: []
        });
        setStockPrice(null);
        setChartImage(null);
        setAdditionalImages([]);
        setEmailImage(null);
        setShowCreateAlert(false);
        
        // Refrescar operaciones después de crear alerta (que crea una operación de compra automáticamente)
        // Agregar delay para asegurar que la operación se guarde en la DB
        setTimeout(() => {
          setRefreshOperationsTrigger(prev => prev + 1);
        }, 1000);
        
        alert('¡Alerta de Smart Money creada exitosamente!');
      } else {
        const error = await response.json();
        // console.error('❌ Error del servidor:', error);
        alert(`Error: ${error.error || error.message || 'No se pudo crear la alerta'}`);
      }
    } catch (error) {
      // console.error('Error creating alert:', error);
      alert('Error al crear la alerta');
    } finally {
      setLoading(false);
    }
  };

  // Función para cerrar posición
  const [confirmClose, setConfirmClose] = useState<{open: boolean; alertId?: string; price?: string}>({ open: false });
  const [closeEmailMessage, setCloseEmailMessage] = useState<string>('');
  const [closeEmailImageUrl, setCloseEmailImageUrl] = useState<string>('');
  const [closeEmailImageFile, setCloseEmailImageFile] = useState<File | null>(null);
  const [closeEmailImagePreview, setCloseEmailImagePreview] = useState<string>('');
  const [uploadingCloseImage, setUploadingCloseImage] = useState<boolean>(false);

  const handleClosePosition = async (alertId: string, currentPrice: string) => {
    // console.log('🔍 handleClosePosition llamado con:', { alertId, currentPrice, userRole });
    setConfirmClose({ open: true, alertId, price: currentPrice });
  };

  // ✅ NUEVO: Función para manejar selección de archivo de imagen
  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        alert('❌ Por favor selecciona un archivo de imagen válido');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen debe ser menor a 5MB');
        return;
      }

      setCloseEmailImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setCloseEmailImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Limpiar URL si había una
      setCloseEmailImageUrl('');
    }
  };

  // ✅ NUEVO: Función para subir imagen a Cloudinary
  const uploadImageToCloudinary = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file); // Cambiado de 'file' a 'image' para coincidir con el API

    const response = await fetch('/api/upload/image', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al subir la imagen');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Error al subir la imagen');
    }
    
    return data.data.secure_url;
  };

  const confirmCloseAction = async () => {
    if (!confirmClose.alertId || !confirmClose.price) { setConfirmClose({ open: false }); return; }
    try {
      if (userRole !== 'admin') { alert('❌ Solo los administradores pueden cerrar posiciones'); setConfirmClose({ open: false }); return; }
      const priceNumber = parseFloat(confirmClose.price.replace('$',''));
      if (isNaN(priceNumber) || priceNumber <= 0) { alert('❌ Precio inválido. Por favor, verifica el precio actual.'); setConfirmClose({ open: false }); return; }
      
      let finalImageUrl: string | undefined = closeEmailImageUrl;
      
      // ✅ NUEVO: Subir imagen si se seleccionó un archivo
      if (closeEmailImageFile) {
        setUploadingCloseImage(true);
        try {
          finalImageUrl = await uploadImageToCloudinary(closeEmailImageFile);
          // console.log('✅ Imagen subida exitosamente:', finalImageUrl);
        } catch (uploadError) {
          // console.error('❌ Error subiendo imagen:', uploadError);
          alert('❌ Error al subir la imagen. Se procederá sin imagen.');
          finalImageUrl = undefined;
        } finally {
          setUploadingCloseImage(false);
        }
      }
      
      const response = await fetch('/api/alerts/close', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ 
          alertId: confirmClose.alertId, 
          currentPrice: priceNumber, 
          reason: 'MANUAL', 
          emailMessage: closeEmailMessage || undefined, 
          emailImageUrl: finalImageUrl || undefined 
        })
      });
      const result = await response.json();
      if (response.ok && result.success) { 
        await loadAlerts();
        // Refrescar operaciones después de cerrar posición (debería crear una operación de venta)
        // Agregar delay para asegurar que la operación se guarde en la DB
        setTimeout(() => {
          setRefreshOperationsTrigger(prev => prev + 1);
        }, 1000);
        alert('✅ ¡Posición cerrada exitosamente!'); 
      }
      else { alert(result?.error || result?.message || '❌ No se pudo cerrar la posición'); }
    } catch (error) {
      // console.error('❌ Error al cerrar posición:', error); alert('❌ Error inesperado al cerrar la posición.');
    } finally { 
      setConfirmClose({ open: false }); 
      setCloseEmailMessage(''); 
      setCloseEmailImageUrl(''); 
      setCloseEmailImageFile(null);
      setCloseEmailImagePreview('');
      setUploadingCloseImage(false);
    }
  };

  // ✅ NUEVO: Función para probar el cierre de mercado
  const handleTestMarketClose = async () => {
    if (!confirm('¿Quieres probar el cierre de mercado? Esto procesará todas las alertas que deban cerrarse según su horario personalizado.')) {
      return;
    }

    try {
      // console.log('🧪 Iniciando prueba de cierre de mercado...');
      
      const response = await fetch('/api/cron/market-close?test=true', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        // console.log('✅ Prueba de cierre exitosa:', result);
        alert(`✅ Prueba de cierre completada!\n\nProcesadas: ${result.processedCount} alertas\nTiempo: ${result.executionTime}ms\n\n${result.message}`);
        
        // Recargar las alertas para mostrar los cambios
        await loadAlerts();
      } else {
        console.error('❌ Error en prueba de cierre:', result);
        alert(`❌ Error en prueba de cierre: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('❌ Error al probar cierre de mercado:', error);
      alert('❌ Error al probar cierre de mercado. Verifica la consola para más detalles.');
    }
  };

  // ✅ NUEVO: Función para convertir rangos a precios fijos
  const handleTestRangeConversion = async () => {
    if (!confirm('¿Quieres convertir todos los rangos de precio a precios fijos? Esto simulará el cierre de mercado usando los precios actuales.')) {
      return;
    }

    try {
      // console.log('🔄 Iniciando conversión de rangos...');
      
      const response = await fetch('/api/test-market-close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        // console.log('✅ Conversión exitosa:', result);
        
        // Mostrar detalles de la conversión
        let detailsMessage = '';
        if (result.details && result.details.length > 0) {
          detailsMessage = '\n\nDetalles:\n' + result.details.map((detail: any) => 
            `• ${detail.symbol}: ${detail.oldRange} → $${detail.newPrice}`
          ).join('\n');
        }
        
        alert(`✅ Conversión completada!\n\nProcesadas: ${result.processedCount} alertas${detailsMessage}\n\n${result.message}`);
        
        // Recargar las alertas para mostrar los cambios
        await loadAlerts();
      } else {
        // console.error('❌ Error en conversión:', result);
        alert(`❌ Error en conversión: ${result.error || result.message}`);
      }
    } catch (error) {
      // console.error('❌ Error al convertir rangos:', error);
      alert('❌ Error al convertir rangos. Verifica la consola para más detalles.');
    }
  };

  // ✅ NUEVO: Función para conversión automática basada en estado del mercado
  const handleAutoConvertRanges = async () => {
    if (!confirm('¿Quieres verificar el estado del mercado y convertir rangos automáticamente si está cerrado?')) {
      return;
    }

    try {
      // console.log('🔄 Verificando estado del mercado y ejecutando conversión automática...');
      
      const response = await fetch('/api/auto-convert-ranges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        // console.log('✅ Verificación completada:', result);
        
        let message = `📊 Estado del mercado: ${result.marketStatus.isOpen ? 'ABIERTO' : 'CERRADO'}\n${result.marketStatus.message}`;
        
        if (result.conversion && result.conversion.processed > 0) {
          // Mostrar detalles de la conversión
          let detailsMessage = '\n\n🔄 Conversión automática ejecutada:\n';
          detailsMessage += result.conversion.details.map((detail: any) => 
            `• ${detail.symbol}: ${detail.oldRange} → $${detail.newPrice}`
          ).join('\n');
          
          message += detailsMessage;
          message += `\n\n✅ Procesadas: ${result.conversion.processed} alertas`;
          
          // Recargar las alertas para mostrar los cambios
          await loadAlerts();
        } else if (!result.marketStatus.isOpen) {
          message += '\n\nℹ️ No se encontraron alertas con rangos para convertir.';
        } else {
          message += '\n\nℹ️ El mercado está abierto, no se ejecutó conversión.';
        }
        
        alert(message);
      } else {
        // console.error('❌ Error en verificación automática:', result);
        alert(`❌ Error: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      // console.error('❌ Error al verificar mercado:', error);
      alert('❌ Error al verificar estado del mercado. Verifica la consola para más detalles.');
    }
  };

  // ✅ NUEVO: Función para probar el cron job manualmente
  const handleTestCronJob = async () => {
    if (!confirm('¿Quieres probar el cron job de conversión automática? Esto simulará la ejecución automática.')) {
      return;
    }

    try {
      // console.log('🔄 Probando cron job de conversión automática...');
      
      const response = await fetch('/api/test-cron-conversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok) {
        // console.log('✅ Prueba de cron job exitosa:', result);
        
        let message = `🧪 PRUEBA DE CRON JOB COMPLETADA\n\n`;
        
        if (result.conversion && result.conversion.processed > 0) {
          // Mostrar detalles de la conversión
          let detailsMessage = '🔄 Conversión ejecutada:\n';
          detailsMessage += result.conversion.details.map((detail: any) => 
            `• ${detail.symbol}: ${detail.oldRange} → $${detail.newPrice}`
          ).join('\n');
          
          message += detailsMessage;
          message += `\n\n✅ Procesadas: ${result.conversion.processed} alertas`;
          
          // Recargar las alertas para mostrar los cambios
          await loadAlerts();
        } else {
          message += 'ℹ️ No se encontraron alertas con rangos para convertir.';
        }
        
        alert(message);
      } else {
        // console.error('❌ Error en prueba de cron job:', result);
        alert(`❌ Error: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      // console.error('❌ Error al probar cron job:', error);
      alert('❌ Error al probar cron job. Verifica la consola para más detalles.');
    }
  };

  // Función para manejar la edición de alertas
  const handleEditAlert = (alert: any) => {
    // console.log('🔍 Editando alerta:', alert);

    // Preparar los datos de la alerta para edición
    setEditingAlert(alert);
    setEditAlert({
      symbol: alert.symbol || '',
      action: alert.action || 'BUY',
      entryPrice: alert.entryPrice ? (typeof alert.entryPrice === 'string' ? alert.entryPrice.replace('$', '') : String(alert.entryPrice)) : '',
      stopLoss: alert.stopLoss ? (typeof alert.stopLoss === 'string' ? alert.stopLoss.replace('$', '') : String(alert.stopLoss)) : '',
      takeProfit: alert.takeProfit ? (typeof alert.takeProfit === 'string' ? alert.takeProfit.replace('$', '') : String(alert.takeProfit)) : '',
      analysis: alert.analysis || '',
      availableForPurchase: alert.availableForPurchase || false,
      // ✅ NUEVO: Inicializar campos de liquidez y venta rápida
      liquidityPercentage: 0,
      quickSellPercentage: 0
    });

    // Mostrar el modal de edición
    setShowEditAlert(true);
  };

  // Función para abrir modal de venta parcial
  const handlePartialSale = (alert: any) => {
    // console.log('💰 Iniciando venta parcial para:', alert);
    setPartialSaleAlert(alert);
    setShowPartialSaleModal(true);
    
    // ✅ NUEVO: Inicializar valores por defecto
    setSellPercentage(50);
    setSellPriceMin('');
    setSellPriceMax('');
    setSellEmailMessage('');
    setSellEmailImageUrl('');
    setSellEmailImageFile(null);
    setSellEmailImagePreview('');
  };

  // ✅ NUEVO: Función para manejar selección de archivo de imagen en venta
  const handleSellImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        alert('❌ Por favor selecciona un archivo de imagen válido');
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('❌ La imagen debe ser menor a 5MB');
        return;
      }

      setSellEmailImageFile(file);
      
      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setSellEmailImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
      
      // Limpiar URL si había una
      setSellEmailImageUrl('');
    }
  };

  // ✅ NUEVO: Función para ejecutar venta con rango de precios
  const executeSellWithRange = async () => {
    if (!partialSaleAlert) {
      console.error('❌ No hay alerta seleccionada para la venta');
      alert('❌ No hay alerta seleccionada para la venta');
      return;
    }

    if (!partialSaleAlert._id && !partialSaleAlert.id) {
      console.error('❌ La alerta no tiene ID válido:', partialSaleAlert);
      alert('❌ Error: La alerta no tiene ID válido');
      return;
    }

    // Validaciones
    if (!sellPriceMin || !sellPriceMax) {
      alert('❌ Por favor ingresa tanto el precio mínimo como el máximo');
      return;
    }

    const priceMin = parseFloat(sellPriceMin);
    const priceMax = parseFloat(sellPriceMax);

    if (isNaN(priceMin) || isNaN(priceMax) || priceMin <= 0 || priceMax <= 0) {
      alert('❌ Los precios deben ser números válidos mayores a 0');
      return;
    }

    if (priceMin >= priceMax) {
      alert('❌ El precio mínimo debe ser menor al precio máximo');
      return;
    }

    if (sellPercentage <= 0 || sellPercentage > 100) {
      alert('❌ El porcentaje debe estar entre 1 y 100');
      return;
    }

    try {
      setPartialSaleLoading(true);
      const alertId = partialSaleAlert._id || partialSaleAlert.id;
      // console.log(`💰 Ejecutando venta de ${sellPercentage}% en rango $${priceMin}-$${priceMax} para alerta:`, alertId);
      // console.log('🔍 Datos de la alerta:', {
      //   _id: partialSaleAlert._id,
      //   id: partialSaleAlert.id,
      //   symbol: partialSaleAlert.symbol,
      //   entryPrice: partialSaleAlert.entryPrice
      // });

      let finalImageUrl: string | undefined = sellEmailImageUrl;
      
      // Subir imagen si se seleccionó un archivo
      if (sellEmailImageFile) {
        setUploadingSellImage(true);
        try {
          finalImageUrl = await uploadImageToCloudinary(sellEmailImageFile);
          // console.log('✅ Imagen de venta subida exitosamente:', finalImageUrl);
        } catch (uploadError) {
          // console.error('❌ Error subiendo imagen de venta:', uploadError);
          alert('❌ Error al subir la imagen. Se procederá sin imagen.');
          finalImageUrl = undefined;
        } finally {
          setUploadingSellImage(false);
        }
      }

      const requestData = {
        alertId: alertId,
        percentage: sellPercentage,
        priceRange: {
          min: priceMin,
          max: priceMax
        },
        tipo: 'SmartMoney',
        emailMessage: sellEmailMessage || undefined,
        emailImageUrl: finalImageUrl || undefined
      };

      // console.log('📤 Enviando datos al API:', requestData);

      const response = await fetch('/api/admin/partial-sale', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      const result = await response.json();

      if (response.ok) {
        // console.log('✅ Venta con rango ejecutada exitosamente:', result);
        
        // Mostrar mensaje de confirmación
        alert(`✅ Venta de ${sellPercentage}% en rango $${priceMin}-$${priceMax} ejecutada exitosamente!\n\n` +
              `💰 Liquidez liberada: $${result.liquidityReleased?.toFixed(2) || 'N/A'}\n` +
              `📊 Posición restante: ${100 - sellPercentage}%\n` +
              `💵 Ganancia realizada: $${result.realizedProfit?.toFixed(2) || 'N/A'}`);
        
        // Recargar datos
        await loadAlerts();
        
        // ✅ FORZAR RECARGA DE LIQUIDEZ con delay para asegurar actualización
        setTimeout(async () => {
          await loadLiquidity();
        }, 500); // Esperar 500ms para que la DB se actualice
        
        // Refrescar operaciones después de venta parcial (que crea una operación de venta automáticamente)
        // Agregar delay para asegurar que la operación se guarde en la DB
        setTimeout(() => {
          setRefreshOperationsTrigger(prev => prev + 1);
        }, 1000);
        
        // Cerrar modal y limpiar estados
        setShowPartialSaleModal(false);
        setPartialSaleAlert(null);
        setSellPercentage(50);
        setSellPriceMin('');
        setSellPriceMax('');
        setSellEmailMessage('');
        setSellEmailImageUrl('');
        setSellEmailImageFile(null);
        setSellEmailImagePreview('');
      } else {
        // console.error('❌ Error en venta con rango:', result);
        alert(`❌ Error: ${result.error || 'Error desconocido'}`);
      }
    } catch (error) {
      // console.error('❌ Error al ejecutar venta con rango:', error);
      alert('❌ Error al ejecutar venta. Verifica la consola para más detalles.');
    } finally {
      setPartialSaleLoading(false);
    }
  };

  // Función para guardar los cambios de la alerta
  const handleSaveEditAlert = async () => {
    if (!editingAlert) return;

    // ✅ CORREGIDO: Verificar que tengamos un ID válido
    const alertId = editingAlert.id || editingAlert._id;
    if (!alertId) {
      alert('❌ Error: No se pudo identificar la alerta a editar');
      return;
    }

    try {
      setEditLoading(true);

      // Validar datos
      if (!editAlert.symbol.trim()) {
        alert('❌ El símbolo es obligatorio');
        return;
      }

      if (!editAlert.stopLoss || parseFloat(editAlert.stopLoss) <= 0) {
        alert('❌ El stop loss debe ser mayor a 0');
        return;
      }

      if (!editAlert.takeProfit || parseFloat(editAlert.takeProfit) <= 0) {
        alert('❌ El take profit debe ser mayor a 0');
        return;
      }

      // ✅ Validar entryPrice solo si está presente y no está vacío
      // Para alertas de rango, entryPrice es opcional
      const isRangeAlert = editingAlert?.tipoAlerta === 'rango' || editingAlert?.precioMinimo || editingAlert?.precioMaximo;
      const entryPriceValue = editAlert.entryPrice?.trim() ? parseFloat(editAlert.entryPrice) : undefined;
      
      // Solo validar entryPrice si NO es una alerta de rango
      if (!isRangeAlert && entryPriceValue !== undefined && (isNaN(entryPriceValue) || entryPriceValue <= 0)) {
        alert('❌ El precio de entrada debe ser mayor a 0');
        return;
      }
      
      // Para alertas de rango, solo validar que no sea negativo si se proporciona
      if (isRangeAlert && entryPriceValue !== undefined && (isNaN(entryPriceValue) || entryPriceValue < 0)) {
        alert('❌ El precio de entrada no puede ser negativo');
        return;
      }

      // console.log('🔄 Guardando cambios de alerta:', {
      //   alertId: alertId,
      //   changes: editAlert
      // });

      // ✅ NUEVO: Preparar datos de liquidez y venta rápida
      const liquidityAmount = editAlert.liquidityPercentage > 0 ? (liquidityTotal * editAlert.liquidityPercentage / 100) : 0;
      
      // console.log('🔍 [DEBUG] Datos de edición con liquidez:', {
      //   alertId: editingAlert.id,
      //   liquidityPercentage: editAlert.liquidityPercentage,
      //   liquidityAmount,
      //   quickSellPercentage: editAlert.quickSellPercentage,
      //   liquidityTotal
      // });

      const response = await fetch('/api/alerts/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          alertId: alertId,
          symbol: editAlert.symbol,
          action: editAlert.action,
          entryPrice: entryPriceValue,
          stopLoss: parseFloat(editAlert.stopLoss),
          takeProfit: parseFloat(editAlert.takeProfit),
          analysis: editAlert.analysis,
          availableForPurchase: editAlert.availableForPurchase,
          // ✅ NUEVO: Campos de liquidez y venta rápida
          liquidityPercentage: editAlert.liquidityPercentage,
          liquidityAmount: liquidityAmount,
          quickSellPercentage: editAlert.quickSellPercentage,
          reason: 'Edición por administrador desde panel de control'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // console.log('✅ Alerta editada exitosamente:', result.alert);

        // ✅ CORREGIDO: Recargar AMBAS listas para evitar duplicados
        // Si cambió el estado de availableForPurchase, la alerta debe moverse entre secciones
        await Promise.all([
          loadVigentesAlerts(),
          loadSeguimientoAlerts()
        ]);

        // Cerrar modal
        setShowEditAlert(false);
        setEditingAlert(null);

        alert('✅ ¡Alerta editada exitosamente!');
      } else {
        // console.error('❌ Error del servidor:', result);

        let errorMessage = 'No se pudo editar la alerta';

        if (result.error) {
          if (result.error.includes('Permisos insuficientes')) {
            errorMessage = '❌ No tienes permisos para editar alertas. Solo los administradores pueden hacerlo.';
          } else if (result.error.includes('No autorizado')) {
            errorMessage = '❌ Sesión expirada. Por favor, inicia sesión nuevamente.';
          } else if (result.error.includes('Alerta no encontrada')) {
            errorMessage = '❌ La alerta no fue encontrada. Puede que haya sido eliminada.';
          } else if (result.error.includes('no está activa')) {
            errorMessage = '❌ La alerta ya no está activa.';
          } else {
            errorMessage = `❌ ${result.error}`;
          }
        } else if (result.message) {
          errorMessage = `❌ ${result.message}`;
        }

        alert(errorMessage);
      }
    } catch (error) {
      // console.error('❌ Error al editar alerta:', error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        alert('❌ Error de conexión. Verifica tu internet e intenta nuevamente.');
      } else {
        alert('❌ Error inesperado al editar la alerta. Por favor, intenta nuevamente.');
      }
    } finally {
      setEditLoading(false);
    }
  };

  // **NUEVO: Estado para manejo de rango temporal del portafolio**
  const [portfolioRange, setPortfolioRange] = useState('30d');
  const [portfolioData, setPortfolioData] = useState<any[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // **NUEVO: Función para manejar cambio de rango temporal**
  const handlePortfolioRangeChange = useCallback(async (range: string, days: number) => {
    setPortfolioRange(range);
    setPortfolioLoading(true);
    
    try {
      // Simular carga de datos del portafolio
      // En producción, esto haría fetch a una API real
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generar datos simulados basados en el rango
      const mockData = generatePortfolioData(days);
      setPortfolioData(mockData);
    } catch (error) {
      // console.error('Error al cargar datos del portafolio:', error);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  // **NUEVO: Función para generar datos simulados del portafolio**
  const generatePortfolioData = (days: number) => {
    const data = [];
    const baseValue = 10000;
    let currentValue = baseValue;
    
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (days - i));
      
      // Simular variación diaria
      const dailyChange = (Math.random() - 0.5) * 0.02; // ±1% diario
      currentValue *= (1 + dailyChange);
      
      data.push({
        date: date.toISOString(),
        value: currentValue,
        change: dailyChange * 100
      });
    }
    
    return data;
  };

  // Funciones de renderizado
  // ✅ MEJORADO: Función auxiliar para crear datos del gráfico de torta con logging
  const createPieChartData = (alerts: any[]) => {
    // console.log('📊 [PIE CHART] Creando datos del gráfico de torta...', {
    //   alertsCount: alerts.length,
    //   liquidityMapKeys: Object.keys(liquidityMap || {}).length,
    //   liquidityMapByAlertIdKeys: Object.keys(liquidityMapByAlertId || {}).length,
    //   liquidityTotal: liquidityTotal,
    //   liquiditySummary: liquiditySummary
    // });

    // Paleta de colores dinámicos para cada alerta
    const colorPalette = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
      '#14B8A6', '#F43F5E', '#A855F7', '#EAB308', '#22C55E'
    ];

    // ✅ CORREGIDO: Filtrar solo alertas CONFIRMADAS con liquidez asignada (usando alertId)
    // Solo mostrar alertas que están en "Seguimiento de alertas" (confirmadas)
    // Excluir alertas creadas HOY que aún no tienen finalPriceSetAt (aún no confirmadas a las 18:30)
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const activeAlertsWithLiquidity = alerts.filter(alert => {
      const alertId = alert.id || alert._id;
      const liquidity = liquidityMapByAlertId?.[alertId];
      const hasLiquidity = liquidity && liquidity.allocatedAmount > 0;
      const isActive = alert.status === 'ACTIVE';
      const esHistorica = alert.esOperacionHistorica || false;
      
      // ✅ NUEVO: Verificar si la alerta está confirmada (misma lógica que renderSeguimientoAlertas)
      // ✅ CORREGIDO: Las operaciones históricas siempre deben aparecer, sin importar cuándo se crearon
      if (isActive && !esHistorica) {
        // Verificar si la alerta fue creada hoy
        const alertDate = new Date(alert.date || alert.createdAt);
        const isCreatedToday = alertDate >= startOfDay && alertDate <= endOfDay;
        
        // Si fue creada hoy y no tiene finalPriceSetAt, no mostrarla (aún no confirmada)
        // PERO las operaciones históricas siempre se muestran
        if (isCreatedToday && !alert.finalPriceSetAt) {
          return false;
        }
      }
      
      if (isActive && hasLiquidity) {
        // console.log(`✅ [PIE CHART] Alerta confirmada con liquidez: ${alert.symbol} (alertId: ${alertId}, histórica: ${esHistorica}) - $${liquidity.allocatedAmount}`);
      } else if (isActive && !hasLiquidity) {
        // console.log(`⚠️ [PIE CHART] Alerta confirmada SIN liquidez: ${alert.symbol} (alertId: ${alertId}, histórica: ${esHistorica})`);
      }
      
      return isActive && hasLiquidity;
    });

    // console.log('📊 [PIE CHART] Alertas confirmadas con liquidez:', activeAlertsWithLiquidity.length);

    // Preparar datos para el gráfico de torta 3D - Solo alertas confirmadas con liquidez
    const chartData = activeAlertsWithLiquidity.map((alert, index) => {
      const alertId = alert.id || alert._id;
      const profitValue = typeof alert.profit === 'string' 
        ? parseFloat(alert.profit.replace(/[+%]/g, ''))
        : Number(alert.profit) || 0;
      // ✅ CORREGIDO: Usar distribuciones individuales por alertId en lugar de consolidadas por símbolo
      const liquidity = liquidityMapByAlertId?.[alertId];
      const allocated = Number(liquidity?.allocatedAmount || 0);
      
      // ✅ NUEVO: Calcular P&L en dólares usando allocatedAmount y cambio porcentual
      // P&L = (cambio porcentual / 100) × allocatedAmount
      const profitLoss = allocated > 0 && profitValue !== 0
        ? (profitValue / 100) * allocated
        : Number(liquidity?.profitLoss || 0);
      
      // ✅ NUEVO: Calcular valor actual = allocatedAmount + P&L
      const currentValue = allocated + profitLoss;
      
      // ✅ CORREGIDO: Asegurar que el precio actual sea un número válido
      // El precio actual viene como string con formato "$XX.XX" desde la API
      const currentPrice = alert.currentPrice ? 
        (typeof alert.currentPrice === 'string' 
          ? parseFloat(alert.currentPrice.replace('$', ''))
          : Number(alert.currentPrice) || 0) 
        : 0;
      
      return {
        id: alertId || alert.id || alert._id,
        symbol: alert.symbol,
        profit: profitValue,
        status: alert.status,
        entryPrice: alert.entryPrice || liquidity?.entryPrice,
        // ✅ CORREGIDO: Para ventas rápidas, usar precio actual como precio efectivo
        // Esto asegura que el P&L mostrado sea realista basado en el precio actual del mercado
        currentPrice: currentPrice, // Precio actual (precio de venta para ventas rápidas)
        stopLoss: alert.stopLoss,
        takeProfit: alert.takeProfit,
        action: alert.action,
        date: alert.date,
        analysis: alert.analysis,
        allocatedAmount: allocated,
        profitLoss: profitLoss, // ✅ NUEVO: P&L en dólares
        currentValue: currentValue, // ✅ NUEVO: Valor actual (allocated + P&L)
        // Color único para cada alerta
        color: colorPalette[index % colorPalette.length],
        // Color más oscuro para efecto 3D
        darkColor: colorPalette[index % colorPalette.length] + '80'
      };
    });

    // ✅ NUEVO: Calcular el tamaño de cada segmento basado en el VALOR ACTUAL (allocatedAmount + P&L)
    // Esto refleja el cambio porcentual en el tamaño del segmento
    const totalCurrentValue = chartData.reduce((sum, alert) => sum + Math.abs(alert.currentValue || 0), 0);
    
    // ✅ NUEVO: Usar liquidezTotal del resumen (que incluye ganancias/pérdidas) como base
    // Si no hay resumen, usar el total de valores actuales
    const totalBase = (liquiditySummary.liquidezTotal && liquiditySummary.liquidezTotal > 0) 
      ? liquiditySummary.liquidezTotal 
      : ((liquidityTotal && liquidityTotal > 0) ? liquidityTotal : totalCurrentValue);
    
    // ✅ CORREGIDO: Calcular liquidez disponible ANTES de calcular los segmentos
    // para asegurar que la suma sea exacta
    const available = (liquiditySummary && liquiditySummary.liquidezDisponible !== undefined && liquiditySummary.liquidezDisponible !== null)
      ? Math.max(liquiditySummary.liquidezDisponible, 0)
      : Math.max((totalBase || 0) - totalCurrentValue, 0);
    
    // ✅ CORREGIDO: Calcular el total real que se va a distribuir (alertas + liquidez disponible)
    const totalToDistribute = totalCurrentValue + available;
    
    let cumulativeAngle = 0;
    const chartSegments = chartData.map((alert) => {
      // ✅ NUEVO: Usar valor actual (allocatedAmount + P&L) para calcular el tamaño del segmento
      const segmentBase = Math.abs(alert.currentValue || 0);
      // ✅ CORREGIDO: Calcular porcentaje basado en liquidez TOTAL actual (inicial + ganancias)
      // Esto refleja el porcentaje real de la cartera considerando el P&L
      // Ejemplo: Si asignas 5% de $1000 = $50, y sube 10% = $55, entonces el % es ($55 / $1005) * 100 = 5.47%
      const size = totalBase > 0 ? (segmentBase / totalBase) * 100 : 0;
      const angle = (segmentBase / (totalBase || 1)) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = startAngle + angle;
      cumulativeAngle = endAngle;

      return {
        ...alert,
        size,
        startAngle,
        endAngle,
        centerAngle: (startAngle + endAngle) / 2
      };
    });

    // ✅ CORREGIDO: Agregar el segmento de liquidez disponible para completar el 100%
    // Usar el ángulo restante para asegurar que sume exactamente 360 grados
    if (available > 0 || cumulativeAngle < 360) {
      const remainingAngle = 360 - cumulativeAngle;
      const liqStart = cumulativeAngle;
      const liqEnd = 360; // Asegurar que termine en 360 grados exactos
      
      chartSegments.push({
        id: 'LIQ-SEG',
        symbol: 'LIQUIDEZ',
        profit: 0,
        status: 'ACTIVE',
        entryPrice: 0,
        currentPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        action: 'BUY',
        date: '',
        analysis: '',
        allocatedAmount: available,
        currentValue: available, // ✅ NUEVO: Para consistencia
        color: '#9CA3AF',
        darkColor: '#9CA3AF80',
        // ✅ CORREGIDO: Calcular porcentaje de liquidez disponible basado en liquidez total actual
        size: totalBase > 0 ? (available / totalBase) * 100 : (remainingAngle / 360) * 100,
        startAngle: liqStart,
        endAngle: liqEnd,
        centerAngle: (liqStart + liqEnd) / 2,
      } as any);
    }

    // ✅ NUEVO: Logging final de los segmentos creados
    // console.log('📊 [PIE CHART] Segmentos finales creados:', {
    //   totalSegments: chartSegments.length,
    //   segments: chartSegments.map(s => ({
    //     symbol: s.symbol,
    //     size: s.size,
    //     allocatedAmount: s.allocatedAmount
    //   }))
    // });

    return chartSegments;
  };

  // Función auxiliar para renderizar el gráfico de torta
  const renderPieChart = (chartSegments: any[]) => (
    <div className={styles.pieChart3D} id="alertsChartContainer">
      <svg viewBox="0 0 500 500" className={styles.chartSvg3D}>
        {/* Sombra del gráfico para efecto 3D */}
        <defs>
          <filter id="shadow3D" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="3" dy="3" stdDeviation="3" floodColor="#000000" floodOpacity="0.3"/>
          </filter>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Fondo del gráfico con efecto 3D */}
        <circle cx="250" cy="250" r="200" className={styles.chartBackground3D} />

        {/* Segmentos del gráfico 3D */}
        {chartSegments.map((segment, index) => (
          <g key={segment.id} className={styles.chartSegment3D}>
            {/* Sombra del segmento */}
            <path
              d={describeArc(250, 250, 200, segment.startAngle, segment.endAngle)}
              fill={segment.darkColor}
              filter="url(#shadow3D)"
              className={styles.segmentShadow}
            />
            {/* Segmento principal */}
            <path
              d={describeArc(250, 250, 200, segment.startAngle, segment.endAngle)}
              fill={segment.color}
              className={styles.segmentPath3D}
              onMouseEnter={(e) => showTooltip(e, segment)}
              onMouseLeave={hideTooltip}
              filter="url(#glow)"
            />
            {/* Borde del segmento */}
            <path
              d={describeArc(250, 250, 200, segment.startAngle, segment.endAngle)}
              fill="none"
              stroke="#ffffff"
              strokeWidth="2"
              opacity="0.3"
              className={styles.segmentBorder}
            />
            {/* Etiqueta del símbolo - Solo mostrar si el segmento es grande (>8%) */}
            {segment.size > 8 && (
              <>
                {/* Símbolo visible solo para segmentos grandes */}
                <text
                  x={250 + Math.cos((segment.centerAngle - 90) * Math.PI / 180) * 150}
                  y={250 + Math.sin((segment.centerAngle - 90) * Math.PI / 180) * 150}
                  className={styles.segmentLabel}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="18"
                  fontWeight="bold"
                  fill="#ffffff"
                  filter="url(#shadow3D)"
                  style={{
                    textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    pointerEvents: 'none'
                  }}
                >
                  {segment.symbol}
                </text>
              </>
            )}
          </g>
        ))}

        {/* Círculo central con efecto 3D */}
        <circle cx="250" cy="250" r="60" className={styles.chartCenter3D} />
      </svg>
    </div>
  );

  const renderDashboard = () => {
    // ✅ MEJORADO: Obtener datos para el gráfico de torta con mejor manejo de errores
    const alertasActivas = realAlerts.filter(alert => alert.status === 'ACTIVE');
    
    // ✅ NUEVO: Verificar si los datos de liquidez están cargados
    const liquidityLoaded = Object.keys(liquidityMap).length > 0 || liquidityTotal > 0;
    const hasActiveAlerts = alertasActivas.length > 0;
    
    // ✅ NUEVO: Crear datos del gráfico solo si tenemos datos de liquidez
    const chartSegments = liquidityLoaded ? createPieChartData(alertasActivas) : [];
    
    // ✅ NUEVO: Determinar el estado del gráfico
    const showChart = liquidityLoaded && hasActiveAlerts && chartSegments.length > 0;
    const showLoading = !liquidityLoaded && hasActiveAlerts;
    const showEmpty = !hasActiveAlerts;

    return (
      <div className={styles.dashboardContent}>
        <h2 className={styles.sectionTitle}>Dashboard de Trabajo</h2>
        <div className={styles.chartSection}>
          <PortfolioTimeRange 
            selectedRange={portfolioRange}
            onRangeChange={handlePortfolioRangeChange}
            serviceType="SmartMoney"
          />
        </div>

        {/* Comparación con SP500 - MOVIDO AL INICIO */}
        <SP500Comparison serviceType="SmartMoney" />

        {/* Métricas principales - OCULTADO */}
        {/* <div className={styles.modernMetricsGrid}>
          <div className={`${styles.modernMetricCard} ${styles.activeCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <Activity size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>ALERTAS ACTIVAS</h3>
              <div className={styles.metricValue}>{dashboardMetrics.alertasActivas}</div>
              <p className={styles.metricSubtext}>Posiciones abiertas</p>
            </div>
          </div>

          <div className={`${styles.modernMetricCard} ${styles.successCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <TrendingUp size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>ALERTAS GANADORAS</h3>
              <div className={styles.metricValue}>{dashboardMetrics.alertasGanadoras}</div>
              <p className={styles.metricSubtext}>Cerradas con ganancia</p>
            </div>
          </div>

          <div className={`${styles.modernMetricCard} ${styles.errorCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <TrendingDown size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>ALERTAS PERDEDORAS</h3>
              <div className={styles.metricValue}>{dashboardMetrics.alertasPerdedoras}</div>
              <p className={styles.metricSubtext}>Cerradas con pérdida</p>
            </div>
          </div>

          <div className={`${styles.modernMetricCard} ${styles.warningCard}`}>
            <div className={styles.cardHeader}>
              <div className={styles.iconContainer}>
                <BarChart3 size={20} />
              </div>
              <div className={styles.statusDot}></div>
            </div>
            <div className={styles.metricContent}>
              <h3 className={styles.metricTitle}>RENTABILIDAD ANUAL</h3>
              <div className={styles.metricValue}>{dashboardMetrics.rentabilidadAnual}</div>
              <p className={styles.metricSubtext}>Año {new Date().getFullYear()}</p>
            </div>
          </div>
        </div> */}

        {/* Gráfico de Distribución de Alertas */}
        <div className={styles.chartSection}>
          <div className={styles.chartHeader}>
            <h3>📊 Distribución de Alertas Activas</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {/* ✅ Botón para ir a seguimiento */}
              <button 
                onClick={() => setActiveTab('seguimiento')} 
                className={styles.viewAllButton}
                style={{ padding: '5px 12px', fontSize: '12px' }}
              >
                📈 Ir a alertas
              </button>
              {/* ✅ Botón de recarga para debug */}
              <button 
                onClick={() => loadLiquidity()} 
                className={styles.refreshButton}
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                🔄 Recargar
              </button>
            </div>
          </div>
          <div className={styles.dashboardChartContainer}>
            {showChart ? (
              <div className={styles.simpleChartLayout}>
                {renderPieChart(chartSegments)}
              </div>
            ) : showLoading ? (
              <div className={styles.emptyChartState}>
                <div className={styles.emptyChartIcon}>⏳</div>
                <h4>Cargando datos de liquidez...</h4>
                <p>Por favor espera mientras se cargan los datos del gráfico.</p>
                <button 
                  onClick={() => loadLiquidity()} 
                  className={styles.refreshButton}
                  style={{ marginTop: '10px' }}
                >
                  🔄 Reintentar
                </button>
              </div>
            ) : showEmpty ? (
              <div className={styles.emptyChartState}>
                <div className={styles.emptyChartIcon}>📊</div>
                <h4>No hay alertas activas</h4>
                <p>Las alertas aparecerán aquí cuando sean creadas por el administrador.</p>
              </div>
            ) : (
              <div className={styles.emptyChartState}>
                <div className={styles.emptyChartIcon}>❌</div>
                <h4>Error cargando datos</h4>
                <p>No se pudieron cargar los datos de liquidez. Intenta recargar la página.</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className={styles.refreshButton}
                  style={{ marginTop: '10px' }}
                >
                  🔄 Recargar página
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Comparación con SP500 - MOVIDO AL INICIO DEL DASHBOARD */}

        {/* Actividad Reciente */}
        <div className={styles.activitySection}>
          <div className={styles.activityHeader}>
            <h3>Actividad Reciente</h3>
            <div className={styles.activityActions}>
              <button
                className={styles.viewAllButton}
                onClick={() => setActiveTab('seguimiento')}
              >
                Ver Seguimiento
              </button>
              <button
                className={styles.refreshButton}
                onClick={() => refreshActivity()}
                disabled={refreshingActivity}
              >
                <Activity size={16} />
                {refreshingActivity ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>
          </div>
          <div className={styles.activityList}>
            {recentActivity.slice(0, 5).map((activity, index) => (
              <div key={activity.id || index} className={styles.activityItem}>
                <span className={styles.activityTime}>{activity.timestamp}</span>
                <span className={styles.activityMessage}>{activity.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSeguimientoAlertas = () => {
    // ✅ NUEVA LÓGICA: Mostrar TODAS las alertas activas en seguimiento
    // - Alertas con PRECIO ESPECÍFICO: siempre aparecen en SEGUIMIENTO (incluso si fueron creadas hoy)
    // - Alertas con RANGO: aparecen en SEGUIMIENTO solo si están confirmadas (tienen finalPriceSetAt) o no fueron creadas hoy
    // - Alertas descartadas del día actual también aparecen
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    const alertasEnSeguimiento = realAlerts.filter(alert => {
      if (alert.status === 'ACTIVE') {
        // Verificar si la alerta tiene rango o precio específico
        const hasRange = alert.tipoAlerta === 'rango' || 
                        (alert.entryPriceRange && (alert.entryPriceRange.min || alert.entryPriceRange.max)) ||
                        (alert.precioMinimo && alert.precioMaximo);
        
        // Si tiene PRECIO ESPECÍFICO (sin rango), SIEMPRE mostrarla en SEGUIMIENTO
        if (!hasRange) {
          return true;
        }
        
        // Si tiene RANGO, verificar si está confirmada
        // Verificar si la alerta fue creada hoy
        const alertDate = new Date(alert.date || alert.createdAt);
        const isCreatedToday = alertDate >= startOfDay && alertDate <= endOfDay;
        
        // Si tiene rango y fue creada hoy, solo mostrarla si tiene finalPriceSetAt (confirmada)
        if (isCreatedToday && !alert.finalPriceSetAt) {
          return false;
        }
        
        // Mostrar todas las demás alertas activas (con rango confirmado o sin rango)
        return true;
      }

      // Incluir alertas descartadas del día actual
      if (alert.status === 'DESCARTADA' && alert.descartadaAt) {
        const descartadaAt = new Date(alert.descartadaAt);
        return descartadaAt >= startOfDay && descartadaAt <= endOfDay;
      }

      return false;
    });
    
    return (
      <div className={styles.seguimientoContent}>
        <div className={styles.seguimientoHeader}>
          <h2 className={styles.sectionTitle}>🎯 Seguimiento de Alertas</h2>
          <p className={styles.sectionDescription}>
            Todas las alertas activas (marcadas y desmarcadas) aparecen aquí para seguimiento
          </p>
          <div className={styles.chartControls}>
            {userRole === 'admin' && (
              <button 
                className={styles.createAlertButton}
                onClick={() => setShowCreateAlert(true)}
                title="Crear nueva alerta"
              >
                + Crear Nueva Alerta
              </button>
            )}
            {/* Filtros - OCULTOS */}
            <div className={styles.filtersContainer} style={{ display: 'none' }}>
              <input
                type="text"
                placeholder="Filtrar por símbolo..."
                value={filterSymbol}
                onChange={(e) => setFilterSymbol(e.target.value)}
                className={styles.filterInput}
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Todos los estados</option>
                <option value="ACTIVE">Activas</option>
                <option value="CLOSED">Cerradas</option>
                <option value="STOPPED">Detenidas</option>
                <option value="DESESTIMADA">Desestimadas</option>
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className={styles.filterDate}
              />
              <button onClick={clearFilters} className={styles.clearFilters}>
                Limpiar Filtros
              </button>
            </div>
          </div>
        </div>
        
        {loadingAlerts ? (
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p>Cargando alertas...</p>
          </div>
        ) : alertasEnSeguimiento.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📊</div>
            <h3>No hay alertas en seguimiento</h3>
            <p>Todas las alertas activas aparecen automáticamente aquí para su seguimiento.</p>
            {userRole === 'admin' && (
              <button 
                className={styles.createFirstAlertButton}
                onClick={() => setShowCreateAlert(true)}
              >
                + Crear Primera Alerta
              </button>
            )}
          </div>
        ) : (
          <div className={styles.alertsListContainer}>
            {/* Resumen estadístico - OCULTO */}
            <div className={styles.statsSummary} style={{ display: 'none' }}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryIcon}>📊</div>
                <div className={styles.summaryContent}>
                  <span className={styles.summaryLabel}>Total Alertas</span>
                  <span className={styles.summaryValue}>{alertasEnSeguimiento.length}</span>
                </div>
              </div>
              <div className={styles.summaryCard}>
                <div className={styles.summaryIcon}>🟢</div>
                <div className={styles.summaryContent}>
                  <span className={styles.summaryLabel}>En Seguimiento</span>
                  <span className={styles.summaryValue}>{alertasEnSeguimiento.length}</span>
                </div>
              </div>
            </div>
            
            {/* Lista de alertas en seguimiento */}
            <div className={styles.alertsList}>
              {alertasEnSeguimiento.map((alert) => (
                <div key={alert.id} className={`${styles.alertCard} alertCard ${alert.status === 'DESCARTADA' ? styles.discardedAlert : ''}`}>
                  <div className={styles.alertHeader}>
                    <h3 className={styles.alertSymbol}>{alert.symbol}</h3>
                    <span className={`${styles.alertAction} ${alert.action === 'BUY' ? styles.buyAction : styles.sellAction}`} style={{ display: 'none' }}>
                      {alert.action}
                    </span>
                    <span className={`${styles.alertStatus} ${alert.status === 'DESCARTADA' ? styles.discardedStatus : ''}`}>
                      {alert.status === 'DESCARTADA' ? '❌ DESCARTADA' : '🟢 ACTIVA'}
                    </span>
                  </div>
                  
                  <div className={styles.alertDetails}>
                    <div className={styles.alertDetail}>
                      <span>Precio Entrada:</span>
                      {alert.tipoAlerta === 'rango' ? (
                        <strong style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          background: 'rgba(59, 130, 246, 0.1)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border: '1px solid rgba(59, 130, 246, 0.2)'
                        }}>
                          <span style={{ color: '#60a5fa' }}>$</span>
                          <span>{alert.precioMinimo}</span>
                          <span style={{ color: '#60a5fa' }}>-</span>
                          <span>{alert.precioMaximo}</span>
                        </strong>
                      ) : (
                        <strong>{alert.entryPrice}</strong>
                      )}
                    </div>
                    <div className={styles.alertDetail}>
                      <span>Precio Actual:</span>
                      <strong>{alert.currentPrice}</strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>Stop Loss:</span>
                      <strong>{alert.stopLoss}</strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>Take Profit:</span>
                      <strong>{alert.takeProfit}</strong>
                    </div>
                    <div className={styles.alertDetail}>
                      <span>P&L:</span>
                      <strong className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profit : styles.loss}>
                        <span>{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '+' : ''}{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0).toFixed(2)}%</span>
                        <span className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profitArrow : styles.lossArrow}>
                          {(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '↗' : '↘'}
                        </span>
                      </strong>
                    </div>
                    {/* ✅ NUEVO: Porcentaje de participación restante */}
                    <div className={styles.alertDetail}>
                      <span>Participación:</span>
                      <strong className={styles.participationPercentage}>
                        {alert.participationPercentage || 100}%
                        {alert.participationPercentage && alert.participationPercentage < 100 && (
                          <span className={styles.partialSaleIndicator} title="Venta parcial realizada">
                            📉
                          </span>
                        )}
                      </strong>
                    </div>
                    {alert.hasSellRange && (
                      <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                        <span>RANGO VENTA:</span>
                        <strong>${alert.sellRangeMin} - ${alert.sellRangeMax}</strong>
                      </div>
                    )}
                    {alert.hasSellPrice && (
                      <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                        <span>PRECIO VENTA:</span>
                        <strong>{alert.sellPrice}</strong>
                      </div>
                    )}
                    <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                      <span>{alert.esOperacionHistorica ? 'Fecha Entrada:' : 'Fecha:'}</span>
                      <strong>{(() => {
                        // ✅ CORREGIDO: Para fechas históricas, mostrar la fecha usando UTC-3 (Argentina)
                        if (alert.esOperacionHistorica && alert.fechaEntrada) {
                          const fecha = typeof alert.fechaEntrada === 'string' 
                            ? new Date(alert.fechaEntrada) 
                            : new Date(alert.fechaEntrada);
                          // Mostrar fecha usando timezone de Argentina (UTC-3)
                          return fecha.toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            timeZone: 'America/Argentina/Buenos_Aires'
                          });
                        }
                        return new Date(alert.date).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Argentina/Buenos_Aires'
                        });
                      })()}</strong>
                    </div>
                    {/* ✅ CORREGIDO: Ocultar gananciaRealizada si es 0 para evitar que aparezca como "0" en el DOM */}
                    {(alert.gananciaRealizada !== undefined && alert.gananciaRealizada !== null && alert.gananciaRealizada !== 0) ? (
                      <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                        <span>Gan. Realizada:</span>
                        <strong className={alert.gananciaRealizada >= 0 ? styles.profit : styles.loss}>
                          {alert.gananciaRealizada >= 0 ? '+' : ''}{alert.gananciaRealizada.toFixed(2)}%
                        </strong>
                      </div>
                    ) : null}
                    {/* ✅ OCULTO: Ganancia No Realizada - Ocultada por solicitud del usuario */}
                    {/* {(alert.gananciaNoRealizada !== undefined && alert.gananciaNoRealizada !== null && alert.gananciaNoRealizada !== 0) ? (
                      <div className={styles.alertDetail} style={{ flex: '1 1 50%' }}>
                        <span>Gan. No Realizada:</span>
                        <strong className={alert.gananciaNoRealizada >= 0 ? styles.profit : styles.loss}>
                          {alert.gananciaNoRealizada >= 0 ? '+' : ''}{alert.gananciaNoRealizada.toFixed(2)}%
                        </strong>
                      </div>
                    ) : null} */}
                    {alert.status === 'DESCARTADA' && alert.descartadaMotivo && (
                      <div className={styles.alertDetail} style={{ flex: '1 1 100%', borderTop: '1px solid #e0e0e0', paddingTop: '8px', marginTop: '8px' }}>
                        <span>Motivo de descarte:</span>
                        <strong style={{ color: '#d32f2f', fontSize: '0.9em' }}>{alert.descartadaMotivo}</strong>
                      </div>
                    )}
                    {alert.status === 'DESCARTADA' && alert.descartadaAt && (
                      <div className={styles.alertDetail} style={{ flex: '1 1 100%' }}>
                        <span>Descartada el:</span>
                        <strong style={{ color: '#666', fontSize: '0.9em' }}>
                          {new Date(alert.descartadaAt).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </strong>
                      </div>
                    )}
                  </div>
                  
                  {alert.analysis && (
                    <div className={styles.alertAnalysis}>
                      <h4>📊 Análisis:</h4>
                      <p>{alert.analysis}</p>
                    </div>
                  )}
                  
                  <div className={styles.alertActions}>
                    {userRole === 'admin' && (
                      <button
                        className={styles.editButton}
                        onClick={() => handleEditAlert(alert)}
                        title="Editar alerta"
                      >
                        ✏️ Editar
                      </button>
                    )}
                    <button
                      className={styles.closeButton}
                      onClick={() => handleClosePosition(alert.id, alert.currentPrice)}
                      disabled={userRole !== 'admin'}
                      title={userRole !== 'admin' ? 'Solo los administradores pueden cerrar posiciones' : 'Cierre total: vender todo y cerrar'}
                      style={{ display: 'none' }}
                    >
                      Cierre total
                    </button>
                    {userRole === 'admin' && (
                      <button
                        className={styles.editButton}
                        onClick={() => handlePartialSale(alert)}
                        title="Venta parcial (25% o 50%)"
                      >
                        💰 Venta Parcial
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
      </div>
    );
  };

  // Funciones auxiliares para el gráfico de torta
  const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  const describeArc = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "L", x, y,
      "Z"
    ].join(" ");
  };

  const showTooltip = (event: React.MouseEvent, segment: any) => {
    const liq = (liquidityMap as any)?.[segment.symbol];
    
    // Crear o actualizar tooltip simplificado
    let tooltip = document.getElementById('chartTooltipSimple') as HTMLElement;
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'chartTooltipSimple';
      tooltip.className = styles.chartTooltipSimple;
      document.body.appendChild(tooltip);
    }

    // Contenido del tooltip simplificado con P&L
    const percentageText = `${segment.size.toFixed(1)}%`;
    const profitText = segment.symbol !== 'LIQUIDEZ' ? 
      `${segment.profit >= 0 ? '+' : ''}${segment.profit.toFixed(2)}%` : 
      'Disponible';
    
    const profitClass = segment.profit >= 0 ? styles.profitPositive : styles.profitNegative;
    
    tooltip.innerHTML = `
      <div class="${styles.tooltipSimpleSymbol}">${segment.symbol}</div>
      <div class="${styles.tooltipSimpleDivider}"></div>
      <div class="${styles.tooltipSimpleRow}">
        <span class="${styles.tooltipSimpleLabel}">Del gráfico:</span>
        <span class="${styles.tooltipSimpleValue}">${percentageText}</span>
      </div>
      ${segment.symbol !== 'LIQUIDEZ' ? `
        <div class="${styles.tooltipSimpleRow}">
          <span class="${styles.tooltipSimpleLabel}">P&L:</span>
          <span class="${styles.tooltipSimpleValue} ${profitClass}">${profitText}</span>
        </div>
      ` : `
        <div class="${styles.tooltipSimpleRow}">
          <span class="${styles.tooltipSimpleLiquidity}">${profitText}</span>
        </div>
      `}
    `;

    // Posicionar tooltip cerca del cursor
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    
    tooltip.style.display = 'block';
    tooltip.style.left = `${mouseX + 15}px`;
    tooltip.style.top = `${mouseY + 15}px`;
  };

  const hideTooltip = () => {
    const tooltip1 = document.getElementById('chartTooltip') as HTMLElement;
    const tooltip2 = document.getElementById('chartTooltipDashboard') as HTMLElement;
    const tooltipSimple = document.getElementById('chartTooltipSimple') as HTMLElement;
    if (tooltip1) tooltip1.style.display = 'none';
    if (tooltip2) tooltip2.style.display = 'none';
    if (tooltipSimple) tooltipSimple.style.display = 'none';
  };

  const renderAlertasVigentes = () => {
    // Solo mostrar alertas que están disponibles para compra (manejadas manualmente por el admin)
    const alertasVigentes = realAlerts.filter(alert => 
      alert.status === 'ACTIVE' && alert.availableForPurchase === true
    );
    
    return (
      <div className={styles.vigentesContent}>
        <div className={styles.vigentesHeader}>
          <h2 className={styles.sectionTitle}>Alertas Vigentes</h2>
          <p className={styles.sectionDescription}>
            Alertas de rango disponibles para comprar ahora
          </p>
          <div className={styles.priceUpdateControls}>
            {userRole === 'admin' && (
              <>
                <button 
                  className={styles.createAlertButton}
                  onClick={() => setShowCreateAlert(true)}
                  title="Crear nueva alerta"
                >
                  + Crear Alerta
                </button>
                {/* Botones de testing ocultados temporalmente
                <button 
                  className={styles.testCloseButton}
                  onClick={handleTestMarketClose}
                  title="Probar cierre de mercado (solo desarrollo)"
                >
                  🧪 Probar Cierre
                </button>
                <button 
                  className={styles.testRangeButton}
                  onClick={handleTestRangeConversion}
                  title="Convertir rangos a precios fijos (solo administradores)"
                >
                  🔄 Convertir Rangos
                </button>
                <button 
                  className={styles.testRangeButton}
                  onClick={handleAutoConvertRanges}
                  title="Verificar estado del mercado y convertir rangos automáticamente si está cerrado"
                >
                  🤖 Auto Convertir
                </button>
                <button 
                  className={styles.testRangeButton}
                  onClick={handleTestCronJob}
                  title="Probar el cron job de conversión automática (simula la ejecución automática)"
                >
                  🧪 Probar Cron
                </button>
                */}
              </>
            )}
            <button 
              className={styles.updatePricesButton}
              onClick={() => updatePrices(false)}
              disabled={updatingPrices}
            >
              {updatingPrices ? '🔄 Actualizando...' : '📈 Actualizar Precios'}
            </button>
          </div>
        </div>
        
        {loadingAlerts ? (
          <div className={styles.loadingContainer}>
            <p>Cargando alertas...</p>
          </div>
        ) : alertasVigentes.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay alertas vigentes disponibles para compra en este momento.</p>
          </div>
        ) : (
          alertasVigentes.map((alert) => (
            <div key={alert.id} className={`${styles.alertCard} alertCard`}>
              <div className={styles.alertHeader}>
                <h3 className={styles.alertSymbol}>{alert.symbol}</h3>
                <span className={`${styles.alertAction} ${alert.action === 'BUY' ? styles.buyAction : styles.sellAction}`} style={{ display: 'none' }}>
                  {alert.action}
                </span>
              </div>
              
              <div className={styles.alertDetails}>
                <div className={styles.alertDetail} style={{
                  background: 'rgba(55, 65, 81, 0.5)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '8px'
                }}>
                  <span style={{
                    fontSize: '0.85em',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: '600'
                  }}>Precio Entrada:</span>
                  <div style={{ marginTop: '4px' }}>
                    {(alert.tipoAlerta === 'rango' || alert.hasRange) && (alert.precioMinimo && alert.precioMaximo) ? (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        <span style={{ color: '#60a5fa' }}>$</span>
                        <span className="sensitivePrice">{alert.precioMinimo}</span>
                        <span style={{ color: '#60a5fa' }}>-</span>
                        <span className="sensitivePrice">{alert.precioMaximo}</span>
                      </div>
                    ) : alert.entryPrice && typeof alert.entryPrice === 'string' && alert.entryPrice.includes(' / ') ? (
                      // Si entryPrice viene formateado como rango desde el API
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(59, 130, 246, 0.2)'
                      }}>
                        <span className="sensitivePrice" style={{
                          fontSize: '1.1em',
                          color: '#f3f4f6'
                        }}>{alert.entryPrice}</span>
                      </div>
                    ) : (
                      <strong className="sensitivePrice" style={{
                        fontSize: '1.1em',
                        color: '#f3f4f6'
                      }}>{alert.entryPrice || '$0.00'}</strong>
                    )}
                  </div>
                </div>
                <div className={styles.alertDetail}>
                  <span>Precio Actual:</span>
                  <strong className="sensitivePrice">{alert.currentPrice}</strong>
                </div>
                <div className={styles.alertDetail}>
                  <span>Stop Loss:</span>
                  <strong className="sensitivePrice">{alert.stopLoss}</strong>
                </div>
                <div className={styles.alertDetail}>
                  <span>Take Profit:</span>
                  <strong className="sensitivePrice">{alert.takeProfit}</strong>
                </div>
                <div className={styles.alertDetail} style={{ display: 'none' }}>
                  <span>P&L:</span>
                  <strong className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profit : styles.loss}>
                    <span>{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '+' : ''}{(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0).toFixed(2)}%</span>
                    <span className={(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? styles.profitArrow : styles.lossArrow}>
                      {(typeof alert.profit === 'number' ? alert.profit : parseFloat(alert.profit) || 0) >= 0 ? '↗' : '↘'}
                    </span>
                  </strong>
                </div>
              </div>
              
              <div className={styles.alertActions}>
                {userRole === 'admin' && (
                  <button
                    className={styles.editButton}
                    onClick={() => handleEditAlert(alert)}
                    title="Editar alerta"
                  >
                    ✏️ Editar
                  </button>
                )}
                <button
                  className={styles.closeButton}
                  onClick={() => handleClosePosition(alert.id, alert.currentPrice)}
                  disabled={userRole !== 'admin'}
                  title={userRole !== 'admin' ? 'Solo los administradores pueden cerrar posiciones' : 'Cierre total: vender todo y cerrar'}
                  style={{ display: 'none' }}
                >
                  Cierre total
                </button>
                {userRole === 'admin' && (
                  <button
                    className={styles.editButton}
                    onClick={() => handlePartialSale(alert)}
                    title="Venta parcial (25% o 50%)"
                  >
                    💰 Venta Parcial
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderInformes = () => {
    return (
      <div className={styles.informesContent}>
        <div className={styles.informesHeader}>
          <h2 className={styles.sectionTitle}>📊 Informes y Análisis</h2>
          {userRole === 'admin' && (
            <button 
              className={styles.createButton}
              onClick={() => setShowCreateReportModal(true)}
              title="Crear nuevo informe"
            >
              <PlusCircle size={16} />
              Crear Informe
            </button>
          )}
        </div>
        
        {loadingInformes ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>⏳</div>
            <h3>Cargando informes...</h3>
          </div>
        ) : informes.length > 0 ? (
          <>
            <div className={styles.informesList}>
              {informes.map((informe: any) => {
                const reportDate = new Date(informe.publishedAt || informe.createdAt);
                const isRecent = (Date.now() - reportDate.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 días
                // Usar el tiempo de lectura almacenado en la base de datos
                const readTime = informe.readTime || 1;
                
                return (
                  <div key={informe.id || informe._id} className={styles.informeCard} style={informe.isPublished === false ? { border: '2px solid #ef4444', opacity: 0.85 } : {}}>
                    <div className={styles.informeHeader}>
                      <h3>
                        {informe.title}
                        {/* Badge de "No publicado" solo visible para admins */}
                        {userRole === 'admin' && informe.isPublished === false && (
                          <span style={{
                            marginLeft: '10px',
                            padding: '2px 8px',
                            fontSize: '0.7rem',
                            fontWeight: 'bold',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            verticalAlign: 'middle'
                          }}>
                            ⚠️ OCULTO
                          </span>
                        )}
                      </h3>
                      {/* Información del informe en lista - OCULTA */}
                      <div className={styles.informeMeta} style={{ display: 'none' }}>
                        <span className={styles.informeDate}>
                          📅 {reportDate.toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                          {isRecent && (
                            <span className={styles.recentBadge}>NUEVO</span>
                          )}
                        </span>
                        <span className={styles.informeType}>
                          {informe.type === 'video' ? '🎥 Video' : 
                           informe.type === 'analisis' ? '📊 Análisis' : 
                           informe.type === 'mixed' ? '📋 Mixto' : '📄 Informe'}
                        </span>
                        {informe.category && (
                          <span className={styles.informeCategory}>
                            📂 {informe.category.replace('-', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Preview de imágenes del informe */}
                    {informe.images && informe.images.length > 0 && (
                      <div className={styles.informePreviewImages}>
                        {informe.images.slice(0, 1).map((image: any, index: number) => (
                          <div key={index} className={styles.previewImageContainer}>
                            <img 
                              src={image.thumbnailUrl || image.secure_url || image.url} 
                              alt={image.caption || `Preview ${index + 1}`}
                              className={styles.previewImage}
                              loading="lazy"
                            />
                            {informe.images.length > 1 && (
                              <span className={styles.imageCount}>
                                +{informe.images.length - 1} más
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    
                    <div className={styles.informeDescription}>
                      {informe.content ? 
                        (() => {
                          // Limpiar HTML y obtener solo el texto
                          const cleanText = informe.content
                            .replace(/<[^>]*>/g, '') // Remover todas las etiquetas HTML
                            .replace(/&nbsp;/g, ' ') // Reemplazar espacios no separables
                            .replace(/&amp;/g, '&') // Reemplazar entidades HTML
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .trim();
                          
                          return cleanText.length > 200 ? 
                            cleanText.substring(0, 200) + '...' : 
                            cleanText;
                        })() : 
                        'Sin descripción disponible'
                      }
                    </div>

                    {/* Estadísticas del informe */}
                    <div className={styles.informeStats}>
                      {informe.images && informe.images.length > 0 && (
                        <span className={styles.informeStat}>
                          📸 {informe.images.length} imágenes
                        </span>
                      )}
                    </div>

                    {/* Tags del informe */}
                    {informe.tags && informe.tags.length > 0 && (
                      <div className={styles.informeTags}>
                        {informe.tags.slice(0, 3).map((tag: string, index: number) => (
                          <span key={index} className={styles.tag}>
                            {tag}
                          </span>
                        ))}
                        {informe.tags.length > 3 && (
                          <span className={styles.tag}>+{informe.tags.length - 3}</span>
                        )}
                      </div>
                    )}

                    <div className={styles.informeActions}>
                      <button 
                        className={styles.readButton}
                        onClick={() => openReport(informe.id || informe._id)}
                      >
                        📖 Leer Informe Completo
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <div className={styles.paginationInfo}>
                  <span>Mostrando {((currentPage - 1) * informesPerPage) + 1} - {Math.min(currentPage * informesPerPage, totalInformes)} de {totalInformes} informes</span>
                </div>
                <div className={styles.paginationControls}>
                  <button 
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className={`${styles.paginationButton} ${currentPage === 1 ? styles.disabled : ''}`}
                  >
                    <ChevronLeft size={16} />
                    Anterior
                  </button>
                  
                  <div className={styles.pageNumbers}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      // Asegurar que pageNum esté dentro del rango válido
                      if (pageNum < 1 || pageNum > totalPages) {
                        return null;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`${styles.pageButton} ${currentPage === pageNum ? styles.active : ''}`}
                        >
                          {pageNum}
                        </button>
                      );
                    }).filter(Boolean)}
                  </div>
                  
                  <button 
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`${styles.paginationButton} ${currentPage === totalPages ? styles.disabled : ''}`}
                  >
                    Siguiente
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📄</div>
            <h3>No hay informes disponibles</h3>
            <p>Los informes y análisis aparecerán aquí cuando estén disponibles.</p>
          </div>
        )}
      </div>
    );
  };

  // Componente separado para el Chat de Comunidad (memoizado para evitar parpadeo)
  const CommunityChat = React.memo(() => {
    // ✅ NUEVO: Cargar mensaje desde localStorage al iniciar para preservar texto
    const [message, setMessage] = useState(() => {
      if (typeof window !== 'undefined') {
        const savedMessage = localStorage.getItem('smart-money-chat-draft');
        return savedMessage || '';
      }
      return '';
    });
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true); // Nueva estado para carga inicial
    const [replyingTo, setReplyingTo] = useState<any>(null);
    const [isTyping, setIsTyping] = useState(false); // ✅ NUEVO: Detectar si el usuario está escribiendo
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const messageInputRef = useRef<HTMLTextAreaElement>(null); // ✅ NUEVO: Ref para el input
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // ✅ NUEVO: Timeout para detectar cuando deja de escribir

    const scrollToBottom = () => {
      // Hacer scroll solo dentro del contenedor del chat, no de toda la página
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    };

    // Función para convertir URLs en enlaces clicables
    const linkifyText = (text: string) => {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const parts = text.split(urlRegex);
      
      return parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                color: '#4a9eff', 
                textDecoration: 'underline',
                wordBreak: 'break-all'
              }}
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      });
    };

    // Función para borrar mensaje (solo admin)
    const deleteMessage = async (messageId: string) => {
      if (!confirm('¿Estás seguro de eliminar este mensaje?')) return;
      
      try {
        const response = await fetch(`/api/chat/messages?messageId=${messageId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const updatedMessages = messages.filter(m => m._id !== messageId);
          setMessages(updatedMessages);
          
          // Actualizar cache local
          localStorage.setItem('smart-money-chat-messages', JSON.stringify(updatedMessages));
          localStorage.setItem('smart-money-chat-timestamp', Date.now().toString());
        } else {
          alert('Error al eliminar mensaje');
        }
      } catch (error) {
        // console.error('Error eliminando mensaje:', error);
        alert('Error al eliminar mensaje');
      }
    };

    // Control preciso del scroll para evitar movimientos innecesarios
    const [hasLoaded, setHasLoaded] = useState(false);
    const previousMessageCount = useRef(0);

    useEffect(() => {
      // Solo hacer scroll al final si se agregaron mensajes nuevos (no en carga inicial)
      if (hasLoaded && messages.length > previousMessageCount.current) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      }
      previousMessageCount.current = messages.length;
    }, [messages.length, hasLoaded]);

    // Scroll inicial solo cuando termina de cargar por primera vez
    useEffect(() => {
      if (!loading && !hasLoaded && messages.length > 0) {
        setTimeout(() => {
          scrollToBottom();
        }, 100);
        setHasLoaded(true);
      }
    }, [loading, hasLoaded, messages.length]);

    // Cargar mensajes existentes al montar el componente
    useEffect(() => {
      // Esperar 2 segundos antes de empezar a cargar para evitar movimientos bruscos
      const timer = setTimeout(() => {
        fetchMessages();
      }, 2000);

      return () => clearTimeout(timer);
    }, []);

    // ✅ NUEVO: Auto-refresh de mensajes cada 10 segundos, pero solo si el usuario NO está escribiendo
    useEffect(() => {
      const interval = setInterval(() => {
        if (!isTyping) {
          fetchMessages();
        }
      }, 10000); // 10 segundos

      return () => clearInterval(interval);
    }, [isTyping]);

    // ✅ NUEVO: Limpiar timeout al desmontar
    useEffect(() => {
      return () => {
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
      };
    }, []);

    const fetchMessages = async () => {
      // ✅ NUEVO: No recargar si el usuario está escribiendo
      if (isTyping) {
        return;
      }

      try {
        // ✅ NUEVO: Guardar el texto actual antes de recargar
        const currentMessage = messageInputRef.current?.value || message;
        if (currentMessage.trim()) {
          localStorage.setItem('smart-money-chat-draft', currentMessage);
        }

        // Intentar cargar mensajes desde localStorage primero
        const cachedMessages = localStorage.getItem('smart-money-chat-messages');
        const cacheTimestamp = localStorage.getItem('smart-money-chat-timestamp');
        const now = Date.now();
        
        // Si hay cache y tiene menos de 5 minutos, usarlo
        if (cachedMessages && cacheTimestamp && (now - parseInt(cacheTimestamp)) < 300000) {
          setMessages(JSON.parse(cachedMessages));
          setLoading(false);
          // ✅ NUEVO: Restaurar el texto después de actualizar mensajes
          restoreMessage();
          return;
        }

        // Si no hay cache válido, fetch desde API
        const response = await fetch('/api/chat/messages?chatType=smart-money');
        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];
          
          // Guardar en localStorage
          localStorage.setItem('smart-money-chat-messages', JSON.stringify(messages));
          localStorage.setItem('smart-money-chat-timestamp', now.toString());
          
          setMessages(messages);
          // ✅ NUEVO: Restaurar el texto después de actualizar mensajes
          restoreMessage();
        }
      } catch (error) {
        // console.error('Error cargando mensajes:', error);
        // En caso de error, intentar usar cache aunque sea viejo
        const cachedMessages = localStorage.getItem('smart-money-chat-messages');
        if (cachedMessages) {
          setMessages(JSON.parse(cachedMessages));
        }
        // ✅ NUEVO: Restaurar el texto incluso si hay error
        restoreMessage();
      } finally {
        setLoading(false);
      }
    };

    // ✅ NUEVO: Función para restaurar el mensaje desde localStorage
    const restoreMessage = () => {
      const savedMessage = localStorage.getItem('smart-money-chat-draft');
      if (savedMessage && messageInputRef.current) {
        setMessage(savedMessage);
        // Restaurar el valor del textarea directamente
        messageInputRef.current.value = savedMessage;
      }
    };

    const sendMessage = async () => {
      if (message.trim()) {
        try {
          const messageData: any = {
            message: message.trim(),
            chatType: 'smart-money'
          };

          // Si estamos respondiendo a un mensaje, incluir la referencia
          if (replyingTo) {
            messageData.replyTo = {
              messageId: replyingTo._id || replyingTo.id,
              userName: replyingTo.userName,
              message: replyingTo.message
            };
          }

          const response = await fetch('/api/chat/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messageData),
          });

          if (response.ok) {
            const data = await response.json();
            const updatedMessages = [...messages, data.message];
            setMessages(updatedMessages);
            
            // Actualizar cache local
            localStorage.setItem('smart-money-chat-messages', JSON.stringify(updatedMessages));
            localStorage.setItem('smart-money-chat-timestamp', Date.now().toString());
            
            // ✅ NUEVO: Limpiar el draft después de enviar
            setMessage('');
            localStorage.removeItem('smart-money-chat-draft');
            setIsTyping(false);
            setReplyingTo(null); // Limpiar la respuesta
          } else {
            alert('Error al enviar mensaje');
          }
        } catch (error) {
          // console.error('Error enviando mensaje:', error);
          alert('Error al enviar mensaje');
        }
      }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      } else if (e.key === 'Escape') {
        setReplyingTo(null); // Cancelar respuesta con Escape
      }
    };

    const handleReply = (msg: any) => {
      setReplyingTo(msg);
      // Enfocar el input después de seleccionar respuesta
      setTimeout(() => {
        const input = document.querySelector('.messageInput') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    };

    const cancelReply = () => {
      setReplyingTo(null);
    };

    const formatTime = (timestamp: string) => {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      // Si es hoy, solo mostrar hora
      if (date.toDateString() === today.toDateString()) {
        return date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      // Si es ayer, mostrar "Ayer" + hora
      else if (date.toDateString() === yesterday.toDateString()) {
        return `Ayer ${date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      }
      // Si es más antiguo, mostrar fecha completa + hora
      else {
        return `${date.toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit'
        })} ${date.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        })}`;
      }
    };

    // Unificar estados de carga para evitar parpadeo del spinner
    const isShowingLoading = initialLoading || loading;

    // Quitar el estado de carga inicial cuando termine la carga real
    useEffect(() => {
      if (!loading && initialLoading) {
        setInitialLoading(false);
      }
    }, [loading, initialLoading]);

    if (isShowingLoading) {
      return (
        <div className={styles.comunidadContent}>
          <div className={styles.chatContainer}>
            <div className={styles.chatHeader}>
              <div className={styles.chatTitle}>
                <h2>💬 Comunidad Smart Money</h2>
              </div>
            </div>
            <div className={styles.loadingChat}>
              <div className={styles.loadingSpinner}></div>
              <p>Cargando chat...</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.comunidadContent}>
        <div className={styles.chatContainer}>
          <div className={styles.chatHeader}>
            <div className={styles.chatTitle}>
              <h2>💬 Comunidad Smart Money</h2>
            </div>
          </div>
          
          <div
            className={styles.chatMainFull}
            ref={chatContainerRef}
            style={{ opacity: loading ? 0 : 1, transition: 'opacity 0.3s ease-in' }}
          >
            {messages.length === 0 ? (
              <div className={styles.emptyChat}>
                <div className={styles.emptyChatIcon}>💬</div>
                <p>¡Sé el primero en escribir un mensaje!</p>
              </div>
            ) : (
              <div className={styles.messagesContainer}>
                {messages.map((msg, index) => (
                  <div key={msg._id || index} className={styles.chatMessage}>
                    <div className={styles.messageHeader}>
                      <div className={styles.messageUser}>
                        <div className={styles.userAvatar}>
                          <div className={styles.userAvatarPlaceholder}>
                            {msg.userName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                        </div>
                        <span className={styles.userName}>{msg.userName || 'Usuario'}</span>
                      </div>
                      <span className={styles.messageTime}>
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>
                    
                    <div className={styles.messageContent}>
                      {msg.replyTo && (
                        <div className={styles.replyReference}>
                          <div className={styles.replyLine}></div>
                          <div className={styles.replyContent}>
                            <span className={styles.replyUser}>{msg.replyTo.userName}</span>
                            <span className={styles.replyText}>{linkifyText(msg.replyTo.message)}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className={styles.messageText}>{linkifyText(msg.message)}</div>
                    </div>
                    
                    <div className={styles.messageActions}>
                      <button 
                        className={styles.replyButton}
                        onClick={() => handleReply(msg)}
                      >
                        <Reply size={14} />
                        Responder
                      </button>
                      {userRole === 'admin' && (
                        <button 
                          className={styles.deleteButton}
                          onClick={() => deleteMessage(msg._id)}
                          title="Eliminar mensaje"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          <div className={styles.chatInput}>
            {replyingTo && (
              <div className={styles.replyingTo}>
                <div className={styles.replyingHeader}>
                  <span>Respondiendo a {replyingTo.userName}</span>
                  <button onClick={cancelReply} className={styles.cancelReply}>
                    <X size={14} />
                  </button>
                </div>
                <div className={styles.replyingText}>{replyingTo.message}</div>
              </div>
            )}
            
            <div className={styles.inputContainer}>
              <textarea
                ref={messageInputRef}
                className={`${styles.messageInput} messageInput`}
                placeholder="Escribe tu mensaje..."
                value={message}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setMessage(newValue);
                  // ✅ NUEVO: Guardar en localStorage mientras escribe
                  if (newValue.trim()) {
                    localStorage.setItem('smart-money-chat-draft', newValue);
                  } else {
                    localStorage.removeItem('smart-money-chat-draft');
                  }
                  // ✅ NUEVO: Detectar que el usuario está escribiendo
                  setIsTyping(true);
                  // Limpiar timeout anterior
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }
                  // Marcar como "no escribiendo" después de 2 segundos de inactividad
                  typingTimeoutRef.current = setTimeout(() => {
                    setIsTyping(false);
                  }, 2000);
                }}
                onKeyPress={handleKeyPress}
                rows={1}
              />
              <button 
                className={styles.sendButton}
                onClick={sendMessage}
                disabled={!message.trim()}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  });

  // Modal para editar alerta existente
  const renderEditAlertModal = () => {
    if (!showEditAlert) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h3>Editar Alerta - {editingAlert?.symbol}</h3>
            <button
              className={styles.closeModal}
              onClick={() => {
                setShowEditAlert(false);
                setEditingAlert(null);
              }}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.inputGroup}>
              <label>Símbolo de la Acción</label>
              <input
                type="text"
                placeholder="Ej: AAPL, TSLA, MSFT"
                value={editAlert.symbol}
                onChange={(e) => setEditAlert(prev => ({ ...prev, symbol: e.target.value }))}
                className={styles.input}
                readOnly
                disabled
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  cursor: 'not-allowed',
                  opacity: 0.7
                }}
              />
              <small style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                El símbolo no se puede cambiar una vez creada la alerta
              </small>
            </div>

            <div className={styles.inputGroup}>
              <label>Stop Loss</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de stop loss"
                value={editAlert.stopLoss}
                onChange={(e) => setEditAlert(prev => ({ ...prev, stopLoss: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Take Profit</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de take profit"
                value={editAlert.takeProfit}
                onChange={(e) => setEditAlert(prev => ({ ...prev, takeProfit: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Análisis / Descripción</label>
              <textarea
                placeholder="Descripción del análisis técnico o fundamental..."
                value={editAlert.analysis}
                onChange={(e) => setEditAlert(prev => ({ ...prev, analysis: e.target.value }))}
                className={styles.textarea}
                rows={4}
              />
            </div>

            <div className={styles.inputGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={editAlert.availableForPurchase}
                  onChange={(e) => setEditAlert(prev => ({ ...prev, availableForPurchase: e.target.checked }))}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxText}>
                  🛒 Disponible para compra (aparece en Alertas Vigentes)
                </span>
              </label>
              <p className={styles.checkboxDescription}>
                <strong>Marcado:</strong> La alerta aparece en "Alertas Vigentes" (disponible para nuevos clientes) y también en "Seguimiento"<br/>
                <strong>Desmarcado:</strong> La alerta aparece solo en "Seguimiento" (todas las alertas aparecen en Seguimiento)
              </p>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button
              onClick={() => {
                setShowEditAlert(false);
                setEditingAlert(null);
              }}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveEditAlert}
              disabled={editLoading}
              className={styles.createButton}
            >
              {editLoading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderComunidad = () => <CommunityChat />;

  const renderFAQ = () => (
    <div className={styles.faqSection}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>
          Preguntas Frecuentes
        </h2>
        
        <div className={styles.faqContainer}>
          <FAQAccordion 
            faqs={faqs}
            category="smart-money"
            maxItems={20}
          />
        </div>
      </div>
    </div>
  );

  // Modal para crear nueva alerta
  const renderCreateAlertModal = () => {
    if (!showCreateAlert) return null;

    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modalContent}>
          <div className={styles.modalHeader}>
            <h3>Crear Nueva Alerta</h3>
            <button 
              className={styles.closeModal}
              onClick={() => {
                setShowCreateAlert(false);
                setEmailImage(null);
              }}
            >
              ×
            </button>
          </div>

          <div className={styles.modalBody}>
            <div className={styles.inputGroup}>
              <label>Símbolo de la Acción</label>
              <div className={styles.symbolInput}>
                <input
                  type="text"
                  placeholder="Ej: AAPL, TSLA, MSFT"
                  value={newAlert.symbol}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, symbol: e.target.value }))}
                  className={styles.input}
                />
                <button
                  onClick={() => fetchStockPrice(newAlert.symbol)}
                  disabled={!newAlert.symbol || priceLoading}
                  className={styles.getPriceButton}
                >
                  {priceLoading ? 'Cargando...' : 'Obtener Precio'}
                </button>
              </div>
            </div>

            {newAlert.tipoAlerta !== 'rango' && (
              <div className={styles.inputGroup}>
                <label>Precio Acción</label>
                <div className={styles.priceInputContainer}>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio acción"
                    value={stockPrice || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Permitir escribir libremente - solo parsear cuando hay un valor válido
                      if (value === '' || value === null) {
                        setStockPrice(null);
                      } else {
                        const numValue = parseFloat(value);
                        if (!isNaN(numValue)) {
                          setStockPrice(numValue);
                        } else {
                          setStockPrice(null);
                        }
                      }
                    }}
                    readOnly={false} // ✅ CORREGIDO: Siempre permitir edición manual
                    className={styles.input}
                  />
                </div>
              </div>
            )}

            {/* Campo Acción - OCULTO - Siempre BUY */}
            <div className={styles.inputGroup} style={{ display: 'none' }}>
              <label>Acción</label>
              <select
                value={newAlert.action}
                onChange={(e) => setNewAlert(prev => ({ ...prev, action: e.target.value }))}
                className={styles.select}
              >
                <option value="BUY">BUY (Compra)</option>
                <option value="SELL">SELL (Venta)</option>
              </select>
            </div>

            {/* ✅ NUEVO: Toggle para operación histórica */}
            {userRole === 'admin' && (
              <div className={styles.inputGroup}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newAlert.esOperacionHistorica}
                    onChange={(e) => setNewAlert(prev => ({ 
                      ...prev, 
                      esOperacionHistorica: e.target.checked,
                      tipoAlerta: e.target.checked ? 'precio' : prev.tipoAlerta // Forzar precio para históricas
                    }))}
                    style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                  />
                  <span style={{ 
                    color: newAlert.esOperacionHistorica ? '#10B981' : 'rgba(255, 255, 255, 0.7)',
                    fontWeight: newAlert.esOperacionHistorica ? '600' : '400'
                  }}>
                    📜 Es posición existente (operación histórica)
                  </span>
                </label>
                {newAlert.esOperacionHistorica && (
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
                    Importar una operación ya realizada. No se enviará notificación a los suscriptores.
                  </p>
                )}
              </div>
            )}

            {/* ✅ NUEVO: Fecha de entrada para operaciones históricas */}
            {newAlert.esOperacionHistorica && (
              <div className={styles.inputGroup}>
                <label>📅 Fecha de Entrada</label>
                <input
                  type="date"
                  value={newAlert.fechaEntrada}
                  onChange={(e) => setNewAlert(prev => ({ ...prev, fechaEntrada: e.target.value }))}
                  className={styles.input}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            )}

            <div className={styles.inputGroup}>
              <label>Tipo de Alerta</label>
              <select
                value={newAlert.tipoAlerta}
                onChange={(e) => setNewAlert(prev => ({ ...prev, tipoAlerta: e.target.value as 'precio' | 'rango' }))}
                className={`${styles.select} ${newAlert.tipoAlerta === 'rango' ? styles.rangeSelect : ''}`}
                disabled={newAlert.esOperacionHistorica}
              >
                <option value="precio">💰 Precio Específico</option>
                <option value="rango">📊 Rango de Precio</option>
              </select>
            </div>

            {newAlert.tipoAlerta === 'rango' && (
              <>
                <div className={styles.inputGroup}>
                  <label>Precio Mínimo del Rango</label>
                  <div className={styles.symbolInput}>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Precio mínimo"
                      value={newAlert.precioMinimo}
                      onChange={(e) => setNewAlert(prev => ({ ...prev, precioMinimo: e.target.value }))}
                      className={styles.input}
                    />
                    <button
                      onClick={() => fetchStockPrice(newAlert.symbol)}
                      disabled={!newAlert.symbol || priceLoading}
                      className={styles.getPriceButton}
                    >
                      {priceLoading ? 'Cargando...' : 'Obtener Precio'}
                    </button>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>Precio Máximo del Rango</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Precio máximo"
                    value={newAlert.precioMaximo}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, precioMaximo: e.target.value }))}
                    className={styles.input}
                  />
                </div>

                {/* Campo Horario de Cierre - OCULTO */}
                <div className={styles.inputGroup} style={{ display: 'none' }}>
                  <label>Horario de Cierre del Mercado</label>
                  <input
                    type="time"
                    value={newAlert.horarioCierre}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, horarioCierre: e.target.value }))}
                    className={styles.input}
                  />
                </div>
              </>
            )}

            <div className={styles.inputGroup}>
              <label>Stop Loss</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de stop loss"
                value={newAlert.stopLoss}
                onChange={(e) => setNewAlert(prev => ({ ...prev, stopLoss: e.target.value }))}
                className={styles.input}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Take Profit</label>
              <input
                type="number"
                step="0.01"
                placeholder="Precio de take profit"
                value={newAlert.takeProfit}
                onChange={(e) => setNewAlert(prev => ({ ...prev, takeProfit: e.target.value }))}
                className={styles.input}
              />
            </div>

            {/* ✅ NUEVO: Sección de ventas parciales para operaciones históricas */}
            {newAlert.esOperacionHistorica && (
              <div className={styles.inputGroup}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>💸 Ventas Parciales Previas</span>
                  <button
                    type="button"
                    onClick={() => setNewAlert(prev => ({
                      ...prev,
                      ventasParciales: [...prev.ventasParciales, { fecha: '', precio: '', porcentajeVendido: '' }]
                    }))}
                    style={{
                      backgroundColor: 'rgba(139, 92, 246, 0.2)',
                      border: '1px solid rgba(139, 92, 246, 0.5)',
                      borderRadius: '6px',
                      padding: '4px 12px',
                      color: '#A855F7',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    + Agregar Venta
                  </button>
                </label>
                
                {newAlert.ventasParciales.length === 0 && (
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '8px' }}>
                    Si ya vendiste parte de la posición, agregá las ventas aquí.
                  </p>
                )}

                {newAlert.ventasParciales.map((venta, index) => (
                  <div 
                    key={index} 
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr auto',
                      gap: '8px',
                      marginTop: '8px',
                      padding: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}
                  >
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>Fecha de Venta</label>
                      <input
                        type="date"
                        value={venta.fecha}
                        onChange={(e) => {
                          const updated = [...newAlert.ventasParciales];
                          updated[index].fecha = e.target.value;
                          setNewAlert(prev => ({ ...prev, ventasParciales: updated }));
                        }}
                        className={styles.input}
                        max={new Date().toISOString().split('T')[0]}
                        min={newAlert.fechaEntrada}
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>Precio de Venta</label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Precio"
                        value={venta.precio}
                        onChange={(e) => {
                          const updated = [...newAlert.ventasParciales];
                          updated[index].precio = e.target.value;
                          setNewAlert(prev => ({ ...prev, ventasParciales: updated }));
                        }}
                        className={styles.input}
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>% Vendido</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        placeholder="%"
                        value={venta.porcentajeVendido}
                        onChange={(e) => {
                          const updated = [...newAlert.ventasParciales];
                          updated[index].porcentajeVendido = e.target.value;
                          setNewAlert(prev => ({ ...prev, ventasParciales: updated }));
                        }}
                        className={styles.input}
                        style={{ fontSize: '0.875rem' }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = newAlert.ventasParciales.filter((_, i) => i !== index);
                        setNewAlert(prev => ({ ...prev, ventasParciales: updated }));
                      }}
                      style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        border: '1px solid rgba(239, 68, 68, 0.5)',
                        borderRadius: '6px',
                        padding: '8px',
                        color: '#EF4444',
                        cursor: 'pointer',
                        alignSelf: 'end'
                      }}
                      title="Eliminar venta"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* Resumen de participación */}
                {newAlert.ventasParciales.length > 0 && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>📊 Porcentaje vendido:</span>
                      <strong style={{ color: '#EF4444' }}>
                        {newAlert.ventasParciales.reduce((sum, v) => sum + (parseFloat(v.porcentajeVendido) || 0), 0)}%
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>📈 Porcentaje restante:</span>
                      <strong style={{ color: '#10B981' }}>
                        {100 - newAlert.ventasParciales.reduce((sum, v) => sum + (parseFloat(v.porcentajeVendido) || 0), 0)}%
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campo Análisis - OCULTO */}
            <div className={styles.inputGroup} style={{ display: 'none' }}>
              <label>Análisis / Descripción</label>
              <textarea
                placeholder="Descripción del análisis técnico o fundamental..."
                value={newAlert.analysis}
                onChange={(e) => setNewAlert(prev => ({ ...prev, analysis: e.target.value }))}
                className={styles.textarea}
                rows={4}
              />
            </div>

            {/* Selector de Liquidez - Solo para administradores */}
            {userRole === 'admin' && (
              <div className={styles.inputGroup}>
                <label>💰 Asignar Liquidez</label>
                
                {/* ✅ NUEVO: Resumen completo de liquidez */}
                <div className={styles.liquiditySummary} style={{
                  backgroundColor: 'rgba(139, 92, 246, 0.1)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '0.875rem' }}>
                    <div>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>💰 Liquidez Inicial:</span>
                      <br />
                      <strong style={{ color: '#8B5CF6' }}>${liquiditySummary.liquidezInicial.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>📊 Liquidez Total:</span>
                      <br />
                      <strong style={{ color: liquiditySummary.liquidezTotal >= liquiditySummary.liquidezInicial ? '#10B981' : '#EF4444' }}>
                        ${liquiditySummary.liquidezTotal.toFixed(2)}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>💵 Disponible:</span>
                      <br />
                      <strong style={{ color: '#06B6D4' }}>${liquiditySummary.liquidezDisponible.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>🎯 Distribuida:</span>
                      <br />
                      <strong style={{ color: '#F59E0B' }}>${liquiditySummary.liquidezDistribuida.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        {liquiditySummary.ganancia >= 0 ? '📈' : '📉'} Ganancia:
                      </span>
                      <br />
                      <strong style={{ color: liquiditySummary.ganancia >= 0 ? '#10B981' : '#EF4444' }}>
                        {liquiditySummary.ganancia >= 0 ? '+' : ''}${liquiditySummary.ganancia.toFixed(2)}
                        {liquiditySummary.gananciaPorcentaje !== 0 && (
                          <span style={{ fontSize: '0.75rem', marginLeft: '4px' }}>
                            ({liquiditySummary.gananciaPorcentaje >= 0 ? '+' : ''}{liquiditySummary.gananciaPorcentaje.toFixed(1)}%)
                          </span>
                        )}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className={styles.liquiditySelector}>
                  {[0, 2.5, 5, 10, 15, 20].map((percentage) => (
                    <button
                      key={percentage}
                      type="button"
                      className={`${styles.liquidityButton} ${newAlert.liquidityPercentage === percentage ? styles.liquidityButtonActive : ''}`}
                      onClick={() => setNewAlert(prev => ({ ...prev, liquidityPercentage: percentage }))}
                    >
                      <span className={styles.liquidityPercentage}>{percentage}%</span>
                      <span className={styles.liquidityAmount}>
                        ${((liquiditySummary.liquidezTotal * percentage) / 100).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
                {newAlert.liquidityPercentage > 0 && (
                  <div className={styles.liquidityPreview}>
                    💡 Se asignarán <strong>${((liquiditySummary.liquidezTotal * newAlert.liquidityPercentage) / 100).toFixed(2)}</strong> ({newAlert.liquidityPercentage}% del total)
                  </div>
                )}
              </div>
            )}

            <div className={styles.inputGroup}>
              <label>Mensaje personalizado para Email (opcional)</label>
              <textarea
                placeholder="Texto que verán los suscriptores en el correo"
                value={newAlert.emailMessage}
                onChange={(e) => setNewAlert(prev => ({ ...prev, emailMessage: e.target.value }))}
                className={styles.textarea}
                rows={3}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Imagen para Email (opcional)</label>
              {emailImage ? (
                <div className={styles.uploadedImageContainer}>
                  <div className={styles.imagePreviewWrapper}>
                    <img 
                      src={emailImage.secure_url} 
                      alt="Imagen de email" 
                      className={styles.uploadedImagePreview}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={removeEmailImage}
                    className={styles.removeImageButton}
                    title="Eliminar imagen"
                  >
                    <Trash2 size={16} />
                    <span>Eliminar imagen</span>
                  </button>
                </div>
              ) : (
                <ImageUploader
                  onImageUploaded={handleImageUploaded}
                  onUploadStart={handleImageUploadStart}
                  onError={handleImageUploadError}
                  maxFiles={1}
                  maxSizeBytes={5 * 1024 * 1024} // 5MB
                  allowedFormats={['jpeg', 'jpg', 'png', 'gif', 'webp']}
                  buttonText="Subir Imagen para Email"
                  className={styles.emailImageUploader}
                />
              )}
              <p className={styles.helpText}>
                Si no se sube imagen, se usará la imagen del gráfico automáticamente
              </p>
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button 
              onClick={() => {
                setShowCreateAlert(false);
                setEmailImage(null);
              }}
              className={styles.cancelButton}
            >
              Cancelar
            </button>
            <button 
              onClick={handleCreateAlert}
              disabled={
                !newAlert.symbol || 
                !stockPrice || 
                loading || 
                (newAlert.esOperacionHistorica && !newAlert.fechaEntrada) ||
                (newAlert.esOperacionHistorica && newAlert.ventasParciales.reduce((sum, v) => sum + (parseFloat(v.porcentajeVendido) || 0), 0) >= 100)
              }
              className={styles.createButton}
            >
              {loading ? 'Creando...' : (newAlert.esOperacionHistorica ? 'Importar Operación' : 'Crear Alerta')}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.subscriberView}>
      {/* Header de Bienvenida Personalizado */}
      <div className={styles.welcomeHeader}>
        <div className={styles.welcomeContent}>
          <h1 className={styles.welcomeTitle}>
            Hola {session?.user?.name || 'Nahuel'}! Ésta es tu área exclusiva de Smart Money
          </h1>
          <p className={styles.welcomeSubtitle}>
            Aquí tienes acceso completo a todas las alertas y recursos
          </p>
        </div>
      </div>

      {/* Banner de Estado de Suscripción */}
      <SubscriptionBanner service="SmartMoney" />

      {/* Navegación Móvil (Tabs) */}
      <div className={styles.mobileTabs}>
        <button
          className={`${styles.mobileTab} ${activeTab === 'dashboard' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'seguimiento' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('seguimiento')}
        >
          Seguimiento
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'operaciones' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('operaciones')}
        >
          Operaciones
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'vigentes' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('vigentes')}
        >
          Alertas
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'informes' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('informes')}
        >
          Informes
        </button>
        <button
          className={`${styles.mobileTab} ${activeTab === 'comunidad' ? styles.mobileTabActive : ''}`}
          onClick={() => setActiveTab('comunidad')}
        >
          Consultas
        </button>
      </div>

      {/* Layout Principal con Sidebar */}
      <div className={styles.mainLayout}>
        {/* Sidebar de Accesos Rápidos */}
        <aside className={styles.sidebar}>
          <nav className={styles.sidebarNav}>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'dashboard' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <BarChart3 size={20} />
              Dashboard
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'seguimiento' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('seguimiento')}
            >
              <Activity size={20} />
              Seguimiento
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'operaciones' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('operaciones')}
            >
              <TrendingUp size={20} />
              Operaciones
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'vigentes' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('vigentes')}
            >
              <Bell size={20} />
              Alertas Vigentes
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'informes' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('informes')}
            >
              <Download size={20} />
              Informes
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'comunidad' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('comunidad')}
            >
              <MessageCircle size={20} />
              Consultas
            </button>
            <button 
              className={`${styles.sidebarButton} ${activeTab === 'faq' ? styles.sidebarActive : ''}`}
              onClick={() => setActiveTab('faq')}
            >
              <MessageCircle size={20} />
              Preguntas frecuentes
            </button>
          </nav>

          {/* Accesos Rápidos */}
          <div className={styles.quickAccess}>
            <h3 className={styles.quickAccessTitle}>Accesos Rápidos</h3>
            <div className={styles.quickAccessLinks}>
              <Link href="/entrenamientos" className={styles.quickLink}>
                <TrendingUp size={16} />
                Entrenamientos
              </Link>
              <Link href="/asesorias" className={styles.quickLink}>
                <Users size={16} />
                Asesorías
              </Link>
              <Link href="/recursos" className={styles.quickLink}>
                <Download size={16} />
                Recursos
              </Link>
            </div>
          </div>
        </aside>

        {/* Contenido Principal */}
        <main className={styles.mainContent}>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'seguimiento' && renderSeguimientoAlertas()}
          {activeTab === 'operaciones' && (
            <div className="p-6">
              <OperationsTable system="SmartMoney" refreshTrigger={refreshOperationsTrigger} userRole={userRole} />
            </div>
          )}
          {activeTab === 'vigentes' && renderAlertasVigentes()}
          {activeTab === 'informes' && renderInformes()}
          {activeTab === 'comunidad' && renderComunidad()}
          {activeTab === 'faq' && renderFAQ()}
          
          {/* Renderizar OperationsTable siempre para que el refresh funcione, pero ocultarlo */}
          <div style={{ display: 'none' }}>
            <OperationsTable system="SmartMoney" refreshTrigger={refreshOperationsTrigger} />
          </div>
        </main>
      </div>

      {/* Modales */}
      {renderCreateAlertModal()}
      {renderEditAlertModal()}
      {/* Modal de confirmación de cierre */}
      {confirmClose.open && (
        <div className={styles.modalOverlay} onClick={() => setConfirmClose({ open: false })}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <h3>Confirmar cierre</h3>
              <button className={styles.closeModalButton} onClick={() => setConfirmClose({ open: false })}>×</button>
            </div>
            <div className={styles.imageModalContent}>
              <p>¿Estás seguro de cerrar esta posición? Se venderá todo y la alerta pasará a cerrada.</p>
              <div className={styles.inputGroup}>
                <label>Mensaje para Email (opcional)</label>
                <textarea className={styles.textarea} rows={3} placeholder="Texto a incluir en el email" value={closeEmailMessage} onChange={(e) => setCloseEmailMessage(e.target.value)} />
              </div>
              <div className={styles.inputGroup}>
                <label>Imagen para Email (opcional)</label>
                <div className={styles.imageUploadContainer}>
                  {/* Input de archivo */}
                  <div className={styles.fileInputWrapper}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageFileChange}
                      className={styles.fileInput}
                      id="closeEmailImageFile"
                    />
                    <label htmlFor="closeEmailImageFile" className={styles.fileInputLabel}>
                      📁 Seleccionar imagen
                    </label>
                  </div>
                  
                  {/* O separador */}
                  <div className={styles.orSeparator}>O</div>
                  
                  {/* Input de URL */}
                  <input 
                    className={styles.input} 
                    type="text" 
                    placeholder="https://..." 
                    value={closeEmailImageUrl} 
                    onChange={(e) => {
                      setCloseEmailImageUrl(e.target.value);
                      // Limpiar archivo si se ingresa URL
                      if (e.target.value) {
                        setCloseEmailImageFile(null);
                        setCloseEmailImagePreview('');
                      }
                    }} 
                  />
                  
                  {/* Preview de imagen */}
                  {closeEmailImagePreview && (
                    <div className={styles.imagePreview}>
                      <img src={closeEmailImagePreview} alt="Preview" className={styles.previewImage} />
                      <button 
                        type="button"
                        className={styles.removeImageButton}
                        onClick={() => {
                          setCloseEmailImageFile(null);
                          setCloseEmailImagePreview('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {/* Preview de URL */}
                  {closeEmailImageUrl && !closeEmailImagePreview && (
                    <div className={styles.urlPreview}>
                      <span className={styles.urlText}>URL: {closeEmailImageUrl}</span>
                      <button 
                        type="button"
                        className={styles.removeUrlButton}
                        onClick={() => setCloseEmailImageUrl('')}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.clearFilters} onClick={() => setConfirmClose({ open: false })}>Cancelar</button>
              <button 
                className={styles.closeButton} 
                onClick={confirmCloseAction}
                disabled={uploadingCloseImage}
              >
                {uploadingCloseImage ? '⏳ Subiendo imagen...' : 'Cerrar posición'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCreateReportModal && (
        <CreateReportModal
          onClose={() => setShowCreateReportModal(false)}
          onSubmit={handleCreateReport}
          loading={creatingReport}
        />
      )}
      {showEditReportModal && editingReport && (
        <CreateReportModal
          onClose={() => {
            setShowEditReportModal(false);
            setEditingReport(null);
          }}
          onSubmit={handleEditReport}
          loading={creatingReport}
          initialData={editingReport}
          isEdit={true}
        />
      )}
      {showReportModal && selectedReport && (
        <ReportViewModal
          report={selectedReport}
          onClose={closeReportModal}
          onEdit={handleEditReportClick}
          userRole={userRole}
        />
      )}

      {/* Modales de Imágenes */}
      {showImageModal && selectedImage && (
        <div className={styles.modalOverlay} onClick={closeImageModal}>
          <div className={styles.imageModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <h3>Gráfico de TradingView</h3>
              <button className={styles.closeModalButton} onClick={closeImageModal}>
                ×
              </button>
            </div>
            <div className={styles.imageModalContent}>
              <img 
                src={selectedImage.secure_url} 
                alt="Gráfico de TradingView"
                className={styles.modalImage}
              />
              <div className={styles.imageInfo}>
                <span>{selectedImage.width} × {selectedImage.height}</span>
                <span>{Math.round(selectedImage.bytes / 1024)}KB</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdditionalImagesModal && selectedAlertImages.length > 0 && (
        <div className={styles.modalOverlay} onClick={closeAdditionalImagesModal}>
          <div className={styles.additionalImagesModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.imageModalHeader}>
              <h3>Imágenes Adicionales ({selectedAlertImages.length})</h3>
              <button className={styles.closeModalButton} onClick={closeAdditionalImagesModal}>
                ×
              </button>
            </div>
            <div className={styles.additionalImagesContent}>
              {selectedAlertImages.map((image, index) => (
                <div key={image.public_id} className={styles.additionalImageItem}>
                  <img 
                    src={image.secure_url} 
                    alt={`Imagen adicional ${index + 1}`}
                    className={styles.additionalImage}
                  />
                  {image.caption && (
                    <p className={styles.imageCaption}>{image.caption}</p>
                  )}
                  <div className={styles.imageInfo}>
                    <span>{image.width} × {image.height}</span>
                    <span>{Math.round(image.bytes / 1024)}KB</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ✅ NUEVO: Modal de venta con rango de precios */}
      {showPartialSaleModal && partialSaleAlert && (
        <div className={styles.modalOverlay} onClick={() => setShowPartialSaleModal(false)}>
          <div className={styles.partialSaleModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>💰 Vender - {partialSaleAlert.symbol}</h3>
              <button 
                className={styles.closeModal}
                onClick={() => setShowPartialSaleModal(false)}
                disabled={partialSaleLoading}
              >
                ×
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.alertInfo}>
                <p><strong>Precio acción:</strong> {partialSaleAlert.entryPrice}</p>
                <p><strong>Precio actual:</strong> {partialSaleAlert.currentPrice}</p>
                <p><strong>P&L actual:</strong> <span className={partialSaleAlert.profit >= 0 ? styles.profit : styles.loss}>{partialSaleAlert.profit >= 0 ? '+' : ''}{partialSaleAlert.profit?.toFixed(2)}%</span></p>
              </div>

              {/* ✅ NUEVO: Campo de porcentaje personalizable */}
              <div className={styles.inputGroup}>
                <label>Porcentaje de la cartera a vender</label>
                <div className={styles.percentageInputContainer}>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={sellPercentage}
                    onChange={(e) => setSellPercentage(parseInt(e.target.value) || 0)}
                    className={styles.percentageInput}
                    placeholder="50"
                  />
                  <span className={styles.percentageSymbol}>%</span>
                </div>
                <p className={styles.inputDescription}>
                  Porcentaje de tu posición en esta alerta que deseas vender (ej: 5%, 10%, 50%, 100%)
                </p>
                {sellPercentage > 0 && (
                  <p style={{ fontSize: '0.875rem', color: '#EF4444', marginTop: '4px', fontWeight: '500' }}>
                    Venderás {sellPercentage}% de tu posición en {partialSaleAlert.symbol}
                  </p>
                )}
              </div>

              {/* ✅ NUEVO: Rango de precios */}
              <div className={styles.inputGroup}>
                <label>Rango de precios de venta</label>
                <div className={styles.priceRangeContainer}>
                  <div className={styles.priceInputWrapper}>
                    <label className={styles.priceLabel}>Precio mínimo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPriceMin}
                      onChange={(e) => setSellPriceMin(e.target.value)}
                      className={styles.priceInput}
                      placeholder="0.00"
                    />
                  </div>
                  <div className={styles.priceRangeSeparator}>a</div>
                  <div className={styles.priceInputWrapper}>
                    <label className={styles.priceLabel}>Precio máximo</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={sellPriceMax}
                      onChange={(e) => setSellPriceMax(e.target.value)}
                      className={styles.priceInput}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <p className={styles.inputDescription}>
                  Define el rango de precios en el que deseas vender
                </p>
              </div>

              {/* ✅ NUEVO: Mensaje opcional para email */}
              <div className={styles.inputGroup}>
                <label>Mensaje de email (opcional)</label>
                <textarea 
                  className={styles.textarea} 
                  rows={3} 
                  placeholder="Mensaje personalizado para incluir en la notificación" 
                  value={sellEmailMessage} 
                  onChange={(e) => setSellEmailMessage(e.target.value)} 
                />
              </div>

              {/* ✅ NUEVO: Imagen opcional para email */}
              <div className={styles.inputGroup}>
                <label>Imagen para Email (opcional)</label>
                <div className={styles.imageUploadContainer}>
                  {/* Input de archivo */}
                  <div className={styles.fileInputWrapper}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSellImageFileChange}
                      className={styles.fileInput}
                      id="sellEmailImageFile"
                    />
                    <label htmlFor="sellEmailImageFile" className={styles.fileInputLabel}>
                      📁 Seleccionar imagen
                    </label>
                  </div>
                  
                  {/* O separador */}
                  <div className={styles.orSeparator}>O</div>
                  
                  {/* Input de URL */}
                  <input 
                    className={styles.input} 
                    type="text" 
                    placeholder="https://..." 
                    value={sellEmailImageUrl} 
                    onChange={(e) => {
                      setSellEmailImageUrl(e.target.value);
                      // Limpiar archivo si se ingresa URL
                      if (e.target.value) {
                        setSellEmailImageFile(null);
                        setSellEmailImagePreview('');
                      }
                    }} 
                  />
                  
                  {/* Preview de imagen */}
                  {sellEmailImagePreview && (
                    <div className={styles.imagePreview}>
                      <img src={sellEmailImagePreview} alt="Preview" className={styles.previewImage} />
                  <button
                        type="button"
                        className={styles.removeImageButton}
                        onClick={() => {
                          setSellEmailImageFile(null);
                          setSellEmailImagePreview('');
                        }}
                      >
                        ✕
                  </button>
                    </div>
                  )}
                  
                  {/* Preview de URL */}
                  {sellEmailImageUrl && !sellEmailImagePreview && (
                    <div className={styles.urlPreview}>
                      <span className={styles.urlText}>URL: {sellEmailImageUrl}</span>
                  <button
                        type="button"
                        className={styles.removeUrlButton}
                        onClick={() => setSellEmailImageUrl('')}
                      >
                        ✕
                  </button>
                </div>
                  )}
                </div>
              </div>

              {/* ✅ NUEVO: Botón de venta */}
              <div className={styles.modalActions}>
                <button 
                  className={styles.clearFilters} 
                  onClick={() => setShowPartialSaleModal(false)}
                  disabled={partialSaleLoading}
                >
                  Cancelar
                </button>
                <button 
                  className={styles.closeButton} 
                  onClick={executeSellWithRange}
                  disabled={partialSaleLoading || uploadingSellImage}
                >
                  {partialSaleLoading ? '⏳ Procesando...' : uploadingSellImage ? '⏳ Subiendo imagen...' : 'Vender'}
                </button>
              </div>

              {partialSaleLoading && (
                <div className={styles.loadingState}>
                  <div className={styles.spinner}></div>
                  <p>Procesando venta...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tooltip para el gráfico de torta */}
      <div id="chartTooltipDashboard" className={styles.chartTooltip} style={{ display: 'none' }}>
        <div className={styles.tooltipSymbol}></div>
        <div className={styles.tooltipAction}></div>
        <div className={styles.tooltipEntry}></div>
        <div className={styles.tooltipCurrent}></div>
        <div className={styles.tooltipPnl}></div>
        <div className={styles.tooltipStatus}></div>
        <div className={styles.tooltipLiquidity}></div>
        <div className={styles.tooltipShares}></div>
        <div className={styles.tooltipRealized}></div>
      </div>
    </div>
  );
};

const SmartMoneyPage: React.FC<SmartMoneyPageProps> = ({ 
  isSubscribed, 
  metrics, 
  historicalAlerts,
  alertExamples,
  faqs,
  smartHeroVideo
}) => {
  return (
    <>
      <Head>
        <title>Smart Money - Alertas de Trading en Tiempo Real | Nahuel Lozano</title>
        <meta name="description" content="Recibe alertas de trading profesionales en tiempo real con análisis técnico avanzado. Señales precisas de compra y venta para maximizar tus ganancias." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar noSticky={isSubscribed} />
      
      <main className={styles.main}>
        {isSubscribed ? (
          <ScreenshotProtection>
            <SubscriberView faqs={faqs} />
          </ScreenshotProtection>
        ) : (
          <NonSubscriberView 
            metrics={metrics} 
            historicalAlerts={historicalAlerts}
            alertExamples={alertExamples}
            faqs={faqs}
            smartHeroVideo={smartHeroVideo}
          />
        )}
      </main>

      <Footer />
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  // Verificar autenticación y suscripción
  let isSubscribed = false;
  
  try {
    // Importar dinámicamente para evitar errores de SSR
    const { getSession } = await import('next-auth/react');
    const dbConnect = (await import('@/lib/mongodb')).default;
    const User = (await import('@/models/User')).default;

    const session = await getSession(context);
    
    if (session?.user?.email) {
      await dbConnect();
      const user = await User.findOne({ email: session.user.email });
      
      if (user) {
        // Verificar si tiene suscripción activa a SmartMoney
        const suscripcionActiva = user.suscripciones?.find(
          (sub: any) => 
            sub.servicio === 'SmartMoney' && 
            sub.activa === true && 
            new Date(sub.fechaVencimiento) > new Date()
        );
        
        // También verificar en el array alternativo
        const subscriptionActiva = user.subscriptions?.find(
          (sub: any) => 
            sub.tipo === 'SmartMoney' && 
            sub.activa === true &&
            (!sub.fechaFin || new Date(sub.fechaFin) > new Date())
        );

        // ✅ IMPORTANTE: Verificar también en activeSubscriptions (MercadoPago)
        const activeSubscription = user.activeSubscriptions?.find(
          (sub: any) => 
            sub.service === 'SmartMoney' && 
            sub.isActive === true &&
            new Date(sub.expiryDate) > new Date()
        );

        // ✅ IMPORTANTE: Solo verificar suscripciones específicas a SmartMoney
        // NO verificar por rol general para evitar acceso cruzado entre servicios
        isSubscribed = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
        
        // console.log('🔍 Verificación de suscripción SmartMoney:', {
        //   email: user.email,
        //   role: user.role,
        //   suscripcionActiva: !!suscripcionActiva,
        //   subscriptionActiva: !!subscriptionActiva,
        //   activeSubscription: !!activeSubscription,
        //   activeSubscriptionDetails: activeSubscription ? {
        //     service: activeSubscription.service,
        //     isActive: activeSubscription.isActive,
        //     expiryDate: activeSubscription.expiryDate,
        //     expired: new Date(activeSubscription.expiryDate) <= new Date()
        //   } : null,
        //   isSubscribed
        // });
      }
    }
  } catch (error) {
    // console.error('Error verificando suscripción:', error);
    // En caso de error, mostramos vista no suscrita por defecto
    isSubscribed = false;
  }

  const metrics = {
    performance: '+87.5%',
    activeUsers: '+500',
    alertsSent: '+1,300',
    accuracy: '92.3%'
  };

  // Obtener configuración del sitio para ejemplos de alertas y FAQs
  let alertExamples: AlertExample[] = [];
  let faqs: FAQ[] = [];
  
  try {
    const dbConnect = (await import('@/lib/mongodb')).default;
    const SiteConfig = (await import('@/models/SiteConfig')).default;
    
    await dbConnect();
    const siteConfig = await SiteConfig.findOne({}).lean();
    
    if (siteConfig) {
      alertExamples = (siteConfig as any).alertExamples?.smartMoney || [];
      faqs = (siteConfig as any).faqs?.filter((faq: any) => 
        faq.visible && (faq.category === 'smart-money' || faq.category === 'general')
      ) || [];
    }
  } catch (error) {
    // console.error('Error obteniendo configuración del sitio:', error);
  }

  // Si no hay datos en la configuración, usar datos de ejemplo
  if (alertExamples.length === 0) {
    alertExamples = [
      {
        id: 'example-1',
        title: 'Alerta Smart Money - Compra',
        description: 'Señal de compra siguiendo el dinero inteligente con análisis institucional y flujo de capital.',
        chartImage: '/logos/ALERTA SM COMPRA.png',
        entryPrice: 'USD $2,850.00',
        exitPrice: 'USD $3,420.00',
        profit: '$570.00',
        profitPercentage: '+20.0%',
        riskLevel: 'ALTO' as const,
        status: 'CERRADO TP1' as const,
        country: 'Global',
        ticker: 'SM',
        order: 1
      },
      {
        id: 'example-2',
        title: 'Alerta Smart Money - Venta Parcial',
        description: 'Toma de ganancias parcial siguiendo movimientos institucionales y análisis de flujo.',
        chartImage: '/logos/ALERTA SM VENTA PARCIAL.png',
        entryPrice: 'USD $3,200.00',
        exitPrice: 'USD $3,840.00',
        profit: '$640.00',
        profitPercentage: '+20.0%',
        riskLevel: 'ALTO' as const,
        status: 'CERRADO TP1 Y SL' as const,
        country: 'Global',
        ticker: 'SM',
        order: 2
      },
      {
        id: 'example-3',
        title: 'Alerta Smart Money - Venta Parcial 2',
        description: 'Segunda toma de ganancias parcial con análisis de flujo institucional avanzado.',
        chartImage: '/logos/ALERTA SM VENTA PARCIAL 2.png',
        entryPrice: 'USD $3,500.00',
        exitPrice: 'USD $4,200.00',
        profit: '$700.00',
        profitPercentage: '+20.0%',
        riskLevel: 'ALTO' as const,
        status: 'CERRADO TP1 Y SL' as const,
        country: 'Global',
        ticker: 'SM',
        order: 3
      },
      {
        id: 'example-4',
        title: 'Alerta Smart Money - Venta Total',
        description: 'Cierre completo de posición siguiendo salida del dinero inteligente y análisis institucional.',
        chartImage: '/logos/ALERTA SM VENTA TOTAL.png',
        entryPrice: 'USD $4,000.00',
        exitPrice: 'USD $4,800.00',
        profit: '$800.00',
        profitPercentage: '+20.0%',
        riskLevel: 'ALTO' as const,
        status: 'CERRADO TP1' as const,
        country: 'Global',
        ticker: 'SM',
        order: 4
      }
    ];
  }

  if (faqs.length === 0) {
    faqs = [
      {
        id: 'faq-1',
        question: '¿Qué es Smart Money?',
        answer: 'Es un servicio de suscripción de alertas mediano/largo plazo, donde buscaremos detectar activos que se encuentren subvaluados en el mercado para poder sacarle rendimientos. Este servicio tiene como finalidad encontrar oportunidades en el mercado de aquellos activos financieros que se precien de tener un rendimiento potencial significativo en el largo plazo. Con este servicio podrás armar de forma fácil y práctica una cartera de inversión profesional que obtenga rentabilidades constantes y crecientes a lo largo del tiempo, sin la necesidad de asumir un riesgo muy elevado. Ideal para inversores pacientes y que opten por un plazo de inversión más largo.',
        category: 'smart-money' as const,
        order: 1,
        visible: true
      },
      {
        id: 'faq-2',
        question: '¿Como funcionan los informes de mercado?',
        answer: 'Los informes y seguimiento de la cartera de inversión se realizan mediante la página web, donde detallamos los principales datos financieros de la semana y qué activos identificamos como oportunidad.\n\nLa publicación de los informes es de modalidad semanal, los días viernes entre las 18 y las 22 hs. Se responderán consultas y dudas de los suscriptores en un lapso no mayor a 48 hs. En cada informe se presentarán los principales datos financieros de la semana y se realizará un repaso del estado actual de todos los activos en cartera, detallando su situación actual. Los activos seleccionados están rigurosamente analizados y tienen como horizonte de inversión desde unos pocos meses hasta incluso varios años.\n\nAl momento de encontrar una oportunidad de mercado, se pasará una alerta de inversión y se añadirá a la cartera del servicio, detallando fecha, precio, objetivos y fundamentos de la inversión.\n\nEl análisis, las alertas y el seguimiento se realizan sobre el activo que cotiza en USA, en dólares. Sin embargo, esto no presenta inconvenientes para realizar operaciones en CEDEARs contra pesos en Argentina. Esto permite que puedas ingresar en cada alerta con menor cantidad de dinero y en pesos, ya que los CEDEARs cotizan tanto en pesos como en dólares y cuentan con un ratio de conversión que facilita el acceso a inversores con menor capital inicial. De hecho, el servicio contempla la inversión en CEDEARs y en pesos como la preferible, dado que suele haber mucho más volumen de operaciones en el mercado local en esa moneda.\n\nCada alerta de compra tiene asignado un nivel de riesgo propio, que contempla tanto el riesgo del contexto general de mercado como el riesgo particular de cada activo.\n\nEste servicio no tiene vínculo alguno con brokers de bolsa argentinos o internacionales, por lo que dicha estrategia puede ser aplicada por los inversores en cualquier cuenta de inversiones, independientemente del broker o intermediario que utilicen.',
        category: 'smart-money' as const,
        order: 2,
        visible: true
      },
      {
        id: 'faq-3',
        question: '¿Las alertas tienen vencimiento?',
        answer: 'Sí, tanto las alertas de compra como de venta tienen una semana de vencimiento. Esto se debe a que el análisis realizado del activo y del contexto en general cambia constantemente, siguiendo el desarrollo del mercado. En cada informe detallamos a qué activos, de los que ya tuvieron alertas de compra con fechas anteriores, se puede ingresar la semana siguiente en caso de que hubiera alguno.',
        category: 'smart-money' as const,
        order: 3,
        visible: true
      },
      {
        id: 'faq-4',
        question: '¿Cuánto dinero hay que invertir?',
        answer: 'No hay un mínimo de dinero con el que tengas que empezar, pero una suma recomendable sería el equivalente a u$D 1.000.',
        category: 'smart-money' as const,
        order: 4,
        visible: true
      },
      {
        id: 'faq-5',
        question: '¿Como son los pagos de la suscripción?',
        answer: 'Solo aceptamos suscripciones y pagos por mercadopago\n\nLos cobros de mercado pago son automáticos y tienen en cuenta la oferta de los 30 días gratis, por lo que usted empezará a pagar su suscripción luego de 30 días. Todos los 1ro de mes, se debitará del método de pago asociado el importe de la suscripción con la referencia "SMARTMONEY". En el caso del primer pago, luego de los 30 días gratis, se debitará el prorrateo correspondiente de los días del mes en curso hasta llegar al primer día del mes siguiente. Esto quiere decir, que el primer cobro por la suscripción, que será luego de los 30 días de iniciada la suscripción, puede ser menor al valor del mes entero, ya que corresponden al prorrateo de días. Luego de hecho el primer pago, todos los 1ro de cada mes, se debitará el valor total de la suscripción. Cabe destacar, que son días corridos y no días hábiles.\n\nIMPORTANTE: Tenga a bien contar con los fondos suficientes en el método de pago seleccionado para no tener inconvenientes con el estado de su suscripción.\n\nES OPORTUNO ACLARAR QUE, EN NINGÚN CASO SE COBRARÁN COMISIONES EXTRAS A LA HORA DE REALIZAR LAS OPERACIONES A MERCADO, YA QUE NO EXISTE VÍNCULO ALGUNO ENTRE EL SERVICIO DE ALERTAS Y NINGUN BROKER DE BOLSA ARGENTINO O INTERNACIONAL.\n\nTenga en cuenta que las comunicaciones respecto al estado de su suscripción serán por correo electrónico, el mismo con el cual se realizó la suscripción por mercadopago. no se harán comunicaciones de este tipo por telegram.',
        category: 'smart-money' as const,
        order: 5,
        visible: true
      },
      {
        id: 'faq-6',
        question: '¿SEGUÍs con dudas?',
        answer: 'Escribime un correo ELECTRÓNICO a la siguiente casilla para resolver las dudas que te puedan surgir: lozanonahuel@gmail.com',
        category: 'smart-money' as const,
        order: 6,
        visible: true
      }
    ];
  }

  const historicalAlerts: HistoricalAlert[] = [
    {
      date: '20/06/2023',
      riskLevel: 'MEDIO',
      status: 'CERRADO TP1',
      country: 'United States',
      ticker: 'AAPL',
      entryPrice: '$44.50',
      currentPrice: '$50.60',
      takeProfit1: '$45.30',
      takeProfit2: '$63.25',
      stopLoss: '$75.00',
      div: '$41.18',
      exitPrice: '$45.30',
      profitPercentage: '+1.80%'
    },
    {
      date: '29/06/2023',
      riskLevel: 'ALTO',
      status: 'CERRADO TP1 Y SL',
      country: 'United States',
      ticker: 'TSLA',
      entryPrice: '$98.52',
      currentPrice: '$47.71',
      takeProfit1: '$63.25',
      stopLoss: '$60.09',
      div: '$82.09',
      exitPrice: '$82.09',
      profitPercentage: '-16.70%'
    },
    {
      date: '30/06/2023',
      riskLevel: 'BAJO',
      status: 'CERRADO SL',
      country: 'Canada',
      ticker: 'SHOP',
      entryPrice: '$16.93',
      currentPrice: '$1.08',
      takeProfit1: '$19.12',
      takeProfit2: '$21.12',
      stopLoss: '$16.78',
      div: '$16.78',
      exitPrice: '$16.78',
      profitPercentage: '-0.89%'
    },
    {
      date: '30/06/2023',
      riskLevel: 'ALTO',
      status: 'CERRADO TP1 Y SL',
      country: 'Canada',
      ticker: 'SHOP',
      entryPrice: '$49.98',
      currentPrice: '$119.20',
      takeProfit1: '$53.31',
      stopLoss: '$50.60',
      div: '$50.60',
      exitPrice: '$54.15',
      profitPercentage: '+8.35%'
    },
    {
      date: '03/07/2023',
      riskLevel: 'BAJO',
      status: 'CERRADO TP1',
      country: 'Canada',
      ticker: 'SHOP',
      entryPrice: '$14.81',
      currentPrice: '$29.70',
      takeProfit1: '$16.50',
      stopLoss: '$15.57',
      div: '$15.57',
      exitPrice: '$16.04',
      profitPercentage: '+8.27%'
    }
  ];

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const siteConfigRes = await fetch(`${baseUrl}/api/site-config`);
  const siteConfig = siteConfigRes.ok ? await siteConfigRes.json() : null;
  const smartHeroVideo = siteConfig?.alertsVideos?.smartMoney?.heroVideo || null;

  return {
    props: {
      isSubscribed,
      metrics,
      historicalAlerts,
      alertExamples,
      faqs,
      smartHeroVideo
    }
  };
};

// Componente YouTubeAutoCarousel idéntico al de la landing page
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

export default SmartMoneyPage; 