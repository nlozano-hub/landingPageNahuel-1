import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Calendar,
  RefreshCw,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useUserSubscriptions, UserSubscription, PaymentHistory } from '@/hooks/useUserSubscriptions';
import { useSubscriptionBlock } from '@/hooks/useSubscriptionBlock';
import styles from '@/styles/UserSubscriptions.module.css';

const getServiceDisplayName = (service: string) => {
  const serviceNames: { [key: string]: string } = {
    'TraderCall': 'Trader Call',
    'SmartMoney': 'Smart Money',
    'SwingTrading': 'Zero 2 Trader',
    'ConsultorioFinanciero': 'Consultorio Financiero'
  };
  return serviceNames[service] || service;
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
    case 'active':
      return <CheckCircle size={20} className={styles.statusActive} />;
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return <XCircle size={20} className={styles.statusExpired} />;
    case 'pending':
      return <Clock size={20} className={styles.statusPending} />;
    case 'unknown':
    case 'desconocido':
      return <AlertTriangle size={20} className={styles.statusUnknown} />;
    default:
      return <CheckCircle size={20} className={styles.statusActive} />;
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'approved':
    case 'active':
      return 'Aprobado';
    case 'rejected':
      return 'Rechazado';
    case 'cancelled':
      return 'Cancelado';
    case 'expired':
      return 'Expirado';
    case 'pending':
      return 'Pendiente';
    case 'unknown':
    case 'desconocido':
      return 'Desconocido';
    default:
      return 'Aprobado';
  }
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: currency || 'ARS'
  }).format(amount);
};

const getDaysUntilExpiry = (expiryDate: string) => {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function UserSubscriptions() {
  const { isBlocked: isSubscriptionBlocked } = useSubscriptionBlock();
  const { 
    subscriptions, 
    paymentHistory, 
    loading, 
    error, 
    stats, 
    refreshSubscriptions 
  } = useUserSubscriptions();

  const handleRenewSubscription = async (service: string) => {
    try {
      // console.log('🔄 Iniciando renovación para:', service);
      
      // Llamar al endpoint de renovación para crear el checkout
      const response = await fetch('/api/payments/mercadopago/create-renewal-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ service })
      });

      if (!response.ok) {
        throw new Error('Error al crear checkout de renovación');
      }

      const data = await response.json();

      if (data.success && data.checkoutUrl) {
        // console.log('✅ Redirigiendo al checkout de MercadoPago');
        // Redirigir al checkout de MercadoPago
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No se pudo obtener URL de checkout');
      }
    } catch (error) {
      console.error('❌ Error al renovar suscripción:', error);
      alert('Error al procesar la renovación. Por favor intenta nuevamente.');
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Cargando suscripciones...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <AlertTriangle size={24} />
        <p>Error al cargar suscripciones: {error}</p>
        <button onClick={refreshSubscriptions} className={styles.retryButton}>
          <RefreshCw size={16} />
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Estadísticas */}
      <motion.div 
        className={styles.statsGrid}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <CheckCircle size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>{stats.activeSubscriptions}</h3>
            <p>Suscripciones Activas</p>
          </div>
        </div>


        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statContent}>
            <h3>{paymentHistory.length}</h3>
            <p>Transacciones</p>
          </div>
        </div>
      </motion.div>

      {/* Suscripciones Activas */}
      <motion.div 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className={styles.sectionHeader}>
          <h2>Suscripciones Activas</h2>
          <button onClick={refreshSubscriptions} className={styles.refreshButton}>
            <RefreshCw size={16} />
            Actualizar
          </button>
        </div>

        {subscriptions.filter(sub => sub.status === 'active').length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle size={48} />
            <h3>No tienes suscripciones activas</h3>
            <p>Explora nuestros servicios para comenzar</p>
          </div>
        ) : (
          <div className={styles.subscriptionsGrid}>
            {subscriptions
              .filter(sub => sub.status === 'active')
              .map((subscription, index) => {
                const daysUntilExpiry = getDaysUntilExpiry(subscription.expiryDate);
                const isExpiringSoon = daysUntilExpiry <= 7;

                return (
                  <motion.div
                    key={`${subscription.service}-${index}`}
                    className={`${styles.subscriptionCard} ${isExpiringSoon ? styles.expiringSoon : ''}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.serviceInfo}>
                        <h3>{getServiceDisplayName(subscription.service)}</h3>
                        <div className={styles.statusContainer}>
                          {getStatusIcon(subscription.status)}
                          <span className={styles.statusText}>
                            {getStatusText(subscription.status)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.amount}>
                        {formatCurrency(subscription.amount, subscription.currency)}
                      </div>
                    </div>

                    <div className={styles.cardContent}>
                      <div className={styles.dateInfo}>
                        <div className={styles.dateItem}>
                          <Calendar size={16} />
                          <span>Inicio: {formatDate(subscription.startDate)}</span>
                        </div>
                        <div className={styles.dateItem}>
                          <Calendar size={16} />
                          <span>Expira: {formatDate(subscription.expiryDate)}</span>
                        </div>
                      </div>

                      {isExpiringSoon && (
                        <div className={styles.expiryWarning}>
                          <AlertTriangle size={16} />
                          <span>Expira en {daysUntilExpiry} días</span>
                        </div>
                      )}

                      {subscription.transactionId && (
                        <div className={styles.paymentInfo}>
                          <span>ID: {subscription.transactionId}</span>
                        </div>
                      )}

                      {/* Botón de renovar */}
                      {!isSubscriptionBlocked && (
                        <button
                          onClick={() => handleRenewSubscription(subscription.service)}
                          className={styles.renewButton}
                        >
                          <RefreshCw size={16} />
                          Renovar Ahora
                        </button>
                      )}
                      
                      {isExpiringSoon && (
                        <p className={styles.renewTip}>
                          💡 Si renovás ahora, tu tiempo actual se mantendrá y se agregará 30 días más
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}
      </motion.div>

      {/* Suscripciones Expiradas - Con opción de renovar */}
      {subscriptions.filter(sub => sub.status === 'expired').length > 0 && (
        <motion.div 
          className={styles.section}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <div className={styles.sectionHeader}>
            <h2>Suscripciones Expiradas</h2>
          </div>

          <div className={styles.subscriptionsGrid}>
            {subscriptions
              .filter(sub => sub.status === 'expired')
              .map((subscription, index) => {
                const daysSinceExpiry = Math.abs(getDaysUntilExpiry(subscription.expiryDate));

                return (
                  <motion.div
                    key={`expired-${subscription.service}-${index}`}
                    className={`${styles.subscriptionCard} ${styles.expiredCard}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.serviceInfo}>
                        <h3>{getServiceDisplayName(subscription.service)}</h3>
                        <div className={styles.statusContainer}>
                          {getStatusIcon(subscription.status)}
                          <span className={styles.statusText}>
                            {getStatusText(subscription.status)}
                          </span>
                        </div>
                      </div>
                      <div className={styles.amount}>
                        {formatCurrency(subscription.amount, subscription.currency)}
                      </div>
                    </div>

                    <div className={styles.cardContent}>
                      <div className={styles.dateInfo}>
                        <div className={styles.dateItem}>
                          <Calendar size={16} />
                          <span>Inicio: {formatDate(subscription.startDate)}</span>
                        </div>
                        <div className={styles.dateItem}>
                          <Calendar size={16} />
                          <span>Expiró: {formatDate(subscription.expiryDate)}</span>
                        </div>
                      </div>

                      <div className={styles.expiredWarning}>
                        <XCircle size={16} />
                        <span>Expiró hace {daysSinceExpiry} día{daysSinceExpiry !== 1 ? 's' : ''}</span>
                      </div>

                      {/* Botón de renovar para suscripciones expiradas */}
                      {!isSubscriptionBlocked && (
                        <button
                          onClick={() => handleRenewSubscription(subscription.service)}
                          className={styles.renewButtonExpired}
                        >
                          <RefreshCw size={16} />
                          Renovar Suscripción
                        </button>
                      )}
                      
                      <p className={styles.renewTip}>
                        💡 Renová ahora para recuperar el acceso a {getServiceDisplayName(subscription.service)}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Historial de Pagos */}
      <motion.div 
        className={styles.section}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className={styles.sectionHeader}>
          <h2>Historial de Pagos</h2>
        </div>

        {paymentHistory.length === 0 ? (
          <div className={styles.emptyState}>
            <DollarSign size={48} />
            <h3>No hay historial de pagos</h3>
            <p>Realiza tu primera compra para ver el historial</p>
          </div>
        ) : (
          <div className={styles.paymentHistory}>
            {paymentHistory.map((payment, index) => (
              <motion.div
                key={payment.id}
                className={styles.paymentItem}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <div className={styles.paymentHeader}>
                  <div className={styles.paymentService}>
                    <h4>{getServiceDisplayName(payment.service)}</h4>
                    <div className={styles.paymentStatus}>
                      {getStatusIcon(payment.status)}
                      <span>{getStatusText(payment.status)}</span>
                    </div>
                  </div>
                  <div className={styles.paymentAmount}>
                    {formatCurrency(payment.amount, payment.currency)}
                  </div>
                </div>

                <div className={styles.paymentDetails}>
                  <div className={styles.paymentDate}>
                    <Calendar size={14} />
                    <span>{formatDate(payment.transactionDate)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
