import dbConnect from './mongodb';
import User from '@/models/User';

/**
 * Verifica si un usuario está bloqueado para suscripciones
 * También verifica por telegramUserId si está vinculado
 */
export async function isUserBlocked(user: any): Promise<boolean> {
  try {
    await dbConnect();
    
    // 1. Verificar si el usuario está bloqueado directamente
    if (user.subscriptionBlocked === true) {
      return true;
    }
    
    // 2. Si tiene telegramUserId, verificar si otro usuario con ese mismo ID está bloqueado
    if (user.telegramUserId) {
      const blockedByTelegram = await User.findOne({
        telegramUserId: user.telegramUserId,
        subscriptionBlocked: true,
        _id: { $ne: user._id } // Excluir el usuario actual
      }).lean();
      
      if (blockedByTelegram) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Error verificando bloqueo:', error);
    // En caso de error, retornar false para no bloquear usuarios legítimos
    return false;
  }
}

/**
 * Cancela todas las suscripciones activas de un usuario
 */
export async function cancelAllActiveSubscriptions(userId: string): Promise<{
  cancelled: number;
  details: Array<{ service: string; type: string }>;
}> {
  try {
    await dbConnect();
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    const now = new Date();
    const cancelled: Array<{ service: string; type: string }> = [];
    
    // Cancelar suscripciones en suscripciones (array antiguo)
    if (user.suscripciones && Array.isArray(user.suscripciones)) {
      user.suscripciones.forEach((sub: any) => {
        if (sub.activa && new Date(sub.fechaVencimiento) > now) {
          sub.activa = false;
          cancelled.push({ service: sub.servicio, type: 'legacy' });
        }
      });
    }
    
    // Cancelar suscripciones en subscriptions (array admin)
    if (user.subscriptions && Array.isArray(user.subscriptions)) {
      user.subscriptions.forEach((sub: any) => {
        if (sub.activa && (!sub.fechaFin || new Date(sub.fechaFin) > now)) {
          sub.activa = false;
          cancelled.push({ service: sub.tipo, type: 'admin' });
        }
      });
    }
    
    // Cancelar suscripciones en activeSubscriptions (MercadoPago)
    if (user.activeSubscriptions && Array.isArray(user.activeSubscriptions)) {
      user.activeSubscriptions.forEach((sub: any) => {
        if (sub.isActive && new Date(sub.expiryDate) > now) {
          sub.isActive = false;
          cancelled.push({ service: sub.service, type: 'mercadopago' });
        }
      });
    }
    
    // Actualizar subscriptionExpiry si no hay más suscripciones activas
    const hasActiveSubs = user.activeSubscriptions?.some(
      (sub: any) => sub.isActive && new Date(sub.expiryDate) > now
    );
    
    if (!hasActiveSubs) {
      // Si no hay suscripciones activas, actualizar el rol a 'normal' si no es admin
      if (user.role === 'suscriptor') {
        user.role = 'normal';
      }
    }
    
    await user.save();
    
    return {
      cancelled: cancelled.length,
      details: cancelled
    };
  } catch (error) {
    console.error('❌ Error cancelando suscripciones:', error);
    throw error;
  }
}

/**
 * Bloquea un usuario y cancela todas sus suscripciones activas
 */
export async function blockUserSubscriptions(
  userId: string,
  reason?: string
): Promise<{
  success: boolean;
  cancelled: number;
  details: Array<{ service: string; type: string }>;
}> {
  try {
    await dbConnect();
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    // Cancelar todas las suscripciones activas
    const cancellationResult = await cancelAllActiveSubscriptions(userId);
    
    // Marcar como bloqueado
    user.subscriptionBlocked = true;
    user.subscriptionBlockedAt = new Date();
    if (reason) {
      user.subscriptionBlockedReason = reason;
    }
    
    await user.save();
    
    console.log(`✅ Usuario ${user.email} bloqueado. Suscripciones canceladas: ${cancellationResult.cancelled}`);
    
    return {
      success: true,
      cancelled: cancellationResult.cancelled,
      details: cancellationResult.details
    };
  } catch (error) {
    console.error('❌ Error bloqueando usuario:', error);
    throw error;
  }
}

/**
 * Desbloquea un usuario
 */
export async function unblockUserSubscriptions(userId: string): Promise<{
  success: boolean;
}> {
  try {
    await dbConnect();
    
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    
    user.subscriptionBlocked = false;
    user.subscriptionBlockedAt = undefined;
    user.subscriptionBlockedReason = undefined;
    
    await user.save();
    
    console.log(`✅ Usuario ${user.email} desbloqueado`);
    
    return {
      success: true
    };
  } catch (error) {
    console.error('❌ Error desbloqueando usuario:', error);
    throw error;
  }
}
