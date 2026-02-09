import { GetServerSideProps } from 'next';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, ArrowLeft, MessageCircle, Search, Loader, AlertCircle } from 'lucide-react';
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

interface AdminUsersTelegramProps {
  user: any;
}

export default function AdminUsersTelegramPage({ user }: AdminUsersTelegramProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UnlinkedUser[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(search) ||
      (u.name || '').toLowerCase().includes(search)
    );
  });

  const withActiveSubscription = users.filter(u => u.hasActiveSubscription).length;

  return (
    <>
      <Head>
        <title>Usuarios sin Telegram - Admin</title>
        <meta name="description" content="Lista de usuarios sin Telegram vinculado" />
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
                  <h1 className={styles.title}>Usuarios sin Telegram vinculado</h1>
                  <p className={styles.subtitle}>
                    Solo lectura. No se envían emails ni se realiza ninguna acción.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.notice}>
              <AlertCircle size={20} />
              <span>Esta lista es informativa. Al hacer clic en &quot;Ver usuarios no vinculados&quot; se cargan los datos sin enviar correos ni ejecutar ninguna acción.</span>
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
