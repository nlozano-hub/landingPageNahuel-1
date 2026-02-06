import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, CheckCircle, RefreshCw, X } from 'lucide-react';
import { useSubscriptionBlock } from '@/hooks/useSubscriptionBlock';
import styles from '@/styles/SubscriptionBanner.module.css';

interface SubscriptionBannerProps {
  service: 'TraderCall' | 'SmartMoney';
}

interface SubscriptionInfo {
  expiryDate: string;
  daysLeft: number;
  isActive: boolean;
}

export default function SubscriptionBanner({ service }: SubscriptionBannerProps) {
  const { isBlocked: isSubscriptionBlocked } = useSubscriptionBlock();
  const [subscriptionInfo, setSubscriptionInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, [service]);

  const fetchSubscriptionInfo = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/subscriptions');
      
      if (response.ok) {
        const data = await response.json();
        const activeSubs = data.activeSubscriptions || [];
        
        // Buscar la suscripción del servicio actual
        const currentSub = activeSubs.find(
          (sub: any) => sub.service === service && sub.status === 'active'
        );

        if (currentSub) {
          const now = new Date();
          const expiryDate = new Date(currentSub.expiryDate);
          const diffTime = expiryDate.getTime() - now.getTime();
          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          setSubscriptionInfo({
            expiryDate: currentSub.expiryDate,
            daysLeft,
            isActive: daysLeft > 0
          });
        } else {
          setSubscriptionInfo(null);
        }
      }
    } catch (error) {
      console.error('Error cargando información de suscripción:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async () => {
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

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (loading || !subscriptionInfo || dismissed) {
    return null;
  }

  const { daysLeft, expiryDate } = subscriptionInfo;
  const isExpiringSoon = daysLeft <= 7;
  const isExpired = daysLeft <= 0;

  const getIcon = () => {
    if (isExpired) return <X size={20} />;
    if (isExpiringSoon) return <AlertTriangle size={20} />;
    return <CheckCircle size={20} />;
  };

  const getMessage = () => {
    if (isExpired) {
      return 'Tu suscripción ha expirado';
    }
    if (daysLeft === 1) {
      return 'Tu suscripción expira mañana';
    }
    if (daysLeft <= 3) {
      return `Tu suscripción expira en ${daysLeft} días`;
    }
    if (daysLeft <= 7) {
      return `Quedan ${daysLeft} días de suscripción`;
    }
    return `Suscripción activa • ${daysLeft} días restantes`;
  };

  const getBannerClass = () => {
    if (isExpired) return styles.bannerExpired;
    if (isExpiringSoon) return styles.bannerWarning;
    return styles.bannerActive;
  };

  return (
    <AnimatePresence>
      <motion.div
        className={`${styles.banner} ${getBannerClass()}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <div className={styles.bannerContent}>
          <div className={styles.bannerIcon}>
            {getIcon()}
          </div>
          
          <div className={styles.bannerMessage}>
            <span className={styles.mainMessage}>{getMessage()}</span>
            {!isExpired && (
              <span className={styles.expiryDate}>
                Vence el {new Date(expiryDate).toLocaleDateString('es-AR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            )}
          </div>

          {(isExpiringSoon || isExpired) && !isSubscriptionBlocked && (
            <button
              onClick={handleRenew}
              className={styles.renewButton}
            >
              <RefreshCw size={16} />
              Renovar
            </button>
          )}

          <button
            onClick={handleDismiss}
            className={styles.dismissButton}
            aria-label="Cerrar"
          >
            <X size={16} />
          </button>
        </div>

        {isExpiringSoon && !isExpired && (
          <div className={styles.tip}>
            💡 Si renovás ahora, tu tiempo actual se mantendrá y se agregarán 30 días más
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

