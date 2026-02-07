import { useState, useEffect, useRef } from 'react';

export interface PricingData {
  _id: string;
  alertas: {
    traderCall: {
      monthly: number;
      yearly: number;
      currency: string;
      description: string;
    };
    smartMoney: {
      monthly: number;
      yearly: number;
      currency: string;
      description: string;
    };
  };
  entrenamientos: {
    swingTrading: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    dayTrading: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    advanced: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  indicadores?: {
    mediasMovilesAutomaticas?: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    rsiConHistoricos?: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    smartMACD?: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  asesorias: {
    consultorioFinanciero: {
      price: number;
      currency: string;
      description: string;
      duration: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  currency: string;
  showDiscounts: boolean;
  lastUpdated: Date;
  updatedBy: string;
}

// ✅ OPTIMIZADO: Cache global para evitar requests duplicados
let globalPricingCache: PricingData | null = null;
let globalPricingPromise: Promise<PricingData | null> | null = null;
const CACHE_DURATION = 60000; // 1 minuto
let lastPricingFetchTime = 0;

export const usePricing = () => {
  const [pricing, setPricing] = useState<PricingData | null>(globalPricingCache);
  const [loading, setLoading] = useState(!globalPricingCache);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchPricing = async (force = false) => {
    const now = Date.now();
    
    // Usar cache si es válido
    if (!force && globalPricingCache && (now - lastPricingFetchTime) < CACHE_DURATION) {
      setPricing(globalPricingCache);
      setLoading(false);
      return;
    }

    // Si ya hay un fetch en progreso, esperar
    if (globalPricingPromise && !force) {
      const result = await globalPricingPromise;
      if (mountedRef.current) {
        setPricing(result);
        setLoading(false);
      }
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      globalPricingPromise = fetch('/api/pricing')
        .then(res => res.ok ? res.json() : null)
        .then(data => data?.success ? data.data : null)
        .catch(() => null);
      
      const data = await globalPricingPromise;
      globalPricingPromise = null;
      
      if (data) {
        globalPricingCache = data;
        lastPricingFetchTime = Date.now();
        if (mountedRef.current) {
          setPricing(data);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const updatePricing = async (newPricing: Partial<PricingData>) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPricing),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al actualizar precios');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setPricing(data.data);
        return { success: true, message: data.message };
      } else {
        throw new Error(data.error || 'Error al actualizar precios');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error updating pricing:', err);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchPricing();
    return () => { mountedRef.current = false; };
  }, []);

  // Función helper para formatear precios
  const formatPrice = (price: number, currency: string = 'ARS') => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  // Función helper para calcular descuentos
  const calculateDiscountedPrice = (originalPrice: number, discount: number) => {
    return originalPrice * (1 - discount / 100);
  };

  // Función helper para obtener precio con descuento si aplica
  const getFinalPrice = (price: number, originalPrice?: number, discount?: number) => {
    if (discount && originalPrice && discount > 0) {
      return calculateDiscountedPrice(originalPrice, discount);
    }
    return price;
  };

  return {
    pricing,
    loading,
    error,
    fetchPricing: () => fetchPricing(false),
    refetchPricing: () => fetchPricing(true),
    updatePricing,
    formatPrice,
    calculateDiscountedPrice,
    getFinalPrice,
  };
}; 