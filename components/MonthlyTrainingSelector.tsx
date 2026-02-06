import React, { useState, useEffect } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, Users, UserX } from 'lucide-react';
import { useSubscriptionBlock } from '@/hooks/useSubscriptionBlock';
import styles from '../styles/MonthlyTrainingSelector.module.css';

interface AvailabilityData {
  month: number;
  year: number;
  monthName: string;
  available: boolean;
  currentSubscribers: number;
  maxSubscribers: number;
  remainingSlots: number;
}

interface MonthlyTrainingSelectorProps {
  trainingType: 'SwingTrading' | 'DayTrading' | 'DowJones';
  onMonthSelect: (month: number, year: number) => void;
  selectedMonth?: number;
  selectedYear?: number;
  disabled?: boolean;
  onSubscribe?: (month: number, year: number) => void;
}

const MonthlyTrainingSelector: React.FC<MonthlyTrainingSelectorProps> = ({
  trainingType,
  onMonthSelect,
  selectedMonth,
  selectedYear,
  disabled = false,
  onSubscribe
}) => {
  const { isBlocked: isSubscriptionBlocked } = useSubscriptionBlock();
  const [availabilityData, setAvailabilityData] = useState<AvailabilityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAvailabilityData();
  }, [trainingType]);

  // Efecto para auto-seleccionar el primer mes disponible cuando cambian los datos
  useEffect(() => {
    if (availabilityData.length > 0 && (!selectedMonth || !selectedYear)) {
      const firstAvailableMonth = availabilityData.find(m => m.available);
      if (firstAvailableMonth) {
        onMonthSelect(firstAvailableMonth.month, firstAvailableMonth.year);
      }
    }
  }, [availabilityData, selectedMonth, selectedYear, onMonthSelect]);

  const fetchAvailabilityData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/monthly-training-subscriptions/availability?trainingType=${trainingType}`);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar disponibilidad');
      }
      
      // Ordenar los meses por fecha (más próximo primero)
      const sortedData = data.data.sort((a: AvailabilityData, b: AvailabilityData) => {
        const dateA = new Date(a.year, a.month - 1);
        const dateB = new Date(b.year, b.month - 1);
        return dateA.getTime() - dateB.getTime();
      });
      
      setAvailabilityData(sortedData);
      
      // Si no hay un mes seleccionado, seleccionar automáticamente el primer mes disponible
      if (!selectedMonth || !selectedYear) {
        const firstAvailableMonth = sortedData.find((m: AvailabilityData) => m.available);
        if (firstAvailableMonth) {
          onMonthSelect(firstAvailableMonth.month, firstAvailableMonth.year);
        }
      }
    } catch (err) {
      console.error('Error fetching availability:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (month: number, year: number) => {
    onMonthSelect(month, year);
  };

  const getTrainingDisplayName = () => {
    switch (trainingType) {
      case 'SwingTrading':
        return 'Zero 2 Trader';
      case 'DayTrading':
        return 'Day Trading';
      case 'DowJones':
        return 'Dow Jones Advanced';
      default:
        return trainingType;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <Clock size={20} className={styles.spinner} />
          Cargando disponibilidad de meses...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorBox}>
          <AlertCircle size={16} />
          <div className={styles.infoContent}>
            <strong>Error:</strong> {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Calendar size={20} />
        <h3 className={styles.title}>Selecciona el mes para tu entrenamiento</h3>
      </div>
      
      <p className={styles.description}>
        Elige el mes en el que quieres acceder al entrenamiento de <strong>{getTrainingDisplayName()}</strong>.
        Tu acceso será válido durante todo el mes seleccionado.
      </p>

      {availabilityData.length === 0 ? (
        <div className={styles.infoBox}>
          <AlertCircle size={16} />
          <div className={styles.infoContent}>
            <strong>No hay meses disponibles</strong>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem' }}>
              Por el momento no hay entrenamientos programados con fechas confirmadas. 
              Vuelve a revisar más adelante o contacta con nosotros para más información.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.monthsGrid}>
          {availabilityData.map((monthData) => {
            const isSelected = selectedMonth === monthData.month && selectedYear === monthData.year;
            const isCurrentMonth = monthData.month === new Date().getMonth() + 1 && monthData.year === new Date().getFullYear();
            const isDisabled = !monthData.available || disabled;
            
            return (
              <button
                key={`${monthData.year}-${monthData.month}`}
                className={`${styles.monthCard} ${isSelected ? styles.selected : ''} ${isCurrentMonth ? styles.currentMonth : ''} ${isDisabled ? styles.disabled : ''}`}
                onClick={() => !isDisabled && handleMonthChange(monthData.month, monthData.year)}
                disabled={isDisabled}
              >
                <div className={styles.monthContent}>
                  <div className={styles.monthLabel}>{monthData.monthName} {monthData.year}</div>
                  
                  {/* Badges de estado */}
                  <div className={styles.badgesContainer}>
                    {isCurrentMonth && (
                      <div className={styles.currentBadge}>
                        <CheckCircle size={14} />
                        Actual
                      </div>
                    )}
                    {isSelected && (
                      <div className={styles.selectedBadge}>
                        <CheckCircle size={16} />
                        Seleccionado
                      </div>
                    )}
                    {!monthData.available && (
                      <div className={styles.fullBadge}>
                        <UserX size={14} />
                        Completo
                      </div>
                    )}
                  </div>
                  
                  {/* Información de cupos */}
                  <div className={styles.capacityInfo}>
                    <Users size={14} />
                    <span>
                      {monthData.currentSubscribers}/{monthData.maxSubscribers} 
                      {monthData.remainingSlots > 0 && ` (${monthData.remainingSlots} disponibles)`}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className={styles.infoBox}>
        <AlertCircle size={16} />
        <div className={styles.infoContent}>
          <strong>Importante:</strong> Tu acceso al entrenamiento será válido únicamente durante el mes seleccionado. 
          Una vez que termine el mes, tu acceso expirará automáticamente.
        </div>
      </div>

      {selectedMonth && selectedYear && onSubscribe && (
        <button
          onClick={() => onSubscribe(selectedMonth, selectedYear)}
          disabled={disabled || isSubscriptionBlocked}
          className={styles.subscribeButton}
        >
          Suscribirse al Mes &gt;
        </button>
      )}
      {isSubscriptionBlocked && (
        <div style={{
          padding: '12px',
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          borderRadius: '8px',
          color: '#991b1b',
          textAlign: 'center',
          marginTop: '16px',
          fontSize: '0.875rem'
        }}>
          <AlertCircle size={16} style={{ marginBottom: '4px' }} />
          <p style={{ margin: 0, fontWeight: 'bold' }}>
            Tu cuenta no puede contratar servicios
          </p>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem' }}>
            Contacta al soporte para más información
          </p>
        </div>
      )}
    </div>
  );
};

export default MonthlyTrainingSelector;
