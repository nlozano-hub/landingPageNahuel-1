import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  service: 'TraderCall' | 'SmartMoney' | 'SwingTrading' | 'ConsultorioFinanciero' | 'MediasMovilesAutomaticas' | 'RSIConHistoricos' | 'SmartMACD' | 'KoncordePro' | 'PackIndicadores';
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'in_process';
  mercadopagoPaymentId: string;
  mercadopagoPreferenceId?: string;
  externalReference: string;
  paymentMethodId: string;
  paymentTypeId: string;
  installments: number;
  transactionDate: Date;
  expiryDate: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema: Schema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false // Temporalmente false para permitir creación desde webhook
  },
  userEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  service: {
    type: String,
    enum: ['TraderCall', 'SmartMoney', 'SwingTrading', 'ConsultorioFinanciero', 'MediasMovilesAutomaticas', 'RSIConHistoricos', 'SmartMACD', 'KoncordePro', 'PackIndicadores'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'ARS'
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'cancelled', 'in_process'],
    required: true,
    default: 'pending'
  },
  mercadopagoPaymentId: {
    type: String,
    required: false,
    unique: false,
    sparse: true
  },
  mercadopagoPreferenceId: {
    type: String
  },
  externalReference: {
    type: String,
    required: true,
    unique: true
  },
  paymentMethodId: {
    type: String,
    required: false
  },
  paymentTypeId: {
    type: String,
    required: false
  },
  installments: {
    type: Number,
    default: 1,
    min: 1
  },
  transactionDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  expiryDate: {
    type: Date,
    required: true
  },
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Índices para optimizar búsquedas
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ userEmail: 1 });
PaymentSchema.index({ service: 1 });
PaymentSchema.index({ status: 1 });
// Comentado temporalmente para evitar conflictos con valores null
// PaymentSchema.index({ mercadopagoPaymentId: 1 }, { sparse: true });
// externalReference ya tiene unique: true en el schema, no necesita índice manual
PaymentSchema.index({ transactionDate: -1 });
PaymentSchema.index({ expiryDate: 1 });
PaymentSchema.index({ 'metadata.service': 1, status: 1 });

// Método para verificar si el pago fue exitoso
PaymentSchema.methods.isSuccessful = function(): boolean {
  return this.status === 'approved';
};

// Método para verificar si el pago está pendiente
PaymentSchema.methods.isPending = function(): boolean {
  return this.status === 'pending' || this.status === 'in_process';
};

// Método para verificar si el pago fue rechazado
PaymentSchema.methods.isRejected = function(): boolean {
  return this.status === 'rejected' || this.status === 'cancelled';
};

// Método para verificar si la suscripción está activa
PaymentSchema.methods.isSubscriptionActive = function(): boolean {
  return this.isSuccessful() && new Date() < this.expiryDate;
};

// Método estático para buscar pagos por usuario y servicio
PaymentSchema.statics.findByUserAndService = function(userId: string, service: string) {
  return this.find({ userId, service }).sort({ transactionDate: -1 });
};

// Método estático para buscar pagos activos por usuario
PaymentSchema.statics.findActiveByUser = function(userId: string) {
  return this.find({
    userId,
    status: 'approved',
    expiryDate: { $gt: new Date() }
  }).sort({ expiryDate: -1 });
};

// Método estático para buscar pagos pendientes
PaymentSchema.statics.findPending = function() {
  return this.find({
    status: { $in: ['pending', 'in_process'] }
  }).sort({ transactionDate: -1 });
};

// Método estático para actualizar estado de pago
PaymentSchema.statics.updatePaymentStatus = function(
  mercadopagoPaymentId: string,
  status: string,
  additionalData?: any
) {
  return this.findOneAndUpdate(
    { mercadopagoPaymentId },
    { 
      status,
      ...additionalData,
      updatedAt: new Date()
    },
    { new: true }
  );
};

export default mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema); 