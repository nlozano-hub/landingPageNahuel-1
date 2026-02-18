/**
 * Cron batch para expulsar usuarios de canales Telegram (suscripción vencida).
 * Idempotente, claim atómico, backoff 429, corte por tiempo ~25s.
 *
 * Auth: CRON_AUTH_MODE=vercel|secret|both
 *   - vercel: solo x-vercel-cron
 *   - secret: solo x-cron-secret
 *   - both: cualquiera
 */

import { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { telegramKickUser } from '@/lib/telegram';

const BATCH_SIZE = 50;
const CONCURRENCY = 4;
const TIME_LIMIT_MS = 25_000;
const TRANSIENT_BACKOFF_MINUTES = 10;

const CHANNEL_MAP: Record<string, string> = {
  TraderCall: process.env.TELEGRAM_CHANNEL_TRADERCALL || '',
  SmartMoney: process.env.TELEGRAM_CHANNEL_SMARTMONEY || ''
};

type Service = 'TraderCall' | 'SmartMoney';

interface KickTask {
  userId: mongoose.Types.ObjectId;
  service: Service;
  expiresAt: Date;
}

function hasActiveSubscription(user: any, service: Service, now: Date): boolean {
  const suscripcionActiva = user.suscripciones?.find(
    (s: any) =>
      s.servicio === service &&
      s.activa === true &&
      s.fechaVencimiento &&
      new Date(s.fechaVencimiento) > now
  );
  const subscriptionActiva = user.subscriptions?.find(
    (s: any) =>
      s.tipo === service &&
      s.activa === true &&
      (s.fechaFin ? new Date(s.fechaFin) > now : true)
  );
  const activeSubscription = user.activeSubscriptions?.find(
    (s: any) =>
      s.service === service &&
      s.isActive === true &&
      new Date(s.expiryDate) > now
  );
  return !!(suscripcionActiva || subscriptionActiva || activeSubscription);
}

function getKickState(user: any, service: Service) {
  const arr = user.telegramKickState || [];
  return arr.find((k: any) => k.service === service);
}

function canRetryKick(user: any, service: Service, now: Date): boolean {
  const state = getKickState(user, service);
  if (!state) return true;
  if (state.kickedAt) return false;
  if ((state.kickAttempts || 0) >= 5) return false;
  const next = state.nextKickAttemptAt;
  if (next && new Date(next) > now) return false;
  return true;
}

function getEarliestExpiry(user: any, service: Service): Date | null {
  const sources: Date[] = [];
  user.suscripciones?.forEach((s: any) => {
    if (s.servicio === service && s.fechaVencimiento)
      sources.push(new Date(s.fechaVencimiento));
  });
  user.subscriptions?.forEach((s: any) => {
    if (s.tipo === service && s.fechaFin) sources.push(new Date(s.fechaFin));
  });
  user.activeSubscriptions?.forEach((s: any) => {
    if (s.service === service && s.expiryDate)
      sources.push(new Date(s.expiryDate));
  });
  if (sources.length === 0) return null;
  return new Date(Math.min(...sources.map((d) => d.getTime())));
}

function isAuthorized(req: NextApiRequest): boolean {
  const mode = (process.env.CRON_AUTH_MODE || 'both').toLowerCase();
  const cronSecret = process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN;
  if (!cronSecret) return false;

  const headerSecret = req.headers['x-cron-secret'] as string;
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  if (mode === 'vercel') return isVercelCron;
  if (mode === 'secret') return headerSecret === cronSecret;
  return isVercelCron || headerSecret === cronSecret;
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  timeLimitMs: number
): Promise<R[]> {
  const start = Date.now();
  const results: R[] = [];
  let idx = 0;

  async function worker(): Promise<void> {
    while (idx < items.length) {
      if (Date.now() - start >= timeLimitMs) break;
      const i = idx++;
      if (i >= items.length) break;
      results.push(await fn(items[i]));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}


export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const startTime = Date.now();

  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ENABLED !== 'true') {
      return res.status(200).json({
        processed: 0,
        success: 0,
        failed: 0,
        elapsedSeconds: 0,
        remaining: 0,
        message: 'Bot no configurado'
      });
    }

    await dbConnect();

    const now = new Date();
    const users = await User.find({
      telegramUserId: { $exists: true, $ne: null }
    })
      .select(
        'telegramUserId email telegramChannelAccess telegramKickState suscripciones subscriptions activeSubscriptions'
      )
      .lean();

    const tasks: KickTask[] = [];

    for (const user of users) {
      for (const service of ['TraderCall', 'SmartMoney'] as Service[]) {
        if (hasActiveSubscription(user, service, now)) continue;
        if (!canRetryKick(user, service, now)) continue;

        const channelId = CHANNEL_MAP[service];
        if (!channelId) continue;

        const expiresAt = getEarliestExpiry(user, service);
        tasks.push({
          userId: user._id as mongoose.Types.ObjectId,
          service,
          expiresAt: expiresAt || now
        });
      }
    }

    tasks.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
    const batch = tasks.slice(0, BATCH_SIZE);

    const ensureKickEntry = async (userId: mongoose.Types.ObjectId, service: Service) => {
      await User.updateOne(
        {
          _id: userId,
          $or: [
            { telegramKickState: { $exists: false } },
            { telegramKickState: [] },
            { 'telegramKickState.service': { $ne: service } }
          ]
        },
        {
          $push: {
            telegramKickState: {
              service,
              kickedAt: null,
              kickAttempts: 0,
              lastKickAttemptAt: null,
              kickError: null,
              nextKickAttemptAt: null
            }
          }
        }
      );
    };

    const atomicClaim = async (
      userId: mongoose.Types.ObjectId,
      service: Service
    ): Promise<boolean> => {
      const result = await User.updateOne(
        {
          _id: userId,
          telegramKickState: {
            $elemMatch: {
              service,
              kickedAt: null,
              kickAttempts: { $lt: 5 },
              $or: [
                { nextKickAttemptAt: null },
                { nextKickAttemptAt: { $lte: now } }
              ]
            }
          }
        },
        {
          $inc: { 'telegramKickState.$[elem].kickAttempts': 1 },
          $set: {
            'telegramKickState.$[elem].lastKickAttemptAt': now,
            'telegramKickState.$[elem].kickError': null
          }
        },
        {
          arrayFilters: [
            {
              'elem': {
                service,
                kickedAt: null,
                kickAttempts: { $lt: 5 },
                $or: [
                  { nextKickAttemptAt: null },
                  { nextKickAttemptAt: { $lte: now } }
                ]
              }
            }
          ]
        }
      );
      return result.modifiedCount === 1;
    };

    const updateKickResult = async (
      userId: mongoose.Types.ObjectId,
      service: Service,
      updates: Record<string, any>
    ) => {
      const $set = Object.fromEntries(
        Object.entries(updates).map(([k, v]) => [
          `telegramKickState.$[elem].${k}`,
          v
        ])
      );
      await User.updateOne(
        { _id: userId, 'telegramKickState.service': service },
        { $set },
        { arrayFilters: [{ elem: { service } }] }
      );
    };

    const processOne = async (task: KickTask): Promise<boolean> => {
      const { userId, service } = task;
      const channelId = CHANNEL_MAP[service];

      await ensureKickEntry(userId, service);

      const claimed = await atomicClaim(userId, service);
      if (!claimed) return false;

      const doc = await User.findById(userId)
        .select('telegramUserId telegramChannelAccess')
        .lean() as { telegramUserId?: number } | null;
      if (!doc || !doc.telegramUserId) return false;

      const result = await telegramKickUser(
        channelId,
        doc.telegramUserId,
        process.env.TELEGRAM_BOT_TOKEN!
      );

      if (result.success) {
        await updateKickResult(userId, service, {
          kickedAt: now,
          kickError: null,
          nextKickAttemptAt: null
        });
        await User.updateOne(
          { _id: userId },
          {
            $pull: {
              telegramChannelAccess: { service }
            }
          }
        );
        return true;
      }

      const err = result.error || 'Unknown';
      if (result.errorType === 'rate_limit' && result.retryAfterSeconds) {
        const nextAt = new Date(
          now.getTime() + (result.retryAfterSeconds + 2) * 1000
        );
        await updateKickResult(userId, service, {
          kickError: err,
          nextKickAttemptAt: nextAt
        });
      } else if (result.errorType === 'transient') {
        const nextAt = new Date(
          now.getTime() + TRANSIENT_BACKOFF_MINUTES * 60 * 1000
        );
        await updateKickResult(userId, service, {
          kickError: err,
          nextKickAttemptAt: nextAt
        });
      } else {
        await updateKickResult(userId, service, {
          kickError: err
        });
      }
      return false;
    };

    const results = await runWithConcurrency(
      batch,
      CONCURRENCY,
      processOne,
      TIME_LIMIT_MS
    );

    const successCount = results.filter(Boolean).length;
    const failCount = results.length - successCount;
    const elapsedSeconds = (Date.now() - startTime) / 1000;

    const remaining = tasks.length - batch.length;

    const logPayload = {
      job: 'telegram-kick',
      processed: batch.length,
      success: successCount,
      failed: failCount,
      elapsedSeconds: Math.round(elapsedSeconds * 100) / 100,
      batchSize: BATCH_SIZE,
      concurrency: CONCURRENCY,
      remaining
    };
    console.log(JSON.stringify(logPayload));

    return res.status(200).json({
      processed: batch.length,
      success: successCount,
      failed: failCount,
      elapsedSeconds: Math.round(elapsedSeconds * 100) / 100,
      remaining
    });
  } catch (error: any) {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    console.error(
      JSON.stringify({
        job: 'telegram-kick',
        error: error?.message,
        elapsedSeconds
      })
    );
    return res.status(500).json({
      error: error?.message || 'Error en cron',
      elapsedSeconds: Math.round(elapsedSeconds * 100) / 100
    });
  }
}
