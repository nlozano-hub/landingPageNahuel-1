import { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import TelegramBot from 'node-telegram-bot-api';

/**
 * Cronjob para expulsar usuarios de canales de Telegram
 * cuando su suscripción ha expirado.
 * 
 * Ejecutar diariamente a las 00:00 o cada X horas
 * 
 * En Vercel: Configurar en vercel.json como cron
 * {
 *   "crons": [{
 *     "path": "/api/cron/telegram-expulsion",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */

// Mapeo de servicios a canales
const CHANNEL_MAP: Record<string, string> = {
  'TraderCall': process.env.TELEGRAM_CHANNEL_TRADERCALL || '',
  'SmartMoney': process.env.TELEGRAM_CHANNEL_SMARTMONEY || '',
};

interface ExpulsionResult {
  userId: string;
  email: string;
  telegramUserId: number;
  service: string;
  success: boolean;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autorización del cron
  const authHeader = req.headers.authorization;
  const querySecret = req.query.secret as string; // Secret en URL para cronjob.org
  const cronSecret = process.env.CRON_SECRET;
  
  // Permitir ejecución si:
  // 1. Viene de Vercel Cron (header de Vercel)
  // 2. Tiene el secret correcto en header Authorization
  // 3. Tiene el secret correcto en query string (?secret=xxx) - para cronjob.org
  // 4. Es una llamada local en desarrollo
  // 5. NO hay CRON_SECRET configurado (permite acceso libre - NO RECOMENDADO en producción)
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const hasValidHeaderSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const hasValidQuerySecret = cronSecret && querySecret === cronSecret;
  const isDevelopment = process.env.NODE_ENV === 'development';
  const noCronSecretConfigured = !cronSecret; // Si no hay secret configurado, permitir acceso
  
  if (!isVercelCron && !hasValidHeaderSecret && !hasValidQuerySecret && !isDevelopment && !noCronSecretConfigured) {
    console.log('⚠️ [TELEGRAM EXPULSION] Acceso no autorizado');
    return res.status(401).json({ error: 'No autorizado' });
  }
  
  if (noCronSecretConfigured) {
    console.log('⚠️ [TELEGRAM EXPULSION] CRON_SECRET no configurado - acceso sin autenticación');
  }

  // ✅ NUEVO: Modo verbose para ver detalles sin expulsar
  const verboseMode = req.query.verbose === 'true' || req.body?.verbose === true;
  const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;
  
  if (verboseMode) {
    console.log('📊 [TELEGRAM EXPULSION] Modo verbose activado - se mostrarán detalles de todos los usuarios');
  }
  if (dryRun) {
    console.log('🧪 [TELEGRAM EXPULSION] Modo dry-run activado - NO se expulsará a nadie, solo simulación');
  }

  console.log('🚀 [TELEGRAM EXPULSION] Iniciando cronjob de expulsión...');

  try {
    // Verificar que el bot esté configurado
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
      console.log('⚠️ [TELEGRAM EXPULSION] Bot de Telegram no configurado');
      return res.status(200).json({ 
        success: true, 
        message: 'Bot de Telegram no configurado',
        expelled: 0 
      });
    }

    await dbConnect();

    const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    const now = new Date();
    const results: ExpulsionResult[] = [];

    // ✅ OPTIMIZADO: Cachear verificación de permisos del bot por canal al inicio
    const botPermissions: Record<string, boolean> = {};
    const botInfo = await bot.getMe();
    
    for (const service of ['TraderCall', 'SmartMoney']) {
      const channelId = CHANNEL_MAP[service];
      if (channelId) {
        try {
          const botMember = await bot.getChatMember(channelId, botInfo.id);
          if (botMember.status === 'administrator') {
            const canRestrict = (botMember as any).can_restrict_members === true;
            botPermissions[service] = canRestrict;
            console.log(`✅ [TELEGRAM EXPULSION] Bot tiene permisos de administrador en ${service}: ${canRestrict}`);
          } else {
            botPermissions[service] = false;
            console.log(`⚠️ [TELEGRAM EXPULSION] Bot NO es administrador en ${service} (status: ${botMember.status})`);
          }
        } catch (permError: any) {
          botPermissions[service] = false;
          console.error(`❌ [TELEGRAM EXPULSION] Error verificando permisos del bot en ${service}:`, permError.message);
        }
      } else {
        botPermissions[service] = false;
      }
    }

    // ✅ NUEVO: Buscar usuarios CON suscripción activa pero SIN Telegram vinculado (para enviar advertencia)
    const usersWithoutTelegram = await User.find({
      $or: [
        { telegramUserId: { $exists: false } },
        { telegramUserId: null }
      ]
    }).select('email role suscripciones subscriptions activeSubscriptions name');

    console.log(`📊 [TELEGRAM EXPULSION] Encontrados ${usersWithoutTelegram.length} usuarios SIN Telegram vinculado`);

    // ✅ CORREGIDO: Buscar TODOS los usuarios con Telegram vinculado
    // No solo los que tienen telegramChannelAccess, porque algunos pueden haberse unido manualmente
    const allUsersWithTelegram = await User.find({
      telegramUserId: { $exists: true, $ne: null }
    }).select('telegramUserId telegramChannelAccess email role suscripciones subscriptions activeSubscriptions name');

    console.log(`📊 [TELEGRAM EXPULSION] Encontrados ${allUsersWithTelegram.length} usuarios con Telegram vinculado`);
    
    // ✅ NUEVO: Determinar qué servicios verificar para cada usuario
    // Si tiene telegramChannelAccess, usar esos servicios
    // Si no, verificar ambos servicios (TraderCall y SmartMoney) para ver si está en algún canal
    const usersToProcess: Array<{
      user: any;
      servicesToCheck: Array<'TraderCall' | 'SmartMoney'>;
    }> = [];
    
    for (const user of allUsersWithTelegram) {
      const servicesToCheck: Array<'TraderCall' | 'SmartMoney'> = [];
      
      // ✅ MEJORADO: Siempre verificar ambos servicios para detectar usuarios que volvieron a entrar
      // Si tiene telegramChannelAccess, usar esos servicios PERO también verificar el otro servicio
      if (user.telegramChannelAccess && user.telegramChannelAccess.length > 0) {
        user.telegramChannelAccess.forEach((access: any) => {
          if (access.service && !servicesToCheck.includes(access.service)) {
            servicesToCheck.push(access.service);
          }
        });
        // ✅ NUEVO: También verificar el servicio que NO tiene en DB (puede haber vuelto a entrar)
        const allServices: Array<'TraderCall' | 'SmartMoney'> = ['TraderCall', 'SmartMoney'];
        allServices.forEach((service) => {
          if (!servicesToCheck.includes(service)) {
            servicesToCheck.push(service);
          }
        });
      } else {
        // Si no tiene telegramChannelAccess, verificar ambos servicios
        // (puede haberse unido manualmente al canal)
        servicesToCheck.push('TraderCall', 'SmartMoney');
      }
      
      if (servicesToCheck.length > 0) {
        usersToProcess.push({ user, servicesToCheck });
      }
    }
    
    console.log(`📊 [TELEGRAM EXPULSION] Verificando ${usersToProcess.length} usuarios con servicios a verificar`);

    for (const { user, servicesToCheck } of usersToProcess) {
      if (!user.telegramUserId) {
        console.log(`⚠️ [TELEGRAM EXPULSION] Usuario ${user.email} sin telegramUserId`);
        continue;
      }

      console.log(`🔍 [TELEGRAM EXPULSION] Procesando usuario: ${user.email} (rol: ${user.role})`);
      console.log(`   - telegramUserId: ${user.telegramUserId}`);
      console.log(`   - telegramChannelAccess:`, user.telegramChannelAccess && user.telegramChannelAccess.length > 0 
        ? JSON.stringify(user.telegramChannelAccess, null, 2) 
        : 'NINGUNO (verificando si está en canales manualmente)');
      
      // ✅ DEBUG: Mostrar TODAS las suscripciones (activas e inactivas) para debugging
      console.log(`   📋 TODAS las suscripciones del usuario:`);
      if (user.suscripciones && user.suscripciones.length > 0) {
        console.log(`      - suscripciones (legacy):`, JSON.stringify(user.suscripciones.map((s: any) => ({
          servicio: s.servicio,
          activa: s.activa,
          fechaVencimiento: s.fechaVencimiento,
          fechaVencimientoDate: new Date(s.fechaVencimiento),
          esFutura: new Date(s.fechaVencimiento) > now
        })), null, 2));
      } else {
        console.log(`      - suscripciones (legacy): []`);
      }
      
      if (user.subscriptions && user.subscriptions.length > 0) {
        console.log(`      - subscriptions (intermedio):`, JSON.stringify(user.subscriptions.map((s: any) => ({
          tipo: s.tipo,
          activa: s.activa,
          fechaFin: s.fechaFin,
          fechaFinDate: s.fechaFin ? new Date(s.fechaFin) : null,
          esFutura: s.fechaFin ? new Date(s.fechaFin) > now : false
        })), null, 2));
      } else {
        console.log(`      - subscriptions (intermedio): []`);
      }
      
      if (user.activeSubscriptions && user.activeSubscriptions.length > 0) {
        console.log(`      - activeSubscriptions (nuevo):`, JSON.stringify(user.activeSubscriptions.map((s: any) => ({
          service: s.service,
          isActive: s.isActive,
          expiryDate: s.expiryDate,
          expiryDateDate: new Date(s.expiryDate),
          esFutura: new Date(s.expiryDate) > now,
          subscriptionType: s.subscriptionType
        })), null, 2));
      } else {
        console.log(`      - activeSubscriptions (nuevo): []`);
      }
      
      console.log(`   🕐 Fecha actual (now): ${now.toISOString()}`);

      // Verificar cada servicio para este usuario
      for (const service of servicesToCheck) {
        const channelId = CHANNEL_MAP[service];
        
        // ✅ MEJORADO: SIEMPRE verificar si el usuario está realmente en el canal usando la API de Telegram
        // Esto detecta usuarios que volvieron a entrar después de ser expulsados
        const hasAccessInDB = user.telegramChannelAccess?.some((a: any) => a.service === service);
        let isUserInChannel = false;
        let memberStatus: string | null = null;
        
        // ✅ CRÍTICO: Siempre verificar con la API de Telegram, no confiar solo en DB
        if (channelId) {
          try {
            const member = await bot.getChatMember(channelId, user.telegramUserId);
            memberStatus = member.status;
            
            // Verificar si el usuario está realmente en el canal
            // Status puede ser: 'creator', 'administrator', 'member', 'restricted', 'left', 'kicked'
            if (member.status === 'left' || member.status === 'kicked') {
              isUserInChannel = false;
              console.log(`   ⚠️ Usuario ${user.email} NO está en canal ${service} (status: ${member.status})`);
              
              // Si tiene acceso en DB pero no está en el canal, limpiar acceso
              if (hasAccessInDB && user.telegramChannelAccess) {
                user.telegramChannelAccess = user.telegramChannelAccess.filter(
                  (a: any) => a.service !== service
                );
                console.log(`   🧹 Limpiando acceso en DB para ${user.email} en ${service} (no está en canal)`);
              }
              continue; // Saltar este servicio
            } else {
              // Usuario está en el canal (member, administrator, creator, restricted, etc.)
              isUserInChannel = true;
              
              if (!hasAccessInDB) {
                console.log(`   🔍 Usuario ${user.email} está en canal ${service} (status: ${member.status}) pero NO tiene telegramChannelAccess - puede haber vuelto a entrar después de expulsión`);
              } else {
                console.log(`   ✅ Usuario ${user.email} está en canal ${service} (status: ${member.status}) y tiene acceso en DB`);
              }
            }
          } catch (error: any) {
            // ✅ MEJORADO: Manejar diferentes tipos de errores
            if (error.message?.includes('PARTICIPANT_ID_INVALID')) {
              console.log(`   ⚠️ telegramUserId inválido para ${user.email} (${user.telegramUserId}) en ${service} - el usuario puede haber eliminado su cuenta de Telegram`);
            } else if (error.message?.includes('USER_NOT_PARTICIPANT')) {
              console.log(`   ⚠️ Usuario ${user.email} no está en el canal ${service}`);
              isUserInChannel = false;
            } else {
              console.log(`   ⚠️ No se pudo verificar si ${user.email} está en ${service}: ${error.message}`);
            }
            // Si hay error verificando, asumir que no está en el canal para ser seguro
            isUserInChannel = false;
            continue; // Saltar este servicio para este usuario
          }
        } else {
          console.log(`   ⚠️ Canal no configurado para ${service}`);
          continue;
        }
        
        console.log(`   🔎 Verificando servicio: ${service} - Usuario en canal: ${isUserInChannel}`);
        
        // ✅ CORREGIDO: Verificar suscripción activa en los TRES sistemas (igual que subscriptionAuth.ts)
        // 1. Verificar en suscripciones (array antiguo/legacy)
        const suscripcionActiva = user.suscripciones?.find(
          (sub: any) => {
            const matchesService = sub.servicio === service;
            const isActive = sub.activa === true;
            const fechaVenc = sub.fechaVencimiento ? new Date(sub.fechaVencimiento) : null;
            const isFuture = fechaVenc ? fechaVenc > now : false;
            
            console.log(`      🔍 Verificando suscripción legacy: servicio=${sub.servicio}, activa=${sub.activa}, fechaVenc=${sub.fechaVencimiento}, esFutura=${isFuture}`);
            
            return matchesService && isActive && isFuture;
          }
        );
        
        // 2. Verificar en subscriptions (array intermedio/admin)
        const subscriptionActiva = user.subscriptions?.find(
          (sub: any) => {
            const matchesService = sub.tipo === service;
            const isActive = sub.activa === true;
            const fechaFin = sub.fechaFin ? new Date(sub.fechaFin) : null;
            const isFuture = fechaFin ? fechaFin > now : (!sub.fechaFin); // Si no tiene fechaFin, considerar activa
            
            console.log(`      🔍 Verificando subscription intermedio: tipo=${sub.tipo}, activa=${sub.activa}, fechaFin=${sub.fechaFin}, esFutura=${isFuture}`);
            
            return matchesService && isActive && isFuture;
          }
        );
        
        // 3. Verificar en activeSubscriptions (MercadoPago - incluye trials y full)
        const activeSubscription = user.activeSubscriptions?.find(
          (sub: any) => {
            const matchesService = sub.service === service;
            const isActive = sub.isActive === true;
            const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
            const isFuture = expiryDate ? expiryDate > now : false;
            
            console.log(`      🔍 Verificando activeSubscription: service=${sub.service}, isActive=${sub.isActive}, expiryDate=${sub.expiryDate}, esFutura=${isFuture}, type=${sub.subscriptionType}`);
            
            return matchesService && isActive && isFuture;
          }
        );
        
        console.log(`   📊 Resultados de verificación para ${service}:`);
        console.log(`      - suscripcionActiva (legacy):`, suscripcionActiva ? `SÍ (vence: ${suscripcionActiva.fechaVencimiento}, fecha: ${new Date(suscripcionActiva.fechaVencimiento).toISOString()})` : 'NO');
        console.log(`      - subscriptionActiva (intermedio):`, subscriptionActiva ? `SÍ (vence: ${subscriptionActiva.fechaFin || 'sin fecha'}, fecha: ${subscriptionActiva.fechaFin ? new Date(subscriptionActiva.fechaFin).toISOString() : 'N/A'})` : 'NO');
        console.log(`      - activeSubscription (nuevo):`, activeSubscription ? `SÍ (vence: ${activeSubscription.expiryDate}, fecha: ${new Date(activeSubscription.expiryDate).toISOString()}, type: ${activeSubscription.subscriptionType})` : 'NO');
        
        // Si tiene suscripción activa en cualquiera de los tres sistemas, NO expulsar
        const hasActiveSubscription = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
        
        console.log(`   ✅ Tiene suscripción activa: ${hasActiveSubscription}`);

        // ✅ NUEVO: En modo verbose, agregar información sobre usuarios con suscripción activa
        if (verboseMode && hasActiveSubscription) {
          results.push({
            userId: user._id.toString(),
            email: user.email,
            telegramUserId: user.telegramUserId,
            service,
            success: true,
            error: `Usuario tiene suscripción activa - NO expulsado`
          });
        }

        // ✅ CORREGIDO: Si tiene suscripción activa, asegurar que tenga acceso en DB
        if (hasActiveSubscription && isUserInChannel && !hasAccessInDB) {
          // Usuario tiene suscripción activa y está en el canal pero no tiene acceso en DB
          // Agregar acceso para futuras verificaciones
          console.log(`   ✅ Usuario ${user.email} tiene suscripción activa y está en canal ${service} - agregando acceso en DB`);
          if (!user.telegramChannelAccess) {
            user.telegramChannelAccess = [];
          }
          user.telegramChannelAccess.push({
            service,
            channelId: CHANNEL_MAP[service],
            joinedAt: new Date(),
            inviteLink: undefined
          });
        }
        
        // ✅ CORREGIDO: Si no tiene suscripción activa en NINGÚN sistema, expulsar (incluye admins)
        if (!hasActiveSubscription) {
          // Solo expulsar si el usuario está realmente en el canal
          if (!isUserInChannel) {
            console.log(`   ℹ️ Usuario ${user.email} no está en canal ${service} - no es necesario expulsar`);
            // Limpiar acceso en DB si existe
            if (hasAccessInDB && user.telegramChannelAccess) {
              user.telegramChannelAccess = user.telegramChannelAccess.filter(
                (a: any) => a.service !== service
              );
              console.log(`   🧹 Limpiando acceso en DB para ${user.email} en ${service}`);
            }
            continue;
          }
          
          console.log(`   🚨 Usuario ${user.email} NO tiene suscripción activa para ${service} y ESTÁ en el canal (status: ${memberStatus}) - PROCESANDO EXPULSIÓN`);
          if (user.role === 'admin') {
            console.log(`   ⚠️ NOTA: Este usuario es ADMIN pero será expulsado por no tener suscripción activa`);
          }
          if (!hasAccessInDB) {
            console.log(`   ⚠️ NOTA: Este usuario volvió a entrar al canal después de ser expulsado - será expulsado nuevamente`);
          }
          
          // channelId ya está definido en línea 198, no es necesario redefinirlo
          if (!channelId) {
            console.log(`⚠️ [TELEGRAM EXPULSION] Canal no configurado para ${service}`);
            continue;
          }

          try {
            // ✅ OPTIMIZADO: Usar permisos cacheados del bot
            if (!botPermissions[service]) {
              const errorMsg = `Bot NO tiene permisos de administrador en ${service} (canal: ${channelId}). El bot debe ser administrador y tener el permiso 'can_restrict_members' habilitado.`;
              console.error(`❌ [TELEGRAM EXPULSION] ${errorMsg}`);
              
              results.push({
                userId: user._id.toString(),
                email: user.email,
                telegramUserId: user.telegramUserId,
                service,
                success: false,
                error: errorMsg
              });
              continue;
            }

            // ✅ OPTIMIZADO: Reutilizar memberStatus de la primera verificación si está disponible
            // Si memberStatus es null, verificar nuevamente
            let memberStatusBeforeBan: string | null = memberStatus;
            
            // Verificar nuevamente solo si memberStatus es null (no se pudo obtener en la primera verificación)
            if (!memberStatusBeforeBan) {
              try {
                const member = await bot.getChatMember(channelId, user.telegramUserId);
                memberStatusBeforeBan = member.status;
                console.log(`   📊 Estado actual del usuario en ${service}: ${memberStatusBeforeBan}`);
              } catch (statusError: any) {
                // Si no podemos obtener el estado, puede ser que el usuario no esté en el canal
                if (statusError.message?.includes('USER_NOT_PARTICIPANT') || 
                    statusError.message?.includes('PARTICIPANT_ID_INVALID')) {
                  console.log(`   ℹ️ Usuario ${user.email} no está en el canal ${service} - solo limpiando acceso en DB`);
                  
                  // Remover el acceso del usuario en la base de datos
                  if (user.telegramChannelAccess) {
                    user.telegramChannelAccess = user.telegramChannelAccess.filter(
                      (a: any) => a.service !== service
                    );
                  }
                  
                  results.push({
                    userId: user._id.toString(),
                    email: user.email,
                    telegramUserId: user.telegramUserId,
                    service,
                    success: true,
                    error: 'Usuario no está en el canal'
                  });
                  continue; // Saltar al siguiente servicio
                }
                // Si es otro error, continuar con el intento de expulsión
                console.log(`   ⚠️ No se pudo verificar estado del usuario, continuando con expulsión: ${statusError.message}`);
              }
            }
            
            // ✅ Verificar si el usuario es administrador o creador del canal (usando status de primera o segunda verificación)
            if (memberStatusBeforeBan === 'administrator' || memberStatusBeforeBan === 'creator') {
              console.log(`   ⚠️ Usuario ${user.email} es ${memberStatusBeforeBan} del canal ${service} - NO se puede expulsar (limitación de Telegram)`);
              
              results.push({
                userId: user._id.toString(),
                email: user.email,
                telegramUserId: user.telegramUserId,
                service,
                success: false,
                error: `Usuario es ${memberStatusBeforeBan} del canal - no se puede expulsar (limitación de Telegram API). Debe ser removido manualmente como administrador.`
              });
              continue; // Saltar al siguiente servicio
            }
            
            // Si el usuario ya no está en el canal (left, kicked), solo limpiar acceso en DB
            if (memberStatusBeforeBan === 'left' || memberStatusBeforeBan === 'kicked') {
              console.log(`   ℹ️ Usuario ${user.email} ya no está en el canal ${service} (status: ${memberStatusBeforeBan}) - solo limpiando acceso en DB`);
              
              // Remover el acceso del usuario en la base de datos
              if (user.telegramChannelAccess) {
                user.telegramChannelAccess = user.telegramChannelAccess.filter(
                  (a: any) => a.service !== service
                );
              }
              
              results.push({
                userId: user._id.toString(),
                email: user.email,
                telegramUserId: user.telegramUserId,
                service,
                success: true,
                error: `Usuario ya estaba fuera del canal (${memberStatusBeforeBan})`
              });
              continue; // Saltar al siguiente servicio
            }

            // Expulsar usuario del canal
            // Usamos banChatMember y luego unbanChatMember para permitir reingreso futuro
            console.log(`   🔨 Intentando expulsar usuario ${user.email} (${user.telegramUserId}) del canal ${service}...`);
            
            // ✅ NUEVO: En modo dry-run, no expulsar realmente
            if (dryRun) {
              console.log(`   🧪 [DRY-RUN] Simulando expulsión de ${user.email} de ${service} (NO se ejecutó realmente)`);
              results.push({
                userId: user._id.toString(),
                email: user.email,
                telegramUserId: user.telegramUserId,
                service,
                success: true,
                error: 'DRY-RUN: Simulación completada (no se expulsó realmente)'
              });
              continue; // Saltar al siguiente servicio
            }
            
            try {
              // Intentar banear al usuario
              await bot.banChatMember(channelId, user.telegramUserId, {
                revoke_messages: false // No eliminar mensajes anteriores
              });
              
              console.log(`   ✅ Usuario baneado exitosamente`);
              
              // ✅ OPTIMIZADO: Reducir delay a 300ms (suficiente para Telegram procesar)
              await new Promise(resolve => setTimeout(resolve, 300));
              
              try {
                await bot.unbanChatMember(channelId, user.telegramUserId, {
                  only_if_banned: true // Solo desbanear si está baneado
                });
                console.log(`   ✅ Usuario desbaneado (puede reingresar si renueva)`);
              } catch (unbanError: any) {
                // Si falla el unban, no es crítico - el usuario puede seguir siendo baneado
                console.log(`   ⚠️ No se pudo desbanear usuario (no crítico): ${unbanError.message}`);
              }

              console.log(`✅ [TELEGRAM EXPULSION] Usuario expulsado: ${user.email} de ${service}`);

              // Remover el acceso del usuario (importante para detectar si vuelve a entrar)
              if (user.telegramChannelAccess) {
                user.telegramChannelAccess = user.telegramChannelAccess.filter(
                  (a: any) => a.service !== service
                );
                console.log(`   🧹 Acceso removido de telegramChannelAccess para ${user.email} en ${service}`);
              }

              results.push({
                userId: user._id.toString(),
                email: user.email,
                telegramUserId: user.telegramUserId,
                service,
                success: true
              });

              // ✅ MEJORADO: Notificar al usuario por mensaje directo con motivo específico
              // Usuario tiene Telegram vinculado pero suscripción expirada
              let telegramNotificationSent = false;
              try {
                const serviceName = service === 'TraderCall' ? 'Trader Call' : service === 'SmartMoney' ? 'Smart Money' : service;
                
                // Motivo: Suscripción expirada (siempre es este caso porque ya verificamos que no tiene suscripción activa)
                const motivoMensaje = `Tu suscripción a *${serviceName}* ha *expirado*.`;
                const solucionMensaje = `Para seguir recibiendo alertas, renueva tu suscripción en:\n` +
                  `🔗 ${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas/${service.toLowerCase().replace('call', 'call')}\n\n` +
                  `Una vez renovada, recibirás un nuevo link de invitación automáticamente.`;
                
                const mensajeCompleto = `⚠️ *Has sido removido del canal de ${serviceName}*\n\n` +
                  `${motivoMensaje} Por esta razón, has sido removido del canal de Telegram.\n\n` +
                  `*¿Qué hacer ahora?*\n\n` +
                  `${solucionMensaje}\n\n` +
                  `💡 *¿Necesitas ayuda?*\n` +
                  `Contacta a soporte desde tu perfil o responde a este mensaje.\n\n` +
                  `¡Gracias por ser parte de nuestra comunidad! 🚀`;
                
                await bot.sendMessage(
                  user.telegramUserId,
                  mensajeCompleto,
                  { parse_mode: 'Markdown' }
                );
                telegramNotificationSent = true;
                console.log(`   ✅ Notificación de Telegram enviada a ${user.email} con motivo específico`);
              } catch (msgError: any) {
                console.log(`   ⚠️ [TELEGRAM EXPULSION] No se pudo notificar por Telegram a ${user.email}: ${msgError.message}`);
                // DESHABILITADO: Solo notificaciones por Telegram, no email
                // // Enviar email como respaldo
              }
              
              // DESHABILITADO: Solo notificaciones por Telegram. No enviamos email para flujos de Telegram.
              // // ✅ NUEVO: Enviar email de notificación explicando la expulsión
              // // Usuario tiene Telegram vinculado pero suscripción expirada
              // try {
              //   const { sendEmail } = await import('@/lib/emailService');
              //   const serviceName = service === 'TraderCall' ? 'Trader Call' : service === 'SmartMoney' ? 'Smart Money' : service;
              //   const renewalUrl = `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/alertas/${service.toLowerCase().replace('call', 'call')}`;
              //   const profileUrl = `${process.env.NEXTAUTH_URL || 'https://lozanonahuel.com'}/perfil`;
              //
              //   const motivoEmail = `Tu suscripción a ${serviceName} ha expirado.`;
              //   const solucionEmail = `Para seguir recibiendo alertas, renueva tu suscripción: <br><br><a href="${renewalUrl}" style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Renovar Suscripción</a><br><br>Una vez renovada, recibirás un nuevo link de invitación automáticamente para volver a unirte al canal de Telegram.`;
              //
              //   const emailHtml = `...`;
              //
              //   await sendEmail({
              //     to: user.email,
              //     subject: `⚠️ Has sido removido del canal de ${serviceName}`,
              //     html: emailHtml
              //   });
              //
              //   console.log(`   ✅ Email de notificación enviado a ${user.email}...`);
              // } catch (emailError: any) {
              //   console.log(`   ⚠️ [TELEGRAM EXPULSION] No se pudo enviar email a ${user.email}: ${emailError.message}`);
              // }
            } catch (banError: any) {
              // ✅ MEJORADO: Manejar error específico de administrador
              if (banError.message?.includes('user is an administrator') || 
                  banError.response?.body?.description?.includes('user is an administrator')) {
                console.log(`   ⚠️ Usuario ${user.email} es administrador del canal ${service} - no se puede expulsar (limitación de Telegram API)`);
                
                results.push({
                  userId: user._id.toString(),
                  email: user.email,
                  telegramUserId: user.telegramUserId,
                  service,
                  success: false,
                  error: 'Usuario es administrador del canal - no se puede expulsar automáticamente. Debe ser removido manualmente como administrador desde Telegram.'
                });
                continue; // Saltar al siguiente servicio
              }
              
              // Si el ban falla por otro motivo, re-lanzar para que se maneje en el catch externo
              throw banError;
            }

          } catch (error: any) {
            console.error(`❌ [TELEGRAM EXPULSION] Error expulsando ${user.email} de ${service}:`, error.message);
            console.error(`   Detalles del error:`, {
              code: error.response?.body?.error_code,
              description: error.response?.body?.description,
              parameters: error.response?.body?.parameters
            });
            
            // ✅ MEJORADO: Mensajes de error más descriptivos y específicos
            let errorMessage = error.message || 'Error desconocido';
            let shouldCleanAccess = false; // Si debemos limpiar el acceso en DB aunque falle la expulsión
            
            if (error.message?.includes('CHAT_ADMIN_REQUIRED') || 
                error.response?.body?.error_code === 400) {
              errorMessage = `Bot no tiene permisos de administrador en el canal ${service}. Verificar que el bot sea admin y tenga permiso 'can_restrict_members' habilitado.`;
            } else if (error.message?.includes('PARTICIPANT_ID_INVALID') ||
                       error.response?.body?.error_code === 400) {
              errorMessage = `telegramUserId inválido o usuario no encontrado en el canal: ${user.telegramUserId}`;
              shouldCleanAccess = true; // Si el ID es inválido, limpiar acceso en DB
            } else if (error.message?.includes('USER_NOT_PARTICIPANT') ||
                       error.response?.body?.error_code === 400) {
              errorMessage = `Usuario no está en el canal ${service}`;
              shouldCleanAccess = true; // Si no está en el canal, limpiar acceso en DB
            } else if (error.message?.includes('USER_ALREADY_PARTICIPANT')) {
              // Este error no debería ocurrir, pero si pasa, significa que el usuario sigue en el canal
              errorMessage = `Usuario sigue en el canal pero no se pudo expulsar. Verificar permisos del bot.`;
            } else if (error.message?.includes('BOT_NOT_FOUND') || 
                       error.response?.body?.error_code === 401) {
              errorMessage = `Bot no encontrado o token inválido. Verificar TELEGRAM_BOT_TOKEN.`;
            } else if (error.message?.includes('CHAT_NOT_FOUND') ||
                       error.response?.body?.error_code === 400) {
              errorMessage = `Canal no encontrado. Verificar que TELEGRAM_CHANNEL_${service.toUpperCase()} esté configurado correctamente.`;
            }
            
            // Si el error indica que el usuario no está en el canal, limpiar acceso en DB
            if (shouldCleanAccess && user.telegramChannelAccess) {
              console.log(`   🧹 Limpiando acceso en DB para ${user.email} en ${service}`);
              user.telegramChannelAccess = user.telegramChannelAccess.filter(
                (a: any) => a.service !== service
              );
            }
            
            results.push({
              userId: user._id.toString(),
              email: user.email,
              telegramUserId: user.telegramUserId,
              service,
              success: false,
              error: errorMessage
            });
          }
        }
      }

      // Guardar cambios en el usuario
      if (user.isModified()) {
        await user.save();
      }
    }

    // ✅ NUEVO: Procesar usuarios SIN Telegram vinculado pero con suscripción activa
    // Enviar email de advertencia indicando que necesitan vincular Telegram
    for (const user of usersWithoutTelegram) {
      // Verificar si tiene suscripción activa en alguno de los servicios
      const servicesWithActiveSubscription: Array<'TraderCall' | 'SmartMoney'> = [];
      
      for (const service of ['TraderCall', 'SmartMoney'] as Array<'TraderCall' | 'SmartMoney'>) {
        // Verificar suscripción activa en los tres sistemas
        const suscripcionActiva = user.suscripciones?.find(
          (sub: any) => {
            const matchesService = sub.servicio === service;
            const isActive = sub.activa === true;
            const fechaVenc = sub.fechaVencimiento ? new Date(sub.fechaVencimiento) : null;
            const isFuture = fechaVenc ? fechaVenc > now : false;
            return matchesService && isActive && isFuture;
          }
        );
        
        const subscriptionActiva = user.subscriptions?.find(
          (sub: any) => {
            const matchesService = sub.tipo === service;
            const isActive = sub.activa === true;
            const fechaFin = sub.fechaFin ? new Date(sub.fechaFin) : null;
            const isFuture = fechaFin ? fechaFin > now : (!sub.fechaFin);
            return matchesService && isActive && isFuture;
          }
        );
        
        const activeSubscription = user.activeSubscriptions?.find(
          (sub: any) => {
            const matchesService = sub.service === service;
            const isActive = sub.isActive === true;
            const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
            const isFuture = expiryDate ? expiryDate > now : false;
            return matchesService && isActive && isFuture;
          }
        );
        
        const hasActiveSubscription = !!(suscripcionActiva || subscriptionActiva || activeSubscription);
        
        if (hasActiveSubscription) {
          servicesWithActiveSubscription.push(service);
        }
      }
      
      // Si tiene suscripción activa pero no tiene Telegram vinculado
      // DESHABILITADO: Solo notificaciones por Telegram. No enviamos email para flujos de Telegram.
      // (Estos usuarios no tienen Telegram vinculado, por lo que no podemos notificarlos por ningún canal)
      if (servicesWithActiveSubscription.length > 0 && !dryRun) {
        console.log(`⚠️ [TELEGRAM EXPULSION] Usuario ${user.email} tiene suscripción activa en ${servicesWithActiveSubscription.join(', ')} pero NO tiene Telegram vinculado`);
        // Email deshabilitado - solo notificaciones por Telegram
        // // try { await sendEmail(...); } catch (emailError) { ... }

        // Agregar a resultados en modo verbose
        if (verboseMode) {
          results.push({
            userId: user._id.toString(),
            email: user.email,
            telegramUserId: 0, // No tiene Telegram vinculado
            service: servicesWithActiveSubscription.join(', '),
            success: true,
            error: `Usuario tiene suscripción activa pero NO tiene Telegram vinculado`
          });
        }
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`✅ [TELEGRAM EXPULSION] Completado: ${successCount} expulsados, ${failCount} errores`);

    return res.status(200).json({
      success: true,
      message: dryRun 
        ? `Cronjob de expulsión completado (DRY-RUN - no se expulsó a nadie)` 
        : `Cronjob de expulsión completado`,
      summary: {
        totalChecked: allUsersWithTelegram.length,
        expelled: successCount,
        errors: failCount,
        dryRun: dryRun || false,
        verbose: verboseMode || false
      },
      results,
      executedAt: now.toISOString()
    });

  } catch (error: any) {
    console.error('❌ [TELEGRAM EXPULSION] Error en cronjob:', error);
    return res.status(500).json({
      success: false,
      error: 'Error ejecutando cronjob de expulsión',
      details: error.message
    });
  }
}

