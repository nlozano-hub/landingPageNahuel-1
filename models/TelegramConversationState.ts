import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITelegramConversationState extends Document {
  telegramUserId: number;
  state: 'waiting_email' | 'waiting_code';
  email?: string;
  userId?: mongoose.Types.ObjectId;
  createdAt: Date;
  expiresAt: Date;
}

const TelegramConversationStateSchema = new Schema<ITelegramConversationState>({
  telegramUserId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  state: {
    type: String,
    enum: ['waiting_email', 'waiting_code'],
    required: true
  },
  email: {
    type: String,
    required: false
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 60 * 1000), // Expira en 30 minutos
    index: { expireAfterSeconds: 0 } // TTL index para limpieza automática
  }
});

// Índice compuesto para búsquedas rápidas
TelegramConversationStateSchema.index({ telegramUserId: 1, state: 1 });

const TelegramConversationState: Model<ITelegramConversationState> = 
  mongoose.models.TelegramConversationState || 
  mongoose.model<ITelegramConversationState>('TelegramConversationState', TelegramConversationStateSchema);

export default TelegramConversationState;
