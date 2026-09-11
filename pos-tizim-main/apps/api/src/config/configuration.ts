export default () => ({
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  webUrl: process.env.WEB_URL || 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  paycom: {
    merchantId: process.env.PAYCOM_MERCHANT_ID || '',
    returnUrl: process.env.PAYCOM_RETURN_URL || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    botUsername: process.env.TELEGRAM_BOT_USERNAME,
    webhookBaseUrl: process.env.TELEGRAM_WEBHOOK_BASE_URL,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET,
    miniAppUrl: process.env.TELEGRAM_MINI_APP_URL,
    encryptionKey: process.env.TELEGRAM_TOKEN_ENCRYPTION_KEY ?? 'default-key-change-me-in-prod',
    defaultParseMode: (process.env.TELEGRAM_DEFAULT_PARSE_MODE ?? 'HTML') as 'HTML' | 'MarkdownV2' | 'NONE',
    notificationsEnabled: process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'false' && process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== '0',
  },
});
