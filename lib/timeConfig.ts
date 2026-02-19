/**
 * Obtiene la zona horaria para mostrar fechas en el sitio.
 * Prioridad: GOOGLE_CALENDAR_TIMEZONE > TZ > America/Montevideo
 */
export function getGlobalTimezone(): string {
  return process.env.GOOGLE_CALENDAR_TIMEZONE || normalizeTimezone(process.env.TZ) || 'America/Montevideo';
}

export function getGlobalReminderHour(): number {
  const raw = process.env.GLOBAL_REMINDER_HOUR || '9';
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 9;
}

/**
 * Normaliza el valor de zona horaria de process.env.TZ
 * Remueve caracteres inválidos como ':' al inicio y valida el formato
 */
export function normalizeTimezone(tz?: string): string {
  if (!tz) {
    return 'America/Montevideo';
  }
  
  // Remover dos puntos al inicio si existen (ej: ':UTC' -> 'UTC')
  let normalized = tz.trim().replace(/^:+/, '');
  
  // Si está vacío después de normalizar, usar default
  if (!normalized) {
    return 'America/Montevideo';
  }
  
  // Convertir formatos comunes inválidos a formatos válidos
  const timezoneMap: Record<string, string> = {
    'UTC': 'Etc/UTC',
    'GMT': 'Etc/GMT',
    'EST': 'America/New_York',
    'PST': 'America/Los_Angeles',
  };
  
  if (timezoneMap[normalized]) {
    normalized = timezoneMap[normalized];
  }
  
  // Validar que el formato sea válido (contiene '/' o es 'Etc/...')
  // Si no es válido, usar default
  if (!normalized.includes('/') && !normalized.startsWith('Etc/')) {
    // Intentar validar con una fecha de prueba
    try {
      new Date().toLocaleString('en-US', { timeZone: normalized });
      return normalized;
    } catch {
      return 'America/Montevideo';
    }
  }
  
  return normalized;
}

/**
 * Obtiene la zona horaria normalizada desde process.env.TZ
 */
export function getTimezone(): string {
  return normalizeTimezone(process.env.TZ);
}


