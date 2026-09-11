import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../../db/prisma.service';

export interface SendMessageOptions {
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: object;
}

export interface TelegramApiResponse {
  ok: boolean;
  result?: { message_id?: number };
  error_code?: number;
  description?: string;
}

@Injectable()
export class TelegramApiService implements OnModuleInit {
  private readonly logger = new Logger(TelegramApiService.name);
  private botToken: string | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    await this.refreshToken();
  }

  async refreshToken() {
    try {
      const cfg = await this.prisma.telegramBotConfig.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (cfg) {
        this.botToken = this.decryptToken(cfg.botTokenEncrypted);
        return;
      }
      // Fallback: bootstrap from environment variable
      const envToken = this.config.get<string>('telegram.botToken');
      if (envToken) {
        this.botToken = envToken;
        this.logger.log('Bot token loaded from environment variable (no DB config found)');
      }
    } catch {
      // DB might not be ready; token loaded lazily
    }
  }

  // AES-256-GCM key derived from TELEGRAM_TOKEN_ENCRYPTION_KEY via SHA-256
  private get derivedKey(): Buffer {
    const key = this.config.get<string>('telegram.encryptionKey');
    if (!key || key === 'default-key-change-me-in-prod') {
      throw new Error(
        'TELEGRAM_TOKEN_ENCRYPTION_KEY must be set to a strong, unique value before storing a bot token',
      );
    }
    return createHash('sha256').update(key).digest();
  }

  private decryptToken(encrypted: string): string {
    const raw = Buffer.from(encrypted, 'base64');
    // Legacy XOR-encrypted tokens (pre-AES) are no longer supported — re-save via Superadmin UI
    if (raw.length < 12 + 16) {
      throw new Error('Stored bot token uses a legacy format — please re-enter it in Bot Sozlamalari');
    }
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.derivedKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  }

  encryptToken(raw: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.derivedKey, iv);
    const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  private get apiBase(): string | null {
    if (!this.botToken) return null;
    return `https://api.telegram.org/bot${this.botToken}`;
  }

  async sendMessage(opts: SendMessageOptions): Promise<TelegramApiResponse> {
    if (!this.apiBase) {
      await this.refreshToken();
      if (!this.apiBase) {
        return { ok: false, description: 'Bot token not configured' };
      }
    }

    const body: Record<string, unknown> = {
      chat_id: opts.chatId,
      text: opts.text,
    };
    if (opts.parseMode) body.parse_mode = opts.parseMode;
    if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;

    try {
      const resp = await fetch(`${this.apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as TelegramApiResponse;
      return json;
    } catch (e: unknown) {
      this.logger.error('sendMessage failed', e);
      return { ok: false, description: String(e) };
    }
  }

  async setWebhook(webhookUrl: string, secret?: string): Promise<TelegramApiResponse> {
    if (!this.apiBase) return { ok: false, description: 'Bot token not configured' };
    const body: Record<string, unknown> = { url: webhookUrl };
    if (secret) body.secret_token = secret;
    const resp = await fetch(`${this.apiBase}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return resp.json() as Promise<TelegramApiResponse>;
  }

  async deleteWebhook(): Promise<TelegramApiResponse> {
    if (!this.apiBase) return { ok: false, description: 'Bot token not configured' };
    const resp = await fetch(`${this.apiBase}/deleteWebhook`, { method: 'POST' });
    return resp.json() as Promise<TelegramApiResponse>;
  }

  async getMe(): Promise<TelegramApiResponse> {
    if (!this.apiBase) return { ok: false, description: 'Bot token not configured' };
    const resp = await fetch(`${this.apiBase}/getMe`);
    return resp.json() as Promise<TelegramApiResponse>;
  }
}
