import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Play,
  Pause,
  Eye,
  EyeOff,
  Send,
  Mail,
  MessageSquare,
  Shield,
  ShieldAlert,
  Clock,
  UserX,
  Search,
  Filter,
  Download,
  Info,
  Loader
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminTelegramExpulsion.module.css';
import { toast } from 'react-hot-toast';

interface ExpulsionResult {
  userId: string;
  email: string;
  telegramUserId: number;
  service: string;
  success: boolean;
  error?: string;
}

interface ExpulsionResponse {
  success: boolean;
  message: string;
  summary: {
    totalChecked: number;
    expelled: number;
    errors: number;
    dryRun: boolean;
    verbose: boolean;
  };
  results: ExpulsionResult[];
  executedAt: string;
}

interface AdminTelegramExpulsionProps {
  user: any;
}

export default function AdminTelegramExpulsionPage({ user }: AdminTelegramExpulsionProps) {
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<ExpulsionResponse | null>(null);
  const [dryRun, setDryRun] = useState(true); // Por defecto en modo seguro
  const [verbose, setVerbose] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterService, setFilterService] = useState<'all' | 'TraderCall' | 'SmartMoney'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error'>('all');
  const [showDetails, setShowDetails] = useState<Set<string>>(new Set());

  const executeExpulsion = async () => {
    if (!dryRun && !confirm('⚠️ ¿Estás seguro de ejecutar la expulsión REAL? Esto expulsará usuarios de los canales de Telegram.')) {
      return;
    }

    setExecuting(true);
    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (dryRun) params.append('dryRun', 'true');
      if (verbose) params.append('verbose', 'true');

      // ✅ FIXED: Eliminado header inseguro - la autenticación se maneja en getServerSideProps
      const response = await fetch(`/api/cron/telegram-expulsion?${params.toString()}`, {
        method: 'GET'
      });

      const data: ExpulsionResponse = await response.json();

      if (data.success) {
        setResults(data);
        toast.success(
          dryRun 
            ? `Simulación completada: ${data.summary.expelled} usuarios serían expulsados`
            : `Expulsión completada: ${data.summary.expelled} usuarios expulsados`,
          { duration: 5000 }
        );
      } else {
        toast.error('Error al ejecutar expulsión');
      }
    } catch (error) {
      console.error('Error ejecutando expulsión:', error);
      toast.error('Error de conexión');
    } finally {
      setLoading(false);
      setExecuting(false);
    }
  };

  const toggleDetails = (userId: string) => {
    const newSet = new Set(showDetails);
    if (newSet.has(userId)) {
      newSet.delete(userId);
    } else {
      newSet.add(userId);
    }
    setShowDetails(newSet);
  };

  const filteredResults = results?.results.filter(result => {
    const matchesSearch = result.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         result.userId.includes(searchTerm);
    const matchesService = filterService === 'all' || result.service === filterService;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'success' && result.success) ||
                         (filterStatus === 'error' && !result.success);
    return matchesSearch && matchesService && matchesStatus;
  }) || [];

  const successCount = filteredResults.filter(r => r.success).length;
  const errorCount = filteredResults.filter(r => !r.success).length;

  return (
    <>
      <Head>
        <title>Gestión de Expulsiones Telegram - Admin</title>
        <meta name="description" content="Panel de administración para gestionar expulsiones de usuarios de Telegram" />
      </Head>

      <Navbar />

      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.headerContent}>
            <div className={styles.titleSection}>
              <div className={styles.iconWrapper}>
                <Shield size={32} />
              </div>
              <div>
                <h1 className={styles.title}>Gestión de Expulsiones Telegram</h1>
                <p className={styles.subtitle}>
                  Gestiona y ejecuta expulsiones automáticas de usuarios de canales de Telegram
                </p>
              </div>
            </div>

            <div className={styles.actions}>
              <Link 
                href="/admin/dashboard"
                className={styles.backButton}
              >
                ← Volver al Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Panel de Control */}
        <div className={styles.controlPanel}>
          <div className={styles.controlCard}>
            <h3 className={styles.controlTitle}>
              <Play size={20} />
              Ejecutar Expulsión
            </h3>
            
            <div className={styles.controlOptions}>
              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  disabled={executing}
                />
                <span className={styles.slider}></span>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>
                    {dryRun ? '🧪 Modo Simulación (Dry-Run)' : '⚡ Modo Ejecución Real'}
                  </span>
                  <span className={styles.switchDescription}>
                    {dryRun 
                      ? 'Simula la expulsión sin ejecutarla realmente'
                      : 'Ejecuta la expulsión real de usuarios'}
                  </span>
                </div>
              </label>

              <label className={styles.switch}>
                <input
                  type="checkbox"
                  checked={verbose}
                  onChange={(e) => setVerbose(e.target.checked)}
                  disabled={executing}
                />
                <span className={styles.slider}></span>
                <div className={styles.switchLabel}>
                  <span className={styles.switchTitle}>
                    📊 Modo Verbose
                  </span>
                  <span className={styles.switchDescription}>
                    Muestra detalles de todos los usuarios procesados
                  </span>
                </div>
              </label>
            </div>

            <button
              onClick={executeExpulsion}
              disabled={executing}
              className={`${styles.executeButton} ${dryRun ? styles.safe : styles.danger}`}
            >
              {executing ? (
                <>
                  <Loader size={20} className={styles.spinner} />
                  Ejecutando...
                </>
              ) : (
                <>
                  {dryRun ? <Eye size={20} /> : <Send size={20} />}
                  {dryRun ? 'Simular Expulsión' : 'Ejecutar Expulsión Real'}
                </>
              )}
            </button>

            {dryRun && (
              <div className={styles.warningBox}>
                <AlertTriangle size={20} />
                <div>
                  <strong>Modo Seguro Activado</strong>
                  <p>La expulsión se simulará sin ejecutarse realmente. Los usuarios NO serán expulsados.</p>
                </div>
              </div>
            )}
          </div>

          {/* Estadísticas */}
          {results && (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
                  <Users size={24} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{results.summary.totalChecked}</div>
                  <div className={styles.statLabel}>Usuarios Verificados</div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                  <CheckCircle size={24} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{results.summary.expelled}</div>
                  <div className={styles.statLabel}>
                    {dryRun ? 'Serían Expulsados' : 'Expulsados'}
                  </div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
                  <XCircle size={24} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{results.summary.errors}</div>
                  <div className={styles.statLabel}>Errores</div>
                </div>
              </div>

              <div className={styles.statCard}>
                <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                  <Clock size={24} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>
                    {new Date(results.executedAt).toLocaleTimeString('es-AR')}
                  </div>
                  <div className={styles.statLabel}>
                    {new Date(results.executedAt).toLocaleDateString('es-AR')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resultados */}
        {results && (
          <div className={styles.resultsSection}>
            <div className={styles.resultsHeader}>
              <h2 className={styles.resultsTitle}>
                Resultados de la Expulsión
                {dryRun && <span className={styles.badge}>SIMULACIÓN</span>}
              </h2>

              {/* Filtros */}
              <div className={styles.filters}>
                <div className={styles.searchBox}>
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Buscar por email o ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>

                <select
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value as any)}
                  className={styles.filterSelect}
                >
                  <option value="all">Todos los Servicios</option>
                  <option value="TraderCall">TraderCall</option>
                  <option value="SmartMoney">SmartMoney</option>
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className={styles.filterSelect}
                >
                  <option value="all">Todos los Estados</option>
                  <option value="success">Exitosos</option>
                  <option value="error">Con Errores</option>
                </select>
              </div>

              <div className={styles.resultsSummary}>
                <span className={styles.summaryText}>
                  Mostrando {filteredResults.length} de {results.results.length} resultados
                </span>
                {filteredResults.length > 0 && (
                  <div className={styles.summaryBadges}>
                    <span className={styles.badgeSuccess}>
                      ✓ {successCount} exitosos
                    </span>
                    {errorCount > 0 && (
                      <span className={styles.badgeError}>
                        ✗ {errorCount} errores
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Lista de Resultados */}
            <div className={styles.resultsList}>
              <AnimatePresence>
                {filteredResults.length === 0 ? (
                  <div className={styles.emptyState}>
                    <UserX size={48} />
                    <p>No hay resultados que coincidan con los filtros</p>
                  </div>
                ) : (
                  filteredResults.map((result, index) => (
                    <motion.div
                      key={`${result.userId}-${result.service}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className={`${styles.resultCard} ${result.success ? styles.success : styles.error}`}
                    >
                      <div className={styles.resultHeader}>
                        <div className={styles.resultMain}>
                          <div className={styles.resultIcon}>
                            {result.success ? (
                              <CheckCircle size={24} className={styles.iconSuccess} />
                            ) : (
                              <XCircle size={24} className={styles.iconError} />
                            )}
                          </div>
                          <div className={styles.resultInfo}>
                            <div className={styles.resultEmail}>{result.email}</div>
                            <div className={styles.resultMeta}>
                              <span className={styles.serviceBadge}>{result.service}</span>
                              <span className={styles.userId}>ID: {result.userId.slice(0, 8)}...</span>
                              <span className={styles.telegramId}>Telegram: {result.telegramUserId}</span>
                            </div>
                          </div>
                        </div>
                        <div className={styles.resultActions}>
                          {result.error && (
                            <button
                              onClick={() => toggleDetails(`${result.userId}-${result.service}`)}
                              className={styles.detailsButton}
                            >
                              {showDetails.has(`${result.userId}-${result.service}`) ? (
                                <EyeOff size={18} />
                              ) : (
                                <Eye size={18} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {result.error && showDetails.has(`${result.userId}-${result.service}`) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className={styles.errorDetails}
                        >
                          <div className={styles.errorMessage}>
                            <AlertTriangle size={18} />
                            <span>{result.error}</span>
                          </div>
                        </motion.div>
                      )}

                      {result.success && !result.error && (
                        <div className={styles.successMessage}>
                          <CheckCircle size={18} />
                          <span>
                            {dryRun 
                              ? 'Usuario sería expulsado exitosamente'
                              : 'Usuario expulsado exitosamente'}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

            {/* Exportar Resultados */}
            {results.results.length > 0 && (
              <div className={styles.exportSection}>
                <button
                  onClick={() => {
                    const csv = [
                      ['Email', 'Telegram ID', 'Servicio', 'Estado', 'Error'].join(','),
                      ...results.results.map(r => [
                        r.email,
                        r.telegramUserId,
                        r.service,
                        r.success ? 'Exitoso' : 'Error',
                        r.error || ''
                      ].join(','))
                    ].join('\n');
                    
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `telegram-expulsion-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    toast.success('Resultados exportados');
                  }}
                  className={styles.exportButton}
                >
                  <Download size={18} />
                  Exportar CSV
                </button>
              </div>
            )}
          </div>
        )}

        {/* Información */}
        {!results && (
          <div className={styles.infoSection}>
            <div className={styles.infoCard}>
              <Info size={24} />
              <div>
                <h3>¿Cómo funciona?</h3>
                <ul>
                  <li>El sistema verifica automáticamente todos los usuarios con Telegram vinculado</li>
                  <li>Comprueba si tienen suscripción activa en TraderCall o SmartMoney</li>
                  <li>Expulsa usuarios que no tienen suscripción activa de los canales correspondientes</li>
                  <li>Envía notificaciones por Telegram y Email a los usuarios expulsados</li>
                </ul>
              </div>
            </div>

            <div className={styles.infoCard}>
              <ShieldAlert size={24} />
              <div>
                <h3>Modos de Ejecución</h3>
                <ul>
                  <li><strong>Modo Simulación (Dry-Run):</strong> Simula la expulsión sin ejecutarla realmente. Perfecto para testing.</li>
                  <li><strong>Modo Ejecución Real:</strong> Ejecuta la expulsión real. Los usuarios serán removidos de los canales.</li>
                  <li><strong>Modo Verbose:</strong> Muestra detalles de todos los usuarios, incluyendo los que tienen suscripción activa.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  try {
    const verification = await verifyAdminAccess(context);
    
    if (!verification.isAdmin) {
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }
    
    return {
      props: {
        user: verification.session?.user || verification.user,
      },
    };
  } catch (error) {
    console.error('Error en getServerSideProps:', error);
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};
