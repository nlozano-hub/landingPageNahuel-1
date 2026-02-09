import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from '@/styles/IndicatorSuccess.module.css';

export default function IndicatorSuccessPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [tradingViewUser, setTradingViewUser] = useState('');
  const [formUrl, setFormUrl] = useState<string>('');

  // Función para obtener el formulario según el servicio
  const getFormUrl = (service: string): string => {
    const formUrls: { [key: string]: string } = {
      'RSIConHistoricos': 'https://docs.google.com/forms/d/e/1FAIpQLScNSud8SZkTaNgFt8fCSLk9JV52w3o3o1kV_YheT4w7KN4biQ/viewform',
      'SmartMACD': 'https://docs.google.com/forms/d/e/1FAIpQLSeRay-Z0MWftZCb8R-nlDFtvTh5v2sR1gjzV5N7XsM6nzzxrg/viewform',
      'KoncordePro': 'https://docs.google.com/forms/d/e/1FAIpQLScOC1eiN_ArMYaxBrs1oG-Cf0Df-J2Ml80M7hVCBAu2AuSpQA/viewform',
      'PackIndicadores': 'https://forms.gle/LcZo6EgFZfSWMdnT8',
      'MediasMovilesAutomaticas': 'https://docs.google.com/forms/d/13mSorbjo32VCkDqgU09YPOa1UpzB7G3RPxTK3-DUa0M/viewform' // Formulario original
    };
    return formUrls[service] || formUrls['MediasMovilesAutomaticas']; 
  };

  useEffect(() => {
    if (router.query.reference) {
      const reference = router.query.reference as string;
      setPaymentReference(reference);
      
      // Extraer el servicio del externalReference (formato: indicator_${product}_${user._id}_${Date.now()})
      const parts = reference.split('_');
      if (parts.length >= 2 && parts[0] === 'indicator') {
        const service = parts[1];
        const url = getFormUrl(service);
        setFormUrl(url);
        
        // Redirigir automáticamente al formulario de Google Forms correcto
        setTimeout(() => {
          window.location.href = url;
        }, 2000); // Redirigir después de 2 segundos
      } else {
        // Fallback al formulario original si no se puede determinar
        const defaultUrl = 'https://docs.google.com/forms/d/13mSorbjo32VCkDqgU09YPOa1UpzB7G3RPxTK3-DUa0M/viewform';
        setFormUrl(defaultUrl);
        setTimeout(() => {
          window.location.href = defaultUrl;
        }, 2000);
      }
    }
  }, [router.query.reference]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tradingViewUser.trim()) {
      setErrorMessage('Por favor ingresa tu usuario de TradingView');
      return;
    }

    if (!paymentReference) {
      setErrorMessage('No se encontró la referencia de pago');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      setSubmitMessage('');

      const response = await fetch('/api/indicators/submit-tradingview-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tradingViewUser: tradingViewUser.trim(),
          paymentReference
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al enviar el formulario');
      }

      setSubmitMessage(data.message);
      setTradingViewUser('');
      
      // Redirigir al formulario de Google Forms correcto después de 3 segundos
      const url = formUrl || 'https://docs.google.com/forms/d/13mSorbjo32VCkDqgU09YPOa1UpzB7G3RPxTK3-DUa0M/viewform';
      setTimeout(() => {
        window.location.href = url;
      }, 3000);
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!session) {
    return (
      <>
        <Head>
          <title>Acceso Denegado - Indicador</title>
        </Head>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.container}>
            <div className={styles.errorCard}>
              <h1>Acceso Denegado</h1>
              <p>Debes iniciar sesión para acceder a esta página.</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Pago Exitoso - Indicador</title>
        <meta name="description" content="Tu pago fue procesado exitosamente. Completa el formulario para recibir tu acceso al indicador." />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.successCard}>
            <div className={styles.successHeader}>
              <div className={styles.successIcon}>✅</div>
              <h1>¡Pago Exitoso!</h1>
              <p>Tu pago fue procesado correctamente. Serás redirigido automáticamente al formulario de asesoramiento.</p>
            </div>

            <div className={styles.redirectMessage}>
              <h2>🔄 Redirigiendo al formulario...</h2>
              <p>En unos segundos serás llevado al formulario de asesoramiento financiero para continuar con tu plan de inversión.</p>
              <div className={styles.redirectNotice}>
                <p>⏰ Redirigiendo en 2 segundos...</p>
              </div>
            </div>

            {submitMessage ? (
              <div className={styles.successMessage}>
                <h2>¡Formulario Enviado!</h2>
                <p>{submitMessage}</p>
                <div className={styles.nextSteps}>
                  <h3>Próximos pasos:</h3>
                  <ol>
                    <li>Serás redirigido automáticamente al formulario de asesoramiento</li>
                    <li>Completa el formulario para continuar con tu plan de inversión</li>
                    <li>En menos de 24 horas recibirás el acceso al indicador</li>
                    <li>Busca el indicador en "Requiere invitación" en TradingView</li>
                  </ol>
                  <div className={styles.redirectNotice}>
                    <p>🔄 Redirigiendo al formulario en 3 segundos...</p>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="tradingViewUser" className={styles.label}>
                    Usuario de TradingView *
                  </label>
                  <input
                    type="text"
                    id="tradingViewUser"
                    value={tradingViewUser}
                    onChange={(e) => setTradingViewUser(e.target.value)}
                    placeholder="Ingresa tu usuario exacto de TradingView"
                    className={styles.input}
                    required
                    disabled={isSubmitting}
                  />
                  <p className={styles.helpText}>
                    Este debe ser tu usuario exacto de TradingView (no tu email)
                  </p>
                </div>

                {errorMessage && (
                  <div className={styles.errorMessage}>
                    {errorMessage}
                  </div>
                )}

                <button 
                  type="submit" 
                  className={styles.submitButton}
                  disabled={isSubmitting || !tradingViewUser.trim()}
                >
                  {isSubmitting ? 'Enviando...' : 'Enviar Formulario'}
                </button>
              </form>
            )}

            <div className={styles.infoBox}>
              <h3>📋 Información importante:</h3>
              <ul>
                <li>El acceso se habilita manualmente en menos de 24 horas</li>
                <li>Busca el indicador en "Requiere invitación" en TradingView</li>
                <li>El acceso es vitalicio y personal</li>
                <li>Si tienes dudas, contacta: soporte@lozanonahuel.com</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
