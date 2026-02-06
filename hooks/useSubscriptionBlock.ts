import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface SubscriptionBlockStatus {
  isBlocked: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Hook para verificar si el usuario actual está bloqueado para suscripciones
 */
export function useSubscriptionBlock(): SubscriptionBlockStatus {
  const { data: session } = useSession();
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!session?.user?.email) {
        setLoading(false);
        setIsBlocked(false);
        return;
      }

      try {
        setLoading(true);
        const response = await fetch('/api/user/subscription-block-status');
        
        if (response.ok) {
          const data = await response.json();
          setIsBlocked(data.isBlocked === true);
        } else {
          // Si hay error, asumir que no está bloqueado para no bloquear usuarios legítimos
          setIsBlocked(false);
        }
      } catch (err) {
        console.error('Error verificando bloqueo de suscripción:', err);
        setError('Error al verificar estado');
        setIsBlocked(false);
      } finally {
        setLoading(false);
      }
    };

    checkBlockStatus();
  }, [session]);

  return { isBlocked, loading, error };
}
