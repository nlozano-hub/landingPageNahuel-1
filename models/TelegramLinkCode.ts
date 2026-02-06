import mongoose, { Document, Schema } from 'mongoose';

export interface ITelegramLinkCode extends Document {
  code: string; // Código único de 6 dígitos
  userId: mongoose.Types.ObjectId; // Usuario que generó el código
  email: string; // Email del usuario (para referencia rápida)
  telegramUserId?: number; // Telegram User ID una vez vinculado
  telegramUsername?: string; // Username de Telegram una vez vinculado
  used: boolean; // Si el código ya fue usado
  usedAt?: Date; // Fecha de uso
  expiresAt: Date; // Fecha de expiración (15 minutos)
  createdAt: Date;
}

const TelegramLinkCodeSchema: Schema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
    length: 6
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },
  telegramUserId: {
    type: Number,
    sparse: true
  },
  telegramUsername: {
    type: String,
    trim: true
  },
  used: {
    type: Boolean,
    default: false,
    index: true
  },
  usedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
    expires: 0 // TTL index - elimina documentos automáticamente después de expiresAt
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índice compuesto para búsquedas rápidas
TelegramLinkCodeSchema.index({ code: 1, used: 1 });
TelegramLinkCodeSchema.index({ userId: 1, used: 1 });

// Limpiar códigos expirados automáticamente (TTL index ya lo hace, pero podemos agregar un método)
TelegramLinkCodeSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

const TelegramLinkCode = mongoose.models.TelegramLinkCode || mongoose.model<ITelegramLinkCode>('TelegramLinkCode', TelegramLinkCodeSchema);

export default TelegramLinkCode;
