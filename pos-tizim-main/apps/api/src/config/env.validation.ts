import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z.string().url('DATABASE_URL to\'g\'ri URL bo\'lishi kerak'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET kamida 16 belgi bo\'lishi kerak'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  WEB_URL: z.string().default('http://localhost:3000'),
  // Comma-separated extra origins allowed in production (WEB_URL is always allowed)
  ALLOWED_ORIGINS: z.string().optional(),
  PAYCOM_MERCHANT_ID: z.string().default(''),
  PAYCOM_RETURN_URL: z.string().default(''),
  // Telegram Bot (all optional — can also be configured via DB superadmin UI)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  TELEGRAM_WEBHOOK_BASE_URL: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  TELEGRAM_MINI_APP_URL: z.string().optional(),
  TELEGRAM_TOKEN_ENCRYPTION_KEY: z.string().min(16).optional(),
  TELEGRAM_DEFAULT_PARSE_MODE: z.enum(['HTML', 'MarkdownV2', 'NONE']).default('HTML'),
  TELEGRAM_NOTIFICATIONS_ENABLED: z
    .string()
    .transform((v) => v !== 'false' && v !== '0')
    .default('true'),
});

export function validate(config: Record<string, unknown>) {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    throw new Error('❌ Env validation xatosi:\n' + result.error.toString());
  }
  return result.data;
}
