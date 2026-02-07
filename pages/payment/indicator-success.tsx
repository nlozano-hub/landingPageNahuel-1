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

  useEffect(() => {
    if (router.query.reference) {
      setPaymentReference(router.query.reference as string);
    }
    
    // Redirigir automáticamente al formulario de Google Forms
    setTimeout(() => {
      window.location.href = 'https://docs.google.com/forms/d/13mSorbjo32VCkDqgU09YPOa1UpzB7G3RPxTK3-DUa0M/viewform';
    }, 2000); // Redirigir después de 2 segundos
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
      
      // Redirigir al formulario de Google Forms después de 3 segundos
      setTimeout(() => {
        window.location.href = 'https://docs.google.com/forms/d/13mSorbjo32VCkDqgU09YPOa1UpzB7G3RPxTK3-DUa0M/viewform';
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
