import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, RefreshCw, Shield } from 'lucide-react';
import styles from '../../../styles/PaymentFailure.module.css';

/** Formatea valores que pueden ser null/undefined o el string "null" */
function formatValue(val: string | null | undefined): string {
  if (val == null || val === '' || String(val).toLowerCase() === 'null') {
    return '—';
  }
  return String(val);
}

interface PaymentFailureProps {
  collectionId: string | null;
  collectionStatus: string | null;
  paymentId: string | null;
  status: string | null;
  externalReference: string | null;
  paymentType: string | null;
  merchantOrderId: string | null;
  preferenceId: string | null;
  siteId: string | null;
  processingMode: string | null;
  merchantAccountId: string | null;
}

export default function PaymentFailurePage({
  paymentId,
  status,
  externalReference,
  preferenceId
}: PaymentFailureProps) {
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryPayment = async () => {
    setIsRetrying(true);
    try {
      router.push('/entrenamientos/zero2trader');
    } catch (error) {
      console.error('Error al reintentar pago:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  const hasUsefulDetails =
    (externalReference && formatValue(externalReference) !== '—') ||
    (preferenceId && formatValue(preferenceId) !== '—') ||
    (paymentId && formatValue(paymentId) !== '—') ||
    (status && formatValue(status) !== '—');

  return (
    <>
      <Head>
        <title>Pago No Completado - Zero 2 Trader | Lozano Nahuel</title>
        <meta name="description" content="Tu pago no pudo ser procesado. No se ha cobrado nada. Intenta nuevamente para acceder al entrenamiento de Zero 2 Trader." />
      </Head>

      <div className={styles.container}>
        <div className={styles.content}>
          <div className={styles.iconContainer}>
            <AlertCircle size={64} className={styles.errorIcon} />
          </div>

          <h1 className={styles.title}>Pago No Completado</h1>
          
          <p className={styles.description}>
            Tu pago para el entrenamiento de <strong>Zero 2 Trader</strong> no pudo ser procesado. 
            No te preocupes: <strong>no se ha cobrado nada</strong> y podés intentar nuevamente cuando quieras.
          </p>

          <div className={styles.securityInfo}>
            <Shield size={20} />
            <span>Tu información está protegida y segura</span>
          </div>

          {hasUsefulDetails && (
            <div className={styles.details}>
              <h3>Referencia para soporte</h3>
              <ul>
                {externalReference && formatValue(externalReference) !== '—' && (
                  <li><strong>Referencia:</strong> {externalReference}</li>
                )}
                {preferenceId && formatValue(preferenceId) !== '—' && (
                  <li><strong>ID de Preferencia:</strong> {preferenceId}</li>
                )}
                {paymentId && formatValue(paymentId) !== '—' && (
                  <li><strong>ID de Pago:</strong> {paymentId}</li>
                )}
                {status && formatValue(status) !== '—' && (
                  <li><strong>Estado:</strong> {status}</li>
                )}
              </ul>
            </div>
          )}

          <div className={styles.actions}>
            <button 
              onClick={handleRetryPayment}
              className={styles.retryButton}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <>
                  <RefreshCw size={20} className={styles.spinner} />
                  Procesando...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Intentar Nuevamente
                </>
              )}
            </button>

            <Link href="/entrenamientos/zero2trader" className={styles.backButton}>
              <ArrowLeft size={20} />
              Volver al Entrenamiento
            </Link>
          </div>

          <div className={styles.help}>
            <h3>¿Necesitas ayuda?</h3>
            <p>
              Si el problema persiste, contactanos y te ayudamos. Incluí la referencia de arriba si la tenés.
            </p>
            <a href="mailto:soporte@lozanonahuel.com?subject=Consulta%20pago%20Zero%202%20Trader" className={styles.contactLink}>
              Contactar Soporte
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { query } = context;

  return {
    props: {
      collectionId: query.collection_id || null,
      collectionStatus: query.collection_status || null,
      paymentId: query.payment_id || null,
      status: query.status || null,
      externalReference: query.external_reference || null,
      paymentType: query.payment_type || null,
      merchantOrderId: query.merchant_order_id || null,
      preferenceId: query.preference_id || null,
      siteId: query.site_id || null,
      processingMode: query.processing_mode || null,
      merchantAccountId: query.merchant_account_id || null,
    },
  };
};
