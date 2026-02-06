import { GetServerSideProps } from 'next';
import { getSession } from 'next-auth/react';
import { verifyAdminAccess } from '@/lib/adminAuth';
import Head from 'next/head';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Settings, 
  Search,
  Filter,
  Mail,
  Edit3,
  Trash2,
  Plus,
  Download,
  RefreshCw,
  AlertCircle,
  Crown,
  DollarSign,
  Calendar,
  Eye,
  X,
  Check,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import User from '@/models/User';
import styles from '@/styles/AdminUsers.module.css';
import { toast } from 'react-hot-toast';
import { useSession } from 'next-auth/react';
import { usePricing } from '@/hooks/usePricing';

interface UserData {
  _id: string;
  name: string;
  email: string;
  picture?: string; // Imagen de perfil de Google
  role: 'admin' | 'suscriptor' | 'normal';
  createdAt: string;
  lastLogin?: string;
  isActive: boolean;
  subscriptionBlocked?: boolean;
  subscriptions?: Array<{
    tipo: string;
    precio: number;
    fechaInicio: string;
    fechaFin?: string;
    activa: boolean;
    isTrial?: boolean; // ✅ NUEVO: Indicar si es prueba gratis
  }>;
  ingresoMensual?: number;
}

interface SubscriptionStats {
  tipo: string;
  suscriptores: number;
  ingresosMensuales: number;
}

interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalUsers: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface AdminUsersProps {
  user: any;
}

export default function AdminUsersPage({ user }: AdminUsersProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [subscriptionStats, setSubscriptionStats] = useState<SubscriptionStats[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [showUserDetails, setShowUserDetails] = useState(false);

  // Hook para obtener precios dinámicos
  const { pricing, loading: pricingLoading } = usePricing();

  // Datos para crear usuario
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'normal'
  });

  // Datos para agregar suscripción (sin precio, se obtiene dinámicamente)
  const [newSubscription, setNewSubscription] = useState({
    tipo: 'TraderCall',
    days: 30 // ✅ NUEVO: Días de suscripción (default 30)
  });

  // Componente para el avatar del usuario
  const UserAvatar = ({ user }: { user: UserData }) => {
    const [imageError, setImageError] = useState(false);
    
    if (user.picture && !imageError) {
      return (
        <img
          src={user.picture}
          alt={`${user.name} avatar`}
          className={styles.userAvatarImage}
          onError={() => setImageError(true)}
        />
      );
    }
    
    // Fallback a iniciales si no hay imagen o falla la carga
    return (
      <div className={styles.userAvatar}>
        {user.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  // Cargar usuarios
  const fetchUsers = async (page = 1, filters = {}) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        search: searchTerm,
        role: roleFilter,
        status: statusFilter,
        subscription: subscriptionFilter,
        ...filters
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } else {
        toast.error('Error al cargar usuarios');
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  // Cargar estadísticas de suscripciones
  const fetchSubscriptionStats = async () => {
    try {
      const response = await fetch('/api/admin/users/subscriptions');
      if (response.ok) {
        const data = await response.json();
        setSubscriptionStats(data.estadisticas.alertStats);
        setTotalRevenue(data.estadisticas.ingresosTotales);
      }
    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
    }
  };

  // Actualizar rol de usuario
  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        toast.success('Rol actualizado correctamente');
        fetchUsers(currentPage);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al actualizar rol');
      }
    } catch (error) {
      console.error('Error al actualizar rol:', error);
      toast.error('Error al actualizar rol');
    }
  };

  // Crear nuevo usuario
  const createUser = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      });

      if (response.ok) {
        toast.success('Usuario creado correctamente');
        setShowCreateModal(false);
        setNewUser({ name: '', email: '', role: 'normal' });
        fetchUsers(currentPage);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al crear usuario');
      }
    } catch (error) {
      console.error('Error al crear usuario:', error);
      toast.error('Error al crear usuario');
    }
  };

  // Agregar suscripción
  const addSubscription = async () => {
    if (!selectedUser) return;

    try {
      // Obtener el precio dinámico según el tipo de suscripción
      let precio = 99; // Precio por defecto
      
      if (pricing) {
        switch (newSubscription.tipo) {
          case 'TraderCall':
            precio = pricing.alertas.traderCall.monthly;
            break;
          case 'SmartMoney':
            precio = pricing.alertas.smartMoney.monthly;
            break;
          case 'CashFlow':
            // Si no hay precio definido para CashFlow, usar el de TraderCall como fallback
            precio = pricing.alertas.traderCall.monthly;
            break;
          default:
            precio = pricing.alertas.traderCall.monthly;
        }
      }

      const response = await fetch('/api/admin/users/subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUser._id,
          days: newSubscription.days, // ✅ NUEVO: Enviar días de suscripción
          tipo: newSubscription.tipo,
          precio: precio
        }),
      });

      if (response.ok) {
        toast.success('Suscripción agregada correctamente');
        setShowSubscriptionModal(false);
        setNewSubscription({ tipo: 'TraderCall', days: 30 });
        fetchUsers(currentPage);
        fetchSubscriptionStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al agregar suscripción');
      }
    } catch (error) {
      console.error('Error al agregar suscripción:', error);
      toast.error('Error al agregar suscripción');
    }
  };

  // Remover suscripción
  const removeSubscription = async (userId: string, tipo: string) => {
    try {
      const response = await fetch('/api/admin/users/subscriptions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, tipo }),
      });

      if (response.ok) {
        toast.success('Suscripción removida correctamente');
        fetchUsers(currentPage);
        fetchSubscriptionStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al remover suscripción');
      }
    } catch (error) {
      console.error('Error al remover suscripción:', error);
      toast.error('Error al remover suscripción');
    }
  };

  // Eliminar usuario
  const deleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Usuario eliminado correctamente');
        fetchUsers(currentPage);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al eliminar usuario');
      }
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error('Error al eliminar usuario');
    }
  };

  // Bloquear suscripciones de usuario
  const blockUserSubscriptions = async (userId: string) => {
    const reason = prompt('Ingresa el motivo del bloqueo (opcional):');
    if (reason === null) return; // Usuario canceló

    try {
      const response = await fetch('/api/admin/users/block-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, reason: reason || undefined }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Usuario bloqueado correctamente');
        fetchUsers(currentPage);
        fetchSubscriptionStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al bloquear usuario');
      }
    } catch (error) {
      console.error('Error al bloquear usuario:', error);
      toast.error('Error al bloquear usuario');
    }
  };

  // Desbloquear suscripciones de usuario
  const unblockUserSubscriptions = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres desbloquear las suscripciones de este usuario?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users/unblock-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (response.ok) {
        toast.success('Usuario desbloqueado correctamente');
        fetchUsers(currentPage);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al desbloquear usuario');
      }
    } catch (error) {
      console.error('Error al desbloquear usuario:', error);
      toast.error('Error al desbloquear usuario');
    }
  };

  // Exportar usuarios a CSV
  const exportUsers = async () => {
    try {
      const response = await fetch('/api/admin/users/export');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `usuarios-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success('Usuarios exportados correctamente');
      } else {
        toast.error('Error al exportar usuarios');
      }
    } catch (error) {
      console.error('Error al exportar usuarios:', error);
      toast.error('Error al exportar usuarios');
    }
  };

  // Limpiar suscripciones expiradas
  const cleanupExpiredSubscriptions = async () => {
    if (!confirm('¿Estás seguro de que quieres limpiar las suscripciones expiradas? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/users/subscriptions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup-expired' }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message);
        // Recargar datos
        fetchUsers(currentPage);
        fetchSubscriptionStats();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al limpiar suscripciones');
      }
    } catch (error) {
      console.error('Error al limpiar suscripciones:', error);
      toast.error('Error al limpiar suscripciones');
    }
  };

  useEffect(() => {
    fetchUsers(currentPage);
    fetchSubscriptionStats();
  }, [currentPage, roleFilter, statusFilter, subscriptionFilter]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm !== '') {
        setCurrentPage(1);
        fetchUsers(1);
      } else if (searchTerm === '') {
        fetchUsers(currentPage);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'admin': return styles.badgeAdmin;
      case 'suscriptor': return styles.badgeSuscriptor;
      default: return styles.badgeNormal;
    }
  };

  const getSubscriptionColor = (tipo: string) => {
    switch (tipo) {
      case 'TraderCall': return '#3b82f6';
      case 'SmartMoney': return '#10b981';
      case 'CashFlow': return '#f59e0b';
      default: return '#64748b';
    }
  };

  return (
    <>
      <Head>
        <title>Gestión de Usuarios - Admin Dashboard</title>
        <meta name="description" content="Gestión avanzada de usuarios y suscripciones del sistema" />
      </Head>

      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <motion.div
            className={styles.content}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {/* Header */}
            <div className={styles.header}>
              <div className={styles.headerLeft}>
                <div className={styles.headerIcon}>
                  <Users size={40} />
                </div>
                <div>
                  <h1 className={styles.title}>Gestión de Usuarios</h1>
                  <p className={styles.subtitle}>
                    Administra usuarios, roles, suscripciones y permisos del sistema
                  </p>
                </div>
              </div>
              <div className={styles.headerActions}>
                <Link 
                  href="/admin/dashboard"
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  Volver al Dashboard
                </Link>
                <Link 
                  href="/admin/monthly-trainings/users"
                  className={`${styles.actionButton} ${styles.outline}`}
                >
                  <Calendar size={20} />
                  Gestionar Entrenamientos
                </Link>
                <button 
                  onClick={exportUsers}
                  className={`${styles.actionButton} ${styles.outline}`}
                >
                  <Download size={20} />
                  Exportar CSV
                </button>
                <button 
                  onClick={cleanupExpiredSubscriptions}
                  className={`${styles.actionButton} ${styles.danger}`}
                >
                  <Trash2 size={20} />
                  Limpiar Expiradas
                </button>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className={`${styles.actionButton} ${styles.primary}`}
                >
                  <Plus size={20} />
                  Crear Usuario
                </button>
              </div>
            </div>

            {/* Stats Cards */}
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Users size={24} className={styles.iconBlue} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{pagination?.totalUsers || 0}</h3>
                  <p>Total Usuarios</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Crown size={24} className={styles.iconGold} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{users.filter(u => u.role === 'admin').length}</h3>
                  <p>Administradores</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <UserCheck size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>{users.filter(u => u.role === 'suscriptor').length}</h3>
                  <p>Suscriptores</p>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <DollarSign size={24} className={styles.iconGreen} />
                </div>
                <div className={styles.statInfo}>
                  <h3>${totalRevenue.toLocaleString()}</h3>
                  <p>Ingresos Mensuales</p>
                </div>
              </div>
            </div>

            {/* Subscription Stats */}
            {subscriptionStats.length > 0 && (
              <div className={styles.subscriptionStats}>
                <h3>Estadísticas de Suscripciones</h3>
                <div className={styles.subscriptionGrid}>
                  {subscriptionStats.map((stat) => (
                    <div key={stat.tipo} className={styles.subscriptionCard}>
                      <div 
                        className={styles.subscriptionIcon}
                        style={{ backgroundColor: getSubscriptionColor(stat.tipo) }}
                      >
                        <AlertCircle size={20} />
                      </div>
                      <div className={styles.subscriptionInfo}>
                        <h4>{stat.tipo}</h4>
                        <p>{stat.suscriptores} suscriptores</p>
                        <span>${stat.ingresosMensuales.toLocaleString()}/mes</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filters and Search */}
            <div className={styles.filtersSection}>
              <div className={styles.searchBox}>
                <Search size={20} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.filters}>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">Todos los roles</option>
                  <option value="admin">Administradores</option>
                  <option value="suscriptor">Suscriptores</option>
                  <option value="normal">Usuarios normales</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">Todos los estados</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>

                <select
                  value={subscriptionFilter}
                  onChange={(e) => setSubscriptionFilter(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">Todas las suscripciones</option>
                  <option value="TraderCall">Trader Call</option>
                  <option value="SmartMoney">Smart Money</option>
                  <option value="CashFlow">Cash Flow</option>
                </select>

                <button 
                  onClick={() => fetchUsers(currentPage)}
                  className={`${styles.actionButton} ${styles.outline}`}
                  disabled={loading}
                >
                  <RefreshCw size={20} />
                  Actualizar
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className={styles.tableContainer}>
              {loading ? (
                <div className={styles.loadingState}>
                  <RefreshCw size={40} className={styles.loadingSpinner} />
                  <p>Cargando usuarios...</p>
                </div>
              ) : users.length === 0 ? (
                <div className={styles.emptyState}>
                  <UserX size={48} />
                  <h3>No se encontraron usuarios</h3>
                  <p>Intenta ajustar los filtros o crear un nuevo usuario</p>
                </div>
              ) : (
                <div className={styles.table}>
                  <div className={styles.tableHeader}>
                    <div className={styles.tableCell}>Usuario</div>
                    <div className={styles.tableCell}>Rol</div>
                    <div className={styles.tableCell}>Suscripciones</div>
                    <div className={styles.tableCell}>Estado</div>
                    <div className={styles.tableCell}>Ingresos</div>
                    <div className={styles.tableCell}>Último Login</div>
                    <div className={styles.tableCell}>Acciones</div>
                  </div>
                  
                  {users.map((user) => (
                    <motion.div
                      key={user._id}
                      className={styles.tableRow}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className={styles.tableCell}>
                        <div className={styles.userInfo}>
                          <UserAvatar user={user} />
                          <div>
                            <p className={styles.userName}>{user.name}</p>
                            <p className={styles.userEmail}>{user.email}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user._id, e.target.value)}
                          className={`${styles.roleSelect} ${getRoleBadgeClass(user.role)}`}
                        >
                          <option value="normal">Normal</option>
                          <option value="suscriptor">Suscriptor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <div className={styles.subscriptions}>
                          {user.subscriptions && user.subscriptions.length > 0 ? (
                            user.subscriptions
                              .filter(sub => sub.activa)
                              .map((sub) => (
                                <span
                                  key={sub.tipo}
                                  className={styles.subscriptionBadge}
                                  style={{ backgroundColor: getSubscriptionColor(sub.tipo) }}
                                >
                                  {sub.tipo}
                                  {sub.isTrial && <span style={{ 
                                    marginLeft: '4px', 
                                    fontSize: '0.7em', 
                                    fontWeight: 'bold',
                                    opacity: 0.85 
                                  }}>(PRUEBA)</span>}
                                  <button
                                    onClick={() => removeSubscription(user._id, sub.tipo)}
                                    className={styles.removeSub}
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))
                          ) : (
                            <span className={styles.noSubscriptions}>Sin suscripciones</span>
                          )}
                          {!user.subscriptionBlocked && (
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowSubscriptionModal(true);
                              }}
                              className={styles.addSubButton}
                            >
                              <Plus size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className={styles.tableCell}>
                        {user.subscriptionBlocked ? (
                          <span className={styles.blockedBadge} style={{ 
                            backgroundColor: '#ef4444', 
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            Bloqueado
                          </span>
                        ) : (
                          <span className={styles.activeBadge} style={{ 
                            backgroundColor: '#10b981', 
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            Activo
                          </span>
                        )}
                      </div>
                      
                      <div className={styles.tableCell}>
                        <span className={styles.revenue}>
                          ${(user.ingresoMensual || 0).toLocaleString()}/mes
                        </span>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <span className={styles.lastLogin}>
                          {user.lastLogin 
                            ? new Date(user.lastLogin).toLocaleDateString('es-ES')
                            : 'Nunca'
                          }
                        </span>
                      </div>
                      
                      <div className={styles.tableCell}>
                        <div className={styles.actions}>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserDetails(true);
                            }}
                            className={styles.actionBtn}
                            title="Ver detalles"
                          >
                            <Eye size={16} />
                          </button>
                          {user.subscriptionBlocked ? (
                            <button
                              onClick={() => unblockUserSubscriptions(user._id)}
                              className={`${styles.actionBtn}`}
                              style={{ backgroundColor: '#10b981', color: 'white' }}
                              title="Desbloquear suscripciones"
                              disabled={user.role === 'admin'}
                            >
                              <Check size={16} />
                            </button>
                          ) : (
                            <button
                              onClick={() => blockUserSubscriptions(user._id)}
                              className={`${styles.actionBtn}`}
                              style={{ backgroundColor: '#ef4444', color: 'white' }}
                              title="Bloquear suscripciones"
                              disabled={user.role === 'admin'}
                            >
                              <X size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => deleteUser(user._id)}
                            className={`${styles.actionBtn} ${styles.danger}`}
                            title="Eliminar usuario"
                            disabled={user.role === 'admin'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className={styles.pagination}>
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={!pagination.hasPrev}
                  className={styles.paginationBtn}
                >
                  Anterior
                </button>
                
                <span className={styles.paginationInfo}>
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!pagination.hasNext}
                  className={styles.paginationBtn}
                >
                  Siguiente
                </button>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Modal Crear Usuario */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Crear Nuevo Usuario</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={styles.modalClose}
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Nombre completo</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Ingresa el nombre del usuario"
                    className={styles.formInput}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Ingresa el email del usuario"
                    className={styles.formInput}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Rol</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className={styles.formSelect}
                  >
                    <option value="normal">Usuario Normal</option>
                    <option value="suscriptor">Suscriptor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={createUser}
                  className={`${styles.actionButton} ${styles.primary}`}
                  disabled={!newUser.name || !newUser.email}
                >
                  Crear Usuario
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Agregar Suscripción */}
      <AnimatePresence>
        {showSubscriptionModal && selectedUser && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSubscriptionModal(false)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Agregar Suscripción</h2>
                <p>Usuario: {selectedUser.name}</p>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className={styles.modalClose}
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label>Tipo de Alerta</label>
                  <select
                    value={newSubscription.tipo}
                    onChange={(e) => setNewSubscription({ ...newSubscription, tipo: e.target.value })}
                    className={styles.formSelect}
                  >
                    <option value="TraderCall">Trader Call</option>
                    <option value="SmartMoney">Smart Money</option>
                    <option value="CashFlow">Cash Flow</option>
                  </select>
                </div>
                
                {/* Mostrar precio dinámico */}
                <div className={styles.formGroup}>
                  <label>Precio Mensual</label>
                  <div className={styles.priceDisplay}>
                    {pricingLoading ? (
                      <span>Cargando precio...</span>
                    ) : (
                      <span className={styles.priceValue}>
                        ${pricing ? (
                          newSubscription.tipo === 'TraderCall' 
                            ? pricing.alertas.traderCall.monthly 
                            : newSubscription.tipo === 'SmartMoney'
                            ? pricing.alertas.smartMoney.monthly
                            : pricing.alertas.traderCall.monthly
                        ) : 99}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Campo para días de suscripción */}
                <div className={styles.formGroup}>
                  <label>Días de Suscripción</label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={newSubscription.days}
                    onChange={(e) => setNewSubscription({ ...newSubscription, days: parseInt(e.target.value) || 30 })}
                    placeholder="30"
                    className={styles.formInput}
                  />
                  <small className={styles.formHint}>
                    Número de días de suscripción (por defecto: 30 días)
                  </small>
                </div>
              </div>
              
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowSubscriptionModal(false)}
                  className={`${styles.actionButton} ${styles.secondary}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={addSubscription}
                  className={`${styles.actionButton} ${styles.primary}`}
                >
                  Agregar Suscripción
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Detalles de Usuario */}
      <AnimatePresence>
        {showUserDetails && selectedUser && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowUserDetails(false)}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h2>Detalles del Usuario</h2>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className={styles.modalClose}
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.userDetails}>
                  <div className={styles.detailGroup}>
                    <strong>Nombre:</strong> {selectedUser.name}
                  </div>
                  <div className={styles.detailGroup}>
                    <strong>Email:</strong> {selectedUser.email}
                  </div>
                  <div className={styles.detailGroup}>
                    <strong>Rol:</strong> 
                    <span className={getRoleBadgeClass(selectedUser.role)}>
                      {selectedUser.role}
                    </span>
                  </div>
                  <div className={styles.detailGroup}>
                    <strong>Fecha de registro:</strong> 
                    {new Date(selectedUser.createdAt).toLocaleDateString('es-ES')}
                  </div>
                  <div className={styles.detailGroup}>
                    <strong>Último login:</strong> 
                    {selectedUser.lastLogin 
                      ? new Date(selectedUser.lastLogin).toLocaleDateString('es-ES')
                      : 'Nunca'
                    }
                  </div>
                  <div className={styles.detailGroup}>
                    <strong>Estado:</strong> 
                    <span className={selectedUser.isActive ? styles.statusActive : styles.statusInactive}>
                      {selectedUser.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  {selectedUser.subscriptions && selectedUser.subscriptions.length > 0 && (
                    <div className={styles.detailGroup}>
                      <strong>Suscripciones activas:</strong>
                      <div className={styles.subscriptionList}>
                        {selectedUser.subscriptions
                          .filter(sub => sub.activa)
                          .map((sub) => (
                            <div key={sub.tipo} className={styles.subscriptionDetail}>
                              <span
                                className={styles.subscriptionBadge}
                                style={{ backgroundColor: getSubscriptionColor(sub.tipo) }}
                              >
                                {sub.tipo}
                                {sub.isTrial && <span style={{ 
                                  marginLeft: '6px', 
                                  fontSize: '0.75em', 
                                  fontWeight: 'bold',
                                  opacity: 0.9 
                                }}>(PRUEBA)</span>}
                              </span>
                              <span>${sub.precio}/mes</span>
                              <span>
                                Desde: {new Date(sub.fechaInicio).toLocaleDateString('es-ES')}
                                {sub.fechaFin && (
                                  <> • Hasta: {new Date(sub.fechaFin).toLocaleDateString('es-ES')}</>
                                )}
                              </span>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  )}
                  
                  <div className={styles.detailGroup}>
                    <strong>Ingresos mensuales:</strong> 
                    <span className={styles.revenue}>
                      ${(selectedUser.ingresoMensual || 0).toLocaleString()}/mes
                    </span>
                  </div>
                </div>
              </div>
              
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className={`${styles.actionButton} ${styles.primary}`}
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  // console.log('🔍 [USERS] Iniciando verificación de acceso...');
  
  try {
    // Usar la función de verificación que ya sabemos que funciona
    const verification = await verifyAdminAccess(context);
    
    // console.log('🔍 [USERS] Resultado de verificación:', verification);
    
    if (!verification.isAdmin) {
      // console.log('❌ [USERS] Acceso denegado - redirigiendo a:', verification.redirectTo);
      return {
        redirect: {
          destination: verification.redirectTo || '/',
          permanent: false,
        },
      };
    }

    // console.log('✅ [USERS] Acceso de admin confirmado para:', verification.session?.user?.email || verification.user?.email);
    
    return {
      props: {
        user: verification.session?.user || verification.user,
      },
    };

  } catch (error) {
    console.error('💥 [USERS] Error en getServerSideProps:', error);
    
    return {
      redirect: {
        destination: '/api/auth/signin',
        permanent: false,
      },
    };
  }
};