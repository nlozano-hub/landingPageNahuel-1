# DOCUMENTACIÓN TÉCNICA — Landing Page Nahuel Lozano

## 1. Descripción general

### Qué hace el sistema
Plataforma web de servicios de trading e inversiones que ofrece:
- **Alertas de trading** (Trader Call, Smart Money) con suscripciones mensuales
- **Entrenamientos** (Zero 2 Trader, Day Trading) con inscripción y pagos
- **Asesorías** (Consultorio Financiero) con reserva de turnos
- **Indicadores** para TradingView (Pack, Medias Móviles, RSI, Smart MACD, Koncorde Pro)
- **Recursos** educativos y lista de seguimiento Wall Street
- **Dashboard administrativo** para gestión de usuarios, pagos, notificaciones y contenido

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|------|------------|---------|
| Framework | Next.js | 14.0.0 |
| Runtime | React | 18.2.0 |
| Lenguaje | TypeScript | 5.2.0 |
| Base de datos | MongoDB | vía Mongoose 8.0.0 |
| ODM | Mongoose | 8.0.0 |
| Autenticación | NextAuth.js | 4.24.11 |
| Pagos | MercadoPago | 2.8.0 |
| Email | Nodemailer | 6.10.1 |
| Video streaming | Mux | @mux/mux-player-react 2.0.0 |
| Storage | Cloudinary | 2.6.1 |
| Bot | node-telegram-bot-api | 0.66.0 |
| Google APIs | googleapis, google-auth-library | 128.0.0, 9.4.1 |
| Formularios | react-hook-form, zod, @hookform/resolvers | 7.47.0, 3.22.0, 3.3.0 |
| UI | framer-motion, lucide-react, react-hot-toast | 10.16.0, 0.292.0, 2.4.1 |
| Gráficos | chart.js, react-chartjs-2, recharts | 4.4.0, 5.2.0, 3.2.1 |

---

## 3. Dependencias

### Producción
```
@hookform/resolvers, @mux/mux-player-react, @next-auth/mongodb-adapter,
@types/formidable, axios, bcryptjs, chart.js, cloudinary, csv-parser,
date-fns, dotenv, formidable, framer-motion, google-auth-library, googleapis,
isomorphic-dompurify, jose, js-cookie, lucide-react, mercadopago, mongoose,
multer, next, next-auth, node-telegram-bot-api, nodemailer, react, react-chartjs-2,
react-dom, react-dropzone, react-hook-form, react-hot-toast, recharts,
stripe, zod
```

### Desarrollo
```
@types/bcryptjs, @types/js-cookie, @types/node, @types/node-telegram-bot-api,
@types/nodemailer, @types/react, @types/react-dom, eslint, eslint-config-next,
typescript
```

---

## 4. Arquitectura del proyecto

### Estructura de carpetas

```
/
├── components/          # 61 componentes React (.tsx)
│   ├── alerts/         # Modales y vistas de alertas
│   ├── swing-trading/   # Componentes Zero 2 Trader
│   └── student/        # Dashboard estudiante
├── contexts/           # React Context providers
├── hooks/              # 21 custom hooks
├── lib/                # 32+ utilidades y servicios
├── models/             # 38 modelos Mongoose (.ts)
├── pages/              # Next.js Pages Router
│   ├── api/            # 259 endpoints API
│   │   ├── admin/      # Endpoints administrativos
│   │   ├── auth/       # NextAuth y verificación
│   │   ├── cron/       # Jobs programados
│   │   ├── webhooks/   # MercadoPago, etc.
│   │   └── ...         # Resto de dominios
│   ├── admin/          # 40+ páginas admin
│   ├── alertas/        # Páginas de alertas
│   ├── asesorias/      # Asesorías
│   ├── entrenamientos/ # Entrenamientos y Zero 2 Trader
│   ├── payment/        # Flujos de pago
│   └── auth/           # Login, error
├── scripts/            # Scripts de utilidad (Node.js)
├── styles/             # CSS Modules
├── types/              # Tipos TypeScript
└── utils/              # Utilidades
```

### Flujo general
1. Usuario accede a landing o secciones (alertas, entrenamientos, asesorías).
2. Autenticación vía Google OAuth (NextAuth).
3. Suscripciones y pagos vía MercadoPago (checkout + webhooks).
4. Admin gestiona contenido, usuarios, precios y notificaciones.
5. Cronjobs ejecutan recordatorios, expulsión Telegram, snapshots de portfolio, etc.

---

## 5. Backend / API

### Endpoints por dominio

| Dominio | Ruta base | Responsabilidad |
|---------|-----------|-----------------|
| Auth | `/api/auth/*` | NextAuth, verify-role, verify-subscription, debug |
| Alertas | `/api/alerts/*` | create, edit, close, list, update-prices, portfolio-evolution |
| Pagos | `/api/payments/*` | verify-mercadopago, retry, process-immediate, mercadopago/* |
| Webhooks | `/api/webhooks/*` | mercadopago, mercadopago-monthly-training |
| Admin | `/api/admin/*` | users, notifications, reports, monthly-trainings, pricing, etc. |
| Cron | `/api/cron/*` | training-reminders, update-stock-prices, market-close, etc. |
| Entrenamientos | `/api/entrenamientos/*` | inscribir, solicitar, schedule |
| Asesorías | `/api/asesorias/*` | solicitar, schedule |
| Bookings | `/api/bookings/*` | index, advanced, update-meet-link |
| Turnos | `/api/turnos/*` | available-slots, check-availability, generate |
| Portfolio | `/api/portfolio/*` | current-value, returns |
| Liquidez | `/api/liquidity/*` | index, summary, returns, sell, save-snapshot |
| Operaciones | `/api/operations/*` | create, list, update, delete |
| Notificaciones | `/api/notifications/*` | create, get, send, delete-read |
| Reportes | `/api/reports/*` | index, create, [id], comments |
| Telegram | `/api/telegram/*` | webhook, generate-link-code, link-account, etc. |
| Otros | `/api/*` | contact, subscribe, newsletter, pricing, stock-price, market-data, etc. |

### Métodos HTTP
- GET/POST predominantes.
- PUT en `/api/pricing`, `/api/admin/*` para actualizaciones.
- DELETE en operaciones CRUD específicas.

---

## 6. Frontend

### Páginas principales
- `index.tsx` — Landing principal con destacados, testimonios, servicios
- `perfil.tsx` — Perfil de usuario, suscripciones, notificaciones
- `alertas/index.tsx`, `alertas/trader-call.tsx`, `alertas/smart-money.tsx`
- `entrenamientos/index.tsx`, `entrenamientos/zero2trader.tsx`, `entrenamientos/swing-trading.tsx`
- `asesorias/index.tsx`, `asesorias/consultorio-financiero.tsx`
- `indicadores/index.tsx`, `packindicadores.tsx`, `mediasmovilesautomaticas.tsx`, etc.
- `recursos.tsx`, `cookies.tsx`
- `payment/success.tsx`, `payment/failed.tsx`, `payment/monthly-training/*`
- `admin/*` — Dashboard, usuarios, notificaciones, pricing, etc.

### Componentes clave
- `Navbar`, `Footer`, `AdminRouteGuard`
- `Carousel`, `ContactForm`, `NotificationDropdown`
- `VideoPlayerMux`, `YouTubePlayer`, `BackgroundVideo`
- `MonthlyTrainingSelector`, `SwingTradingMonthlyCalendar`
- `TrainingRoadmap`, `OperationsTable`, `UserSubscriptions`
- `PaymentStatusHandler`, `SubscriptionBanner`, `ScreenshotProtection`

---

## 7. Base de datos

### Tipo
MongoDB (Atlas). Conexión vía `lib/mongodb.ts` con pool, timeouts y SSL.

### Modelos detectados (38)

| Modelo | Colección | Propósito |
|--------|-----------|-----------|
| User | users | Usuarios, roles, suscripciones |
| Payment | payments | Transacciones de pago |
| Alert | alerts | Alertas de trading |
| Booking | bookings | Reservas de asesorías |
| Training | trainings | Entrenamientos (Zero 2 Trader) |
| MonthlyTraining | monthlytrainings | Entrenamientos mensuales |
| MonthlyTrainingSubscription | monthlytrainingsubscriptions | Suscripciones mensuales |
| Notification | notifications | Notificaciones in-app |
| Report | reports | Reportes de alertas |
| Module, Lesson | modules, lessons | Contenido educativo |
| Resource | resources | Recursos |
| PortfolioMetrics, PortfolioSnapshot | — | Métricas de portfolio |
| Liquidity, LiquiditySnapshot | — | Liquidez por pool |
| Operation | operations | Operaciones de trading |
| Advisory, AdvisoryDate, AdvisorySchedule | — | Asesorías |
| AvailableSlot | availableslots | Slots de turnos |
| TrainingSchedule, TrainingDate | — | Horarios de entrenamientos |
| TelegramLinkCode, TelegramConversationState | — | Vinculación Telegram |
| EmailList | emaillists | Lista de emails |
| FAQ, Testimonial, CourseCard | — | Contenido estático |
| Roadmap | roadmaps | Roadmaps de entrenamientos |
| Pricing | pricing | Precios dinámicos |
| SiteConfig | siteconfigs | Configuración del sitio |
| ApiCache | apicaches | Cache de API |
| CronNotificationJob | cronnotificationjobs | Jobs de notificaciones |
| Billing | billings | Facturación |
| NotificationTemplate | notificationtemplates | Plantillas |
| UserSubscription | usersubscriptions | Suscripciones |
| PDF | pdfs | PDFs en BD |
| Adicionales | ChatMessage.js, ReportComment.js | Mensajes y comentarios |

---

## 8. Autenticación y seguridad

### Métodos detectados
- **NextAuth v4** con Google OAuth (`lib/googleAuth.ts`)
- JWT en sesión (no MongoDB adapter para sesiones)
- Callbacks: `signIn` (crea/actualiza User en MongoDB), `jwt`, `session`
- Rol cargado desde BD en cada request vía JWT callback

### Roles
- `normal` — Usuario estándar
- `suscriptor` — Con suscripción activa
- `admin` — Administrador

### Protección de rutas
- `AdminRouteGuard` — Wrapper para páginas `/admin/*`. Verifica sesión y rol vía `/api/auth/verify-role`. Redirige a login si no autenticado.
- `getServerSideProps` — Verificación server-side en páginas admin (ej. `session.user.role === 'admin'`).
- Endpoints admin: `getServerSession` + chequeo `session.user.role !== 'admin'` → 403.

### Headers de seguridad (next.config.js)
- X-Frame-Options, X-Content-Type-Options, X-XSS-Protection
- Referrer-Policy, HSTS, Content-Security-Policy, Permissions-Policy
- poweredByHeader: false

---

## 9. Variables de entorno

| Variable | Uso |
|----------|-----|
| MONGODB_URI | Conexión MongoDB |
| NEXTAUTH_URL | URL base NextAuth (ej. https://lozanonahuel.com) |
| NEXTAUTH_SECRET | Secret NextAuth |
| GOOGLE_CLIENT_ID | OAuth Google |
| GOOGLE_CLIENT_SECRET | OAuth Google |
| GOOGLE_REDIRECT_URI | Redirect OAuth |
| GOOGLE_CALENDAR_ID | Calendario Google |
| GOOGLE_CALENDAR_TIMEZONE | Zona horaria (ej. America/Montevideo) |
| ADMIN_GOOGLE_ACCESS_TOKEN | Token admin Google |
| ADMIN_GOOGLE_REFRESH_TOKEN | Refresh token admin |
| MERCADOPAGO_ACCESS_TOKEN | Token MercadoPago |
| MP_PUBLIC_KEY | Clave pública MercadoPago |
| MERCADOPAGO_WEBHOOK_SECRET | Secret webhook MercadoPago |
| STRIPE_SECRET_KEY | Stripe (uso secundario) |
| MOBBEX_API_KEY, MOBBEX_ACCESS_TOKEN | Mobbex (pagos alternativos) |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS | Email SMTP |
| EMAIL_FROM_NAME, EMAIL_FROM_ADDRESS | Remitente |
| ADMIN_EMAIL, ADMIN_EMAILS | Emails admin |
| MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_* | Mailgun |
| BREVO_API_KEY, BREVO_SENDER_* | Brevo (alternativa email) |
| TELEGRAM_BOT_TOKEN | Bot Telegram |
| TELEGRAM_ENABLED | true/false |
| TELEGRAM_CHANNEL_TRADERCALL, TELEGRAM_CHANNEL_SMARTMONEY | IDs canales |
| TELEGRAM_BOT_USERNAME | Username del bot |
| CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | Cloudinary |
| MUX_TOKEN_ID, MUX_TOKEN_SECRET | Mux video |
| CRON_SECRET, CRON_SECRET_TOKEN | Autenticación cronjobs |
| CRON_AUTH_MODE | vercel \| secret \| both |
| ALPHA_VANTAGE_API_KEY | Precios de acciones |
| ADMIN_SETUP_CODE | Código setup primer admin |
| TZ, GLOBAL_REMINDER_HOUR | Zona horaria y hora recordatorios |
| NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_BASE_URL | URLs públicas |
| EMAIL_TESTING_MODE | true para no enviar emails reales |
| ALLOW_TEST_OVERLAP | Permitir solapamiento de reservas (testing) |
| GOOGLE_FINANCE_RATE_LIMIT, GOOGLE_FINANCE_BATCH_SIZE, GOOGLE_FINANCE_DELAY_MS | Rate limiting Google Finance |

**Archivo de referencia:** `env.example` en la raíz del proyecto.

---

## 10. Integraciones externas

| Servicio | Uso | Archivos clave |
|----------|-----|----------------|
| MercadoPago | Pagos suscripciones, entrenamientos, indicadores, reservas | lib/mercadopago.ts, webhooks/mercadopago*.ts |
| Google OAuth | Login | lib/googleAuth.ts |
| Google Calendar | Eventos, Meet links | lib/googleCalendar.ts |
| Google Finance | Precios de acciones (sin API key) | pages/api/market-data/* |
| Alpha Vantage | Precios SPY500 (fallback) | pages/api/stock-price.ts, market-data/spy500*.ts |
| Nodemailer / Mailgun / Brevo | Emails transaccionales y notificaciones | lib/emailService.ts, lib/emailNotifications.ts |
| Telegram | Bot, canales, vinculación de cuentas, expulsión por suscripción vencida | lib/telegramBot.ts, lib/telegram.ts, api/telegram/* |
| Cloudinary | Imágenes y PDFs | lib/cloudinary.ts, api/upload/*, api/pdf/* |
| Mux | Streaming de video | lib/mux.ts, VideoPlayerMux |

---

## 11. Cronjobs / Jobs

### Configurado en vercel.json
| Endpoint | Schedule | Objetivo |
|----------|----------|----------|
| /api/cron/training-reminders | 30 19 * * * (19:30 UTC diario) | Recordatorios de entrenamientos |

### Endpoints cron (sin schedule en vercel.json; invocación manual o externa)
| Endpoint | Objetivo |
|----------|----------|
| update-stock-prices | Actualizar precios de acciones |
| market-close | Cierre de mercado |
| auto-convert-ranges | Convertir rangos de alertas |
| save-portfolio-snapshot | Snapshot de portfolio |
| telegram-expulsion | Expulsar usuarios con suscripción vencida de Telegram |
| telegram-kick | Kick batch de Telegram |
| calculate-portfolio-metrics | Calcular métricas de portfolio |
| advisory-reminders | Recordatorios de asesorías |
| subscription-notifications | Notificaciones de suscripciones |
| send-notification-jobs | Envío de jobs de notificaciones |
| resend-notification | Reenviar notificación |
| resend-summary-service | Reenviar resumen de servicio |
| update-alerts-public | Actualizar alertas públicas |
| expire-subscriptions | Expirar suscripciones |

### Autenticación
- Header `Authorization: Bearer ${CRON_SECRET}` o `CRON_SECRET_TOKEN`
- Algunos endpoints aceptan `x-vercel-cron` (Vercel Cron)
- `training-reminders`: permite User-Agent de cron-job.org sin token (riesgo si CRON_SECRET no está definido)

### maxDuration
En vercel.json: 300s para update-stock-prices, market-close, auto-convert-ranges, training-reminders, save-portfolio-snapshot, telegram-expulsion, telegram-kick, calculate-portfolio-metrics.

---

## 12. Scripts y comandos

| Script | Comando | Descripción |
|--------|---------|-------------|
| dev | `npm run dev` | Next.js en modo desarrollo |
| build | `npm run build` | Build de producción |
| start | `npm start` | Servidor de producción |
| lint | `npm run lint` | ESLint |


---

## 13. Deploy e infraestructura

### Plataforma
- **Vercel** — Deploy automático desde repositorio Git

### Configuración (vercel.json)
- Funciones cron con maxDuration 300s
- Un cron programado: training-reminders (19:30 UTC)
- Headers de cache por ruta (logos, videos, _next/static, api, admin)
- Redirect: lozanonahuel.vercel.app → lozanonahuel.com (301)

---

## 14. Observabilidad

### Logging
- `lib/logger.ts` — Logger JSON (info, warn, error, debug) con metadata
- Uso extensivo de `console.log`, `console.error`, `console.warn`
- Logs condicionados por `NODE_ENV === 'development'` en varios endpoints

### Manejo de errores
- `pages/_error.tsx` — Página de error global
- Try/catch en endpoints API con respuestas estructuradas (success, error, details)
- `details` expuesto solo en development
- `lib/paymentErrorHandler.ts` — Errores de pagos
- `lib/securityValidation.ts` — Validación de seguridad

### Monitoreo
- No detectado: sin integración con Sentry, Datadog, etc.
- Vercel Functions Logs como fuente principal de diagnóstico.

---

## 15. Riesgos y deuda técnica

### Riesgos reales detectados

1. **Credenciales hardcodeadas en scripts**
   - `scripts/verify-liquidity-direct.js` y `scripts/clean-and-generate-consultorio-slots.js` contienen URI de MongoDB con usuario y contraseña como fallback.
   - **Acción:** Eliminar fallbacks y usar exclusivamente `process.env.MONGODB_URI`.

2. **Cron training-reminders sin token**
   - Si `CRON_SECRET` no está definido, el endpoint permite acceso sin autenticación cuando el User-Agent es cron-job.org o curl.
   - **Acción:** Exigir siempre token cuando se use en producción.

3. **Sin tests automatizados**
   - No hay archivos `*.test.*` ni `*.spec.*`.
   - **Acción:** Introducir tests mínimos para flujos críticos (auth, pagos, cron).

---


*Documento generado a partir del análisis del código del repositorio. Última revisión: febrero 2026.*
