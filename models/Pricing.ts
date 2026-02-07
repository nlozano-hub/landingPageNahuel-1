import mongoose, { Schema, Document } from 'mongoose';

export interface PricingDocument extends Document {
  _id: string;
  
  // Precios de Alertas
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
  
  // Precios de Entrenamientos
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
  
  // Precios de Asesorías
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
  
  // Precios de Indicadores
  indicadores: {
    mediasMovilesAutomaticas: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    rsiConHistoricos: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    smartMACD: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    koncordePro: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
    packIndicadores: {
      price: number;
      currency: string;
      description: string;
      originalPrice?: number;
      discount?: number;
    };
  };
  
  // Configuración general
  currency: string;
  showDiscounts: boolean;
  lastUpdated: Date;
  updatedBy: string;
}

const PricingSchema = new Schema({
  alertas: {
    traderCall: {
      monthly: { type: Number, required: true, default: 15000 },
      yearly: { type: Number, required: true, default: 150000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Alertas de Trader Call' }
    },
    smartMoney: {
      monthly: { type: Number, required: true, default: 20000 },
      yearly: { type: Number, required: true, default: 200000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Alertas de Smart Money' }
    }
  },
  
  entrenamientos: {
    swingTrading: {
      price: { type: Number, required: true, default: 50000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Entrenamiento de Zero 2 Trader' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    },
    dayTrading: {
      price: { type: Number, required: true, default: 75000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Entrenamiento de Day Trading' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    },
    advanced: {
      price: { type: Number, required: true, default: 100000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Entrenamiento Avanzado' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    }
  },
  
  asesorias: {
    consultorioFinanciero: {
      price: { type: Number, required: true, default: 50000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Consultorio Financiero Individual' },
      duration: { type: String, default: '45 minutos' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    }
  },
  
  indicadores: {
    mediasMovilesAutomaticas: {
      price: { type: Number, required: true, default: 30000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Indicador Medias Móviles Automáticas para TradingView' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    },
    rsiConHistoricos: {
      price: { type: Number, required: true, default: 20000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Indicador RSI con Históricos para TradingView' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    },
    smartMACD: {
      price: { type: Number, required: true, default: 20000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Indicador Smart MACD para TradingView' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    },
    koncordePro: {
      price: { type: Number, required: true, default: 30000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Indicador Koncorde Pro para TradingView' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    },
    packIndicadores: {
      price: { type: Number, required: true, default: 70000 },
      currency: { type: String, required: true, default: 'ARS' },
      description: { type: String, default: 'Pack completo con todos los indicadores para TradingView' },
      originalPrice: { type: Number },
      discount: { type: Number, min: 0, max: 100 }
    }
  },
  
  currency: { type: String, required: true, default: 'ARS', enum: ['ARS'] },
  showDiscounts: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now },
  updatedBy: { type: String, required: true }
}, {
  timestamps: true,
  collection: 'pricing'
});

// Índices para optimizar consultas
PricingSchema.index({ currency: 1 });
PricingSchema.index({ lastUpdated: -1 });

export default mongoose.models.Pricing || mongoose.model<PricingDocument>('Pricing', PricingSchema); 