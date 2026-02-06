import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Settings, 
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  Info,
  Loader,
  Bot,
  Webhook
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

interface WebhookInfo {
  url: string;
  hasCustomCertificate: boolean;
  pendingUpdateCount: number;
  lastErrorDate?: number;
  lastErrorMessage?: string;
  maxConnections?: number;
}

interface BotInfo {
  success: boolean;
  enabled: boolean;
  username?: string;
  firstName?: string;
  id?: number;
  message?: string;
}

interface AdminTelegramConfigProps {
  user: any;
}

export default function AdminTelegramConfigPage({ user }: AdminTelegramConfigProps) {
  const [loading, setLoading] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [botInfo, setBotInfo] = useState<BotInfo | null>(null);

  useEffect(() => {
    fetchBotInfo();
  }, []);

  const fetchBotInfo = async () => {
    try {
      const response = await fetch('/api/telegram/bot-info');
      const data: BotInfo = await response.json();
      setBotInfo(data);
    } catch (error) {
      console.error('Error obteniendo info del bot:', error);
    }
  };

  const setupWebhook = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/telegram/setup-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setWebhookInfo(data.webhookInfo);
        toast.success('✅ Webhook configurado correctamente', { duration: 5000 });
      } else {
        toast.error(data.error || 'Error configurando webhook');
      }
    } catch (error) {
      console.error('Error configurando webhook:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Configuración Telegram - Admin</title>
        <meta name="description" content="Configuración del bot de Telegram y webhook" />
      </Head>

      <Navbar />

      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2rem',
          width: '100%',
          flex: 1
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <Link href="/admin/dashboard" style={{ 
              color: '#666', 
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}>
              ← Volver al Dashboard
            </Link>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              padding: '2rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              marginBottom: '2rem',
              paddingBottom: '1.5rem',
              borderBottom: '2px solid #f0f0f0'
            }}>
              <div style={{
                backgroundColor: '#3b82f6',
                borderRadius: '12px',
                padding: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Bot size={32} color="white" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 600 }}>
                  Configuración de Telegram
                </h1>
                <p style={{ margin: '0.25rem 0 0 0', color: '#666', fontSize: '0.95rem' }}>
                  Gestiona el bot de Telegram y configura el webhook
                </p>
              </div>
            </div>

            {/* Bot Info */}
            {botInfo && (
              <div style={{
                backgroundColor: '#f8f9fa',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '2rem',
                border: `2px solid ${botInfo.enabled ? '#10b981' : '#ef4444'}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}>
                  {botInfo.enabled ? (
                    <CheckCircle size={20} color="#10b981" />
                  ) : (
                    <XCircle size={20} color="#ef4444" />
                  )}
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                    Estado del Bot
                  </h3>
                </div>
                
                {botInfo.enabled ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <strong>Username:</strong> @{botInfo.username || 'N/A'}
                      </div>
                      <div>
                        <strong>Nombre:</strong> {botInfo.firstName || 'N/A'}
                      </div>
                      <div>
                        <strong>ID:</strong> {botInfo.id || 'N/A'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, color: '#666' }}>
                    {botInfo.message || 'Bot de Telegram no configurado'}
                  </p>
                )}
              </div>
            )}

            {/* Webhook Configuration */}
            <div style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '2rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                marginBottom: '1rem'
              }}>
                <Webhook size={20} color="#3b82f6" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                  Configuración del Webhook
                </h3>
              </div>

              <p style={{ margin: '0 0 1.5rem 0', color: '#666', fontSize: '0.95rem' }}>
                El webhook permite que Telegram envíe mensajes directamente al servidor.
                Debes configurarlo después de cada deploy para que el bot funcione correctamente.
              </p>

              <button
                onClick={setupWebhook}
                disabled={loading || !botInfo?.enabled}
                style={{
                  backgroundColor: loading || !botInfo?.enabled ? '#ccc' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem 1.5rem',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: loading || !botInfo?.enabled ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!loading && botInfo?.enabled) {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && botInfo?.enabled) {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }
                }}
              >
                {loading ? (
                  <>
                    <Loader size={18} className="spin" />
                    Configurando...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Configurar Webhook
                  </>
                )}
              </button>

              {webhookInfo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  transition={{ duration: 0.3 }}
                  style={{
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    border: '2px solid #10b981'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem'
                  }}>
                    <CheckCircle size={18} color="#10b981" />
                    <strong>Webhook Configurado</strong>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div><strong>URL:</strong> {webhookInfo.url}</div>
                    {webhookInfo.pendingUpdateCount > 0 && (
                      <div style={{ color: '#f59e0b' }}>
                        <strong>Actualizaciones pendientes:</strong> {webhookInfo.pendingUpdateCount}
                      </div>
                    )}
                    {webhookInfo.lastErrorMessage && (
                      <div style={{ color: '#ef4444' }}>
                        <strong>Último error:</strong> {webhookInfo.lastErrorMessage}
                        {webhookInfo.lastErrorDate && (
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                            ({new Date(webhookInfo.lastErrorDate * 1000).toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}
                    {!webhookInfo.lastErrorMessage && webhookInfo.pendingUpdateCount === 0 && (
                      <div style={{ color: '#10b981' }}>
                        ✅ Webhook funcionando correctamente
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Info Box */}
            <div style={{
              backgroundColor: '#eff6ff',
              borderRadius: '8px',
              padding: '1rem',
              border: '1px solid #bfdbfe',
              display: 'flex',
              gap: '0.75rem'
            }}>
              <Info size={20} color="#3b82f6" style={{ flexShrink: 0, marginTop: '0.125rem' }} />
              <div style={{ fontSize: '0.9rem', color: '#1e40af' }}>
                <strong>Nota importante:</strong> El webhook debe configurarse después de cada deploy en producción.
                Si cambias la URL del servidor o realizas un nuevo deploy, vuelve a ejecutar esta configuración.
              </div>
            </div>
          </motion.div>
        </div>

        <Footer />
      </div>

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const verification = await verifyAdminAccess(context);
  
  if (!verification.isAdmin) {
    return {
      redirect: {
        destination: '/',
        permanent: false
      }
    };
  }

  return {
    props: {
      user: verification.user || null
    }
  };
};
