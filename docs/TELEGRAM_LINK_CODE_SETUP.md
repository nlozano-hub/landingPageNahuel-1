# Configuración: Sistema de Vinculación de Telegram con Códigos

**Fecha:** 5 de Febrero, 2026  
**Sistema:** Vinculación de cuentas de Telegram mediante códigos de 6 dígitos

---

## 📋 Resumen

Sistema mejorado para vincular cuentas de Telegram sin necesidad de que el usuario ingrese manualmente su ID. El usuario genera un código desde la web y lo envía al bot de Telegram.

---

## 🔧 Componentes Implementados

### 1. Modelo de Base de Datos: `TelegramLinkCode`

**Archivo:** `models/TelegramLinkCode.ts`

- Almacena códigos de vinculación temporales
- Código único de 6 dígitos
- Expiración automática en 15 minutos (TTL index)
- Vincula `userId` con `telegramUserId` cuando se usa

**Campos:**
- `code`: Código de 6 dígitos (único)
- `userId`: Usuario que generó el código
- `email`: Email del usuario (referencia rápida)
- `telegramUserId`: Telegram User ID (se completa al vincular)
- `telegramUsername`: Username de Telegram (se completa al vincular)
- `used`: Si el código ya fue usado
- `usedAt`: Fecha de uso
- `expiresAt`: Fecha de expiración (15 minutos)

---

### 2. Endpoint: Generar Código de Vinculación

**Archivo:** `pages/api/telegram/generate-link-code.ts`

**Método:** `POST`

**Autenticación:** Requiere sesión activa (usuario logueado)

**Funcionalidad:**
- Genera código único de 6 dígitos
- Invalida códigos anteriores no usados del mismo usuario
- Expira en 15 minutos
- Retorna código y fecha de expiración

**Respuesta:**
```json
{
  "success": true,
  "code": "123456",
  "expiresAt": "2026-02-05T15:30:00.000Z",
  "expiresInMinutes": 15,
  "instructions": "Envía el código \"123456\" al bot de Telegram..."
}
```

---

### 3. Webhook: Recibir Mensajes del Bot

**Archivo:** `pages/api/telegram/webhook.ts`

**Método:** `POST`

**Funcionalidad:**
- Recibe mensajes y comandos del bot de Telegram
- Procesa códigos de vinculación de 6 dígitos
- Maneja comandos: `/start`, `/link`, `/help`
- Vincula automáticamente cuando recibe código válido

**Comandos soportados:**
- `/start` o `/help`: Muestra ayuda e instrucciones
- `/link`: Instrucciones para vincular cuenta
- Cualquier código de 6 dígitos: Procesa vinculación

**Flujo de vinculación:**
1. Usuario envía código al bot
2. Bot busca código en DB (no usado, no expirado)
3. Verifica que telegramUserId no esté ya vinculado
4. Vincula cuenta automáticamente
5. Envía confirmación al usuario

---

### 4. Endpoint: Configurar Webhook

**Archivo:** `pages/api/telegram/setup-webhook.ts`

**Método:** `POST`

**Autenticación:** Solo administradores

**Funcionalidad:**
- Configura el webhook del bot de Telegram
- Debe ejecutarse una vez después del deploy
- Configura la URL del webhook en Telegram

**Uso:**
```bash
POST /api/telegram/setup-webhook
Authorization: Bearer <admin_token>
```

---

### 5. UI Actualizada: Perfil del Usuario

**Archivo:** `pages/perfil.tsx`

**Cambios:**
- Eliminada entrada manual de Telegram ID
- Agregado botón "Generar Código de Vinculación"
- Muestra código generado con instrucciones claras
- Verificación automática cada 3 segundos cuando hay código activo
- Botón para copiar código al portapapeles
- Botón para generar nuevo código

---

## 🚀 Configuración Inicial

### Paso 1: Configurar Webhook del Bot

Después del deploy, ejecutar:

```bash
# Desde el panel de admin o con curl
curl -X POST https://lozanonahuel.com/api/telegram/setup-webhook \
  -H "Authorization: Bearer <CRON_SECRET>"
```

O desde el código del admin, crear un botón que llame a este endpoint.

### Paso 2: Variables de Entorno

Agregar a `.env.local` y Vercel:

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=tu_token_del_bot
TELEGRAM_CHANNEL_TRADERCALL=-1001234567890
TELEGRAM_CHANNEL_SMARTMONEY=-1001234567891
TELEGRAM_ENABLED=true

# Opcional: Username del bot (para mostrar en UI)
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=tu_bot_username
```

### Paso 3: Obtener Username del Bot

1. Buscar el bot en Telegram
2. Obtener el username (ej: `@lozanonahuel_bot`)
3. Agregarlo a `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`

---

## 📱 Flujo de Usuario

### Usuario SIN Telegram vinculado:

1. **Usuario va a `/perfil`** → Sección "Telegram"
2. **Hace clic en "Generar Código"** → Se genera código de 6 dígitos
3. **Abre Telegram** → Busca el bot o usa el link proporcionado
4. **Envía el código** → Ejemplo: `123456`
5. **Bot procesa código** → Verifica y vincula automáticamente
6. **Bot confirma** → Envía mensaje de confirmación
7. **Web actualiza** → Muestra estado vinculado automáticamente

### Usuario CON Telegram vinculado:

- Ve estado de vinculación
- Puede desvincular si lo desea
- Puede generar links de invitación a canales

---

## 🔒 Seguridad

### Validaciones Implementadas:

1. **Códigos únicos**: No se pueden generar códigos duplicados
2. **Expiración**: Códigos expiran en 15 minutos
3. **Uso único**: Cada código solo se puede usar una vez
4. **Verificación de duplicados**: No permite vincular Telegram ya vinculado a otra cuenta
5. **Autenticación**: Solo usuarios logueados pueden generar códigos
6. **Webhook seguro**: Endpoint protegido (solo acepta POST de Telegram)

---

## 🐛 Troubleshooting

### El bot no responde:

1. Verificar que el webhook esté configurado: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
2. Verificar que la URL del webhook sea HTTPS
3. Verificar logs de Vercel para errores

### El código no funciona:

1. Verificar que el código no haya expirado (15 minutos)
2. Verificar que el código no haya sido usado ya
3. Verificar logs del webhook para ver errores específicos

### El usuario no se vincula automáticamente:

1. Verificar que el webhook esté recibiendo mensajes
2. Verificar logs de `/api/telegram/webhook`
3. Verificar que el código esté en la base de datos

---

## 📊 Monitoreo

### Logs a revisar:

- `✅ [TELEGRAM LINK] Código generado para <email>: <code>`
- `📨 [TELEGRAM WEBHOOK] Mensaje recibido de <username>: <text>`
- `✅ [TELEGRAM LINK] Cuenta vinculada: <email> -> <telegramUserId>`

### Métricas útiles:

- Códigos generados por día
- Códigos usados vs expirados
- Tiempo promedio de vinculación
- Errores de vinculación

---

## 🔄 Próximos Pasos (Opcional)

1. **Notificaciones push**: Enviar notificación cuando se vincula
2. **Estadísticas**: Dashboard de vinculaciones
3. **Reintentos automáticos**: Si falla la vinculación, permitir reintento
4. **Códigos QR**: Generar QR code para escanear desde móvil
5. **Vincular múltiples servicios**: Permitir vincular diferentes cuentas

---

**Última actualización:** 5 de Febrero, 2026
