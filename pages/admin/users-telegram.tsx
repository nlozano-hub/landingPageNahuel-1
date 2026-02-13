import React from 'react';
import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowLeft, MessageCircle, Search, Loader, AlertCircle, Link2, ChevronDown, ChevronUp } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import styles from '@/styles/AdminUsersTelegram.module.css';
import toast from 'react-hot-toast';

interface UnlinkedUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  servicesWithActiveSubscription: string[];
  hasActiveSubscription: boolean;
  createdAt: string;
}

interface LinkedUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  picture?: string;
  createdAt: string;
  lastLogin?: string;
  telegramUserId: number;
  telegramUsername: string | null;
  telegramLinkedAt: string | null;
  telegramChannelAccess: Array<{ service: string; joinedAt: string | null; channelId?: string }>;
  servicesWithActiveSubscription: string[];
  hasActiveSubscription: boolean;
  subscriptionDetails: Array<{ service: string; expiryDate?: string; type?: string }>;
  suscripciones: any[];
  subscriptions: any[];
  activeSubscriptions: any[];
}

interface AdminUsersTelegramProps {
  user: any;
}

export default function AdminUsersTelegramPage({ user }: AdminUsersTelegramProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UnlinkedUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingLinked, setLoadingLinked] = useState(false);
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([]);
  const [loadedLinked, setLoadedLinked] = useState(false);
  const [searchTermLinked, setSearchTermLinked] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const fetchUnlinkedUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users-telegram-unlinked?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await response.json();

      if (data.success) {
        setUsers(data.users || []);
        setLoaded(true);
        toast.success(`${data.total} usuarios sin Telegram vinculado`, { duration: 3000 });
      } else {
        toast.error(data.error || 'Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error fetching unlinked users:', error);
      toast.error('Error de conexión');
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchLinkedUsers = async () => {
    setLoadingLinked(true);
    try {
      const response = await fetch(`/api/admin/users-telegram-linked?t=${Date.now()}`, {
        cache: 'no-store'
      });
      const data = await response.json();

      if (data.success) {
        setLinkedUsers(data.users || []);
        setLoadedLinked(true);
        toast.success(`${data.total} usuarios con Telegram vinculado`, { duration: 3000 });
      } else {
        toast.error(data.error || 'Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error fetching linked users:', error);
      toast.error('Error de conexión');
      setLoadedLinked(true);
    } finally {
      setLoadingLinked(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(search) ||
      (u.name || '').toLowerCase().includes(search)
    );
  });

  const filteredLinkedUsers = linkedUsers.filter(u => {
    if (!searchTermLinked) return true;
    const search = searchTermLinked.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(search) ||
      (u.name || '').toLowerCase().includes(search) ||
      (u.telegramUsername || '').toLowerCase().includes(search) ||
      String(u.telegramUserId || '').includes(search)
    );
  });

  const withActiveSubscription = users.filter(u => u.hasActiveSubscription).length;
  const withActiveSubscriptionLinked = linkedUsers.filter(u => u.hasActiveSubscription).length;

  return (
    <>
      <Head>
        <title>Usuarios y Telegram - Admin</title>
        <meta name="description" content="Usuarios vinculados y no vinculados a Telegram" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <Link href="/admin/dashboard" className={styles.backButton}>
                  <ArrowLeft size={20} />
                </Link>
                <div className={styles.headerIcon}>
                  <MessageCircle size={32} />
                </div>
                <div>
                  <h1 className={styles.title}>Usuarios y Telegram</h1>
                  <p className={styles.subtitle}>
                    Vista de usuarios vinculados y no vinculados. Solo lectura.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.notice}>
              <AlertCircle size={20} />
              <span>Listas informativas. Los datos se cargan al hacer clic en los botones. No se envían correos ni se ejecuta ninguna acción.</span>
            </div>

            <div className={styles.actions}>
              <button
                onClick={fetchUnlinkedUsers}
                disabled={loading}
                className={styles.primaryButton}
              >
                {loading ? (
                  <>
                    <Loader size={20} className={styles.spinning} />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Users size={20} />
                    Ver usuarios no vinculados
                  </>
                )}
              </button>
              <button
                onClick={fetchLinkedUsers}
                disabled={loadingLinked}
                className={styles.secondaryButton}
              >
                {loadingLinked ? (
                  <>
                    <Loader size={20} className={styles.spinning} />
                    Cargando...
                  </>
                ) : (
                  <>
                    <Link2 size={20} />
                    Ver usuarios vinculados
                  </>
                )}
              </button>
            </div>

            {loaded && (
              <>
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{users.length}</span>
                    <span className={styles.statLabel}>Total sin Telegram</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{withActiveSubscription}</span>
                    <span className={styles.statLabel}>Con suscripción activa</span>
                  </div>
                </div>

                {users.length > 0 && (
                  <div className={styles.searchBox}>
                    <Search size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por email o nombre..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>
                )}

                {filteredUsers.length === 0 ? (
                  <div className={styles.emptyState}>
                    {users.length === 0 ? (
                      <p>No hay usuarios sin Telegram vinculado.</p>
                    ) : (
                      <p>No hay resultados para &quot;{searchTerm}&quot;</p>
                    )}
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Email</th>
                          <th>Nombre</th>
                          <th>Rol</th>
                          <th>Suscripción activa</th>
                          <th>Servicios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((u) => (
                          <tr key={u._id}>
                            <td>{u.email}</td>
                            <td>{u.name || '-'}</td>
                            <td>
                              <span className={`${styles.badge} ${styles[`role_${u.role}`] || ''}`}>
                                {u.role}
                              </span>
                            </td>
                            <td>
                              {u.hasActiveSubscription ? (
                                <span className={styles.badgeActive}>Sí</span>
                              ) : (
                                <span className={styles.badgeInactive}>No</span>
                              )}
                            </td>
                            <td>
                              {u.servicesWithActiveSubscription.length > 0
                                ? u.servicesWithActiveSubscription.join(', ')
                                : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* USUARIOS VINCULADOS */}
            {loadedLinked && (
              <>
                <div className={styles.sectionDivider} />
                <h2 className={styles.sectionTitle}>
                  <Link2 size={24} />
                  USUARIOS VINCULADOS
                </h2>
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{linkedUsers.length}</span>
                    <span className={styles.statLabel}>Total con Telegram</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.statValue}>{withActiveSubscriptionLinked}</span>
                    <span className={styles.statLabel}>Con suscripción activa</span>
                  </div>
                </div>

                {linkedUsers.length > 0 && (
                  <div className={styles.searchBox}>
                    <Search size={20} />
                    <input
                      type="text"
                      placeholder="Buscar por email, nombre, @username o ID..."
                      value={searchTermLinked}
                      onChange={(e) => setSearchTermLinked(e.target.value)}
                      className={styles.searchInput}
                    />
                  </div>
                )}

                {filteredLinkedUsers.length === 0 ? (
                  <div className={styles.emptyState}>
                    {linkedUsers.length === 0 ? (
                      <p>No hay usuarios con Telegram vinculado.</p>
                    ) : (
                      <p>No hay resultados para &quot;{searchTermLinked}&quot;</p>
                    )}
                  </div>
                ) : (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th></th>
                          <th>Email</th>
                          <th>Nombre</th>
                          <th>Rol</th>
                          <th>Telegram ID</th>
                          <th>@Username</th>
                          <th>Vinculado</th>
                          <th>Canales</th>
                          <th>Suscripción</th>
                          <th>Servicios activos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredLinkedUsers.map((u) => (
                          <React.Fragment key={u._id}>
                            <tr className={expandedRows.has(u._id) ? styles.expandedRow : ''}>
                              <td>
                                <button
                                  type="button"
                                  className={styles.expandButton}
                                  onClick={() => toggleExpanded(u._id)}
                                  title={expandedRows.has(u._id) ? 'Ocultar detalles' : 'Ver todos los detalles'}
                                >
                                  {expandedRows.has(u._id) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                </button>
                              </td>
                              <td>{u.email}</td>
                              <td>{u.name || '-'}</td>
                              <td>
                                <span className={`${styles.badge} ${styles[`role_${u.role}`] || ''}`}>
                                  {u.role}
                                </span>
                              </td>
                              <td><code>{u.telegramUserId}</code></td>
                              <td>{u.telegramUsername || '-'}</td>
                              <td>{u.telegramLinkedAt || '-'}</td>
                              <td>
                                {u.telegramChannelAccess?.length > 0
                                  ? u.telegramChannelAccess.map(a => a.service).join(', ')
                                  : '-'}
                              </td>
                              <td>
                                {u.hasActiveSubscription ? (
                                  <span className={styles.badgeActive}>Sí</span>
                                ) : (
                                  <span className={styles.badgeInactive}>No</span>
                                )}
                              </td>
                              <td>
                                {u.servicesWithActiveSubscription.length > 0
                                  ? u.servicesWithActiveSubscription.join(', ')
                                  : '-'}
                              </td>
                            </tr>
                            {expandedRows.has(u._id) && (
                              <tr key={`${u._id}-expanded`}>
                                <td colSpan={10} className={styles.expandedContent}>
                                  <dl>
                                    <dt>Último login:</dt>
                                    <dd>{u.lastLogin || '-'}</dd>
                                    <dt>Canales (detalle):</dt>
                                    <dd>
                                      {u.telegramChannelAccess?.length > 0
                                        ? u.telegramChannelAccess.map(a =>
                                          `${a.service} desde ${a.joinedAt || 'N/A'}`
                                        ).join(' | ')
                                        : 'Ninguno'}
                                    </dd>
                                    <dt>Suscripciones activas:</dt>
                                    <dd>
                                      {u.subscriptionDetails?.length > 0
                                        ? u.subscriptionDetails.map(s =>
                                          `${s.service} vence ${s.expiryDate} (${s.type || 'full'})`
                                        ).join(' | ')
                                        : 'Ninguna'}
                                    </dd>
                                    <dt>ActiveSubscriptions (raw):</dt>
                                    <dd>
                                      {JSON.stringify(u.activeSubscriptions || [])}
                                    </dd>
                                  </dl>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </main>

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
          permanent: false
        }
      };
    }

    return {
      props: {
        user: verification.user || null
      }
    };
  } catch (error) {
    console.error('Error en getServerSideProps users-telegram:', error);
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false
      }
    };
  }
};
