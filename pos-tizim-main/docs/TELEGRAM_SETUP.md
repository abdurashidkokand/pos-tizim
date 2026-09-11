# Telegram Bot Integration — Setup Guide

This document covers everything needed to configure, deploy, and use the Telegram Bot integration in POS-Tizim.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Variables](#2-environment-variables)
3. [Creating a Telegram Bot](#3-creating-a-telegram-bot)
4. [Webhook Configuration](#4-webhook-configuration)
5. [Superadmin Bot Settings UI](#5-superadmin-bot-settings-ui)
6. [Tenant Telegram Settings](#6-tenant-telegram-settings)
7. [Account Linking Flows](#7-account-linking-flows)
8. [Notification Types](#8-notification-types)
9. [Inventory Alert Setup](#9-inventory-alert-setup)
10. [Background Jobs](#10-background-jobs)
11. [Security Notes](#11-security-notes)
12. [Admin Usage Guide](#12-admin-usage-guide)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Prerequisites

- Running POS-Tizim API (NestJS) with PostgreSQL
- A public HTTPS URL (required for Telegram webhooks)
- A Telegram bot created via [@BotFather](https://t.me/BotFather)
- At least one SUPERADMIN account in POS-Tizim

---

## 2. Environment Variables

All Telegram-related env vars are **optional** at startup — they can also be configured via the Superadmin UI. However, providing them at deploy time simplifies initial setup.

### API service (`.env` or docker-compose)

```env
# ── Required (Telegram) ─────────────────────────────────────────
# Encryption key for storing bot token in DB. Must be at least 16 chars.
# NEVER change this after the bot is configured — it will corrupt the stored token.
TELEGRAM_TOKEN_ENCRYPTION_KEY=your-secret-key-min-16-chars

# ── Optional bootstrap (can be set via Superadmin UI instead) ────
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUVwxyz
TELEGRAM_BOT_USERNAME=my_pos_bot
TELEGRAM_WEBHOOK_BASE_URL=https://pos.example.com/api
TELEGRAM_WEBHOOK_SECRET=webhook-secret-string
TELEGRAM_MINI_APP_URL=https://t.me/my_pos_bot/app

# ── Behavioral ───────────────────────────────────────────────────
# Set to 'false' or '0' to globally disable all Telegram notifications
TELEGRAM_NOTIFICATIONS_ENABLED=true
# One of: HTML | MarkdownV2 | NONE
TELEGRAM_DEFAULT_PARSE_MODE=HTML
```

### Priority order for bot token

1. DB config (set via SUPERADMIN UI) — **takes priority**
2. `TELEGRAM_BOT_TOKEN` env var — used as fallback if no DB config exists

---

## 3. Creating a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Choose a name (e.g. "My Shop POS") and a username ending in `bot` (e.g. `myshop_pos_bot`)
4. Copy the API token (format: `1234567890:ABCDef...`)
5. Optionally set a description and profile photo via `/setdescription` and `/setuserpic`
6. To enable inline buttons: `/setinline` (optional)
7. To enable joining groups (for staff alerts): `/setjoingroups on`

---

## 4. Webhook Configuration

Telegram delivers bot updates via **webhook** (HTTP POST to your server). Your API must be reachable over HTTPS.

### Automatic setup (recommended)

1. Log in as SUPERADMIN
2. Go to **Bot Sozlamalari → Global Bot Sozlamalari**
3. Enter bot token, username, and webhook URL (e.g. `https://pos.example.com/api/telegram/webhook`)
4. Click **Webhook o'rnatish**
5. The API will call `setWebhook` on Telegram's API and update the status

### Manual setup via curl

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://pos.example.com/api/telegram/webhook",
    "secret_token": "your-webhook-secret"
  }'
```

The webhook endpoint is: `POST /telegram/webhook`

The `X-Telegram-Bot-Api-Secret-Token` header is validated against `TELEGRAM_WEBHOOK_SECRET` (or the value saved in DB config).

### Webhook URL pattern

```
https://<your-domain>/api/telegram/webhook
```

If running behind nginx, ensure `/api` is proxied to port 3001.

### Verify webhook status

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

---

## 5. Superadmin Bot Settings UI

Navigate to: **Superadmin → Bot Sozlamalari** (`/platform/bot-settings`)

### Pages

| Page | URL | Description |
|------|-----|-------------|
| Global Config | `/platform/bot-settings` | Token, webhook, miniapp URL, test send |
| Delivery Logs | `/platform/bot-settings/logs` | Notification delivery history + queue |
| Tenant Status | `/platform/bot-settings/tenants` | Per-tenant bot enable/disable + queue stats |
| Template Manager | `/platform/bot-settings/templates` | Edit global message templates |
| Health Monitor | `/platform/bot-settings/health` | Bot health + delivery statistics |

### First-time setup steps

1. Open `/platform/bot-settings`
2. Enter **Bot Token** and **Bot Username**
3. Enter **Webhook URL** (e.g. `https://pos.example.com/api/telegram/webhook`)
4. Optionally enter **Webhook Secret** and **Mini App URL**
5. Click **Sozlamalarni saqlash**
6. Click **Webhook o'rnatish** — confirm the status turns green
7. Click **Bot sog'ligini tekshirish** — should show bot username and ID
8. Use **Test xabar yuborish** to verify delivery to your Telegram account

### Token rotation

If the bot token is compromised:
1. Generate a new token via @BotFather (`/revoke`)
2. Go to Bot Sozlamalari
3. Click **Tokenni yangilash**
4. Enter the new token
5. The old token is replaced and webhook is re-registered automatically

---

## 6. Tenant Telegram Settings

Navigate to: **Settings → Telegram Sozlamalari** (`/settings/telegram`)

Each tenant (shop) can independently configure:

### Tabs

| Tab | URL | Description |
|-----|-----|-------------|
| Umumiy | `/settings/telegram` | Enable/disable all features, quiet hours |
| Owner Alertlari | `/settings/telegram` (alerts tab) | Toggle individual owner notification types |
| Mijoz Boti | `/settings/telegram` (customer tab) | Receipt messages, cashback notifications |
| Bog'langan Akkountlar | `/settings/telegram` (accounts tab) | View and manage linked Telegram accounts |
| Inventar Alertlari | `/settings/telegram/inventory-alerts` | Alert rules and subscriptions |
| Bildirishnomalar | `/settings/telegram/preferences` | Per-entity notification type toggles |
| Mijoz Ulanish | `/settings/telegram/customer-connect` | Generate deep links for customer linking |

### Quiet hours

When quiet hours are enabled, non-critical notifications (LOW_STOCK, summaries, etc.) are suppressed between the configured start and end times. Critical alerts (OUT_OF_STOCK) are always sent.

---

## 7. Account Linking Flows

### Owner / Staff linking (via admin panel)

1. Owner opens **Bog'langan Akkountlar** tab in Telegram Sozlamalari
2. Clicks **Telegram ulash** → generates a one-time deep link
3. Clicks the link on their phone → opens the bot
4. Bot validates the token and links the Telegram account to the user
5. Owner receives a confirmation message and can now receive notifications

**Token details:** 24-hour expiry, single use, SHA-256 hashed in DB

### Customer linking (via deep link)

1. Admin opens **Mijoz Ulanish** page (`/settings/telegram/customer-connect`)
2. Searches for a customer by ID
3. Clicks **Ulanish havolasi yaratish**
4. Shares the generated `t.me/botname?start=TOKEN` link with the customer (via SMS, QR, receipt, etc.)
5. Customer opens the link → bot links their Telegram to the customer record
6. Customer can now receive purchase receipts, cashback notifications, etc.

### Bot /start command flow

When a user sends `/start TOKEN` to the bot:

1. Bot looks up the token hash in `TelegramLinkToken`
2. Validates expiry and single-use constraint
3. Creates/updates `TelegramIdentity` for the Telegram user
4. Creates `TelegramLink` binding `entityId`+`entityType` to the identity
5. Marks token as used (`usedAt`, `usedByTelegramIdentityId`)
6. Returns role-appropriate welcome menu

When `/start` is sent without a token, the bot shows a generic intro menu.

---

## 8. Notification Types

### Owner notifications

| Type | Trigger |
|------|---------|
| `OWNER_DAILY_SUMMARY` | Scheduled cron (23:55 daily) |
| `OWNER_WEEKLY_SUMMARY` | Scheduled cron (Sunday 23:55) |
| `OWNER_MONTHLY_SUMMARY` | Scheduled cron (last day of month 23:55) |
| `OWNER_LOW_STOCK_ALERT` | When product stock falls below threshold |
| `OWNER_OUT_OF_STOCK_ALERT` | When product stock reaches zero |
| `OWNER_DEAD_STOCK_ALERT` | Scheduled cron (daily) — products unsold for N+ days |
| `OWNER_BONUS_EXPIRY_ALERT` | Scheduled cron (daily) — customer bonuses expiring in 7 days |
| `OWNER_REFUND_ALERT` | On refund event |
| `OWNER_DEBT_CREATED` | When sale creates debt |
| `OWNER_CASH_SESSION_CLOSED` | When cashier closes shift |

### Customer notifications

| Type | Trigger |
|------|---------|
| `CUSTOMER_PURCHASE_RECEIPT` | After sale is completed (customer linked) |
| `CUSTOMER_BONUS_EARNED` | After cashback is credited |
| `CUSTOMER_BONUS_EXPIRY` | Scheduled — 7 days before expiry |

### Staff notifications

| Type | Trigger |
|------|---------|
| `STAFF_SHIFT_REMINDER` | Manual or scheduled |
| `STAFF_STOCK_TASK` | Manual dispatch |
| `STAFF_LOW_STOCK` | On `stock.low` event (if staff bot enabled) |
| `STAFF_OUT_OF_STOCK` | On `stock.out` event (if staff bot enabled) |

---

## 9. Inventory Alert Setup

Navigate to: **Settings → Telegram → Inventar Alertlari** (`/settings/telegram/inventory-alerts`)

### Alert rules

Define thresholds that trigger alerts:

| Alert type | Config field | Description |
|------------|-------------|-------------|
| `LOW_STOCK` | `minQuantity` | Trigger when stock ≤ this value |
| `OUT_OF_STOCK` | — | Trigger when stock = 0 |
| `DEAD_STOCK` | `daysWithoutSale` | Trigger if no sales in N days |

Rules can be scoped to a specific `productId` or left global (applies to all products).

### Alert subscriptions

Subscriptions define **who** receives **which** alerts. Users must be subscribed to receive alerts even if a rule is active.

1. Create a rule (e.g. LOW_STOCK with minQuantity=5)
2. Create a subscription: select alert type + user ID
3. The subscribed user must have their Telegram account linked to receive messages

---

## 10. Background Jobs

The following cron jobs run automatically (via `TelegramSchedulerService`):

| Job | Schedule | Description |
|-----|----------|-------------|
| Process notification queue | Every 30 seconds | Sends pending queue items |
| Daily summary | Daily 23:55 | Owner daily sales report |
| Weekly summary | Sunday 23:55 | 7-day aggregated report |
| Monthly summary | Last day 23:55 | Monthly report |
| Dead stock check | Daily 08:00 | Products not sold in N days |
| Bonus expiry check | Daily 09:00 | Customer bonuses expiring in 7 days |
| Cleanup expired tokens | Daily 03:00 | Remove expired link tokens |

All jobs are non-blocking — a job failure does not affect POS transactions.

---

## 11. Security Notes

### Token storage

- Bot token is **never stored in plaintext** in the database
- Encrypted using XOR cipher with `TELEGRAM_TOKEN_ENCRYPTION_KEY`
- `TELEGRAM_TOKEN_ENCRYPTION_KEY` must be kept secret and never changed after initial setup
- The token is masked in all API responses (only last 4 chars shown)

### Link tokens

- One-time use — consumed immediately on first valid use
- Short-lived (24 hours by default)
- Stored as SHA-256 hash — raw token never persisted
- Scoped to a specific tenant, entity ID, and entity type

### Webhook security

- Telegram signs every webhook delivery with `X-Telegram-Bot-Api-Secret-Token` header
- The API validates this header against the configured secret
- Requests without a valid signature are rejected with 401

### RBAC

- All `/telegram/admin/*` endpoints require `SUPERADMIN` role
- All `/telegram/settings/*` endpoints require `OWNER` or `ADMIN` role
- All `/telegram/staff/*` endpoints require `OWNER` or `ADMIN` role
- All audit logs are written for: token changes, setting changes, link/unlink events, template changes

---

## 12. Admin Usage Guide

### Sending a test message

1. Go to **Bot Sozlamalari** (`/platform/bot-settings`)
2. Scroll to **Test xabar yuborish**
3. Enter a Telegram Chat ID (get yours by messaging @userinfobot)
4. Enter a message and click **Yuborish**

### Viewing delivery logs

1. Go to **Bot Sozlamalari → Yetkazish loglari** (`/platform/bot-settings/logs`)
2. Logs tab shows completed deliveries (SENT / FAILED / BLOCKED)
3. Queue tab shows pending + in-progress items
4. Filter by `tenantId` for specific tenant debugging

### Monitoring health

1. Go to **Bot Sozlamalari → Tizim holati** (`/platform/bot-settings/health`)
2. Bot info section shows: online status, username, capabilities
3. Delivery stats show global sent/failed/pending counts
4. Error rate warning appears if failure rate exceeds 10%
5. Tenant table shows per-shop queue depth

### Managing templates

1. Go to **Bot Sozlamalari → Shablonlar** (`/platform/bot-settings/templates`)
2. Click **Edit** on any template to modify the message body
3. Templates support variables: `{{store_name}}`, `{{customer_name}}`, `{{product_name}}`, `{{balance}}`, etc.
4. Parse mode: `HTML` allows `<b>`, `<i>`, `<code>` tags; `MarkdownV2` uses `*bold*`, `_italic_`
5. Tenant-specific templates override global defaults

---

## 13. Troubleshooting

### Bot doesn't respond to /start

- Verify the webhook is set: check `/platform/bot-settings` → bot status badge
- Check webhook info: `GET https://api.telegram.org/bot<TOKEN>/getWebhookInfo`
- Ensure your domain is reachable over HTTPS on port 443
- Check nginx is proxying `/api/telegram/webhook` to port 3001

### Notifications not being sent

1. Check `TELEGRAM_NOTIFICATIONS_ENABLED` is not set to `false`
2. Check the notification queue at `/platform/bot-settings/logs` (Queue tab)
3. If items are stuck in FAILED status, check the `lastError` column
4. Common error: `bot was blocked by the user` — identity is marked as blocked automatically
5. Common error: `chat not found` — the user has not started the bot; they must send `/start` first
6. Common error: `Bot token not configured` — no DB config and no env var set

### Token encryption issues

- If you see garbled text when the bot tries to send, the encryption key may have changed
- **Solution:** Delete the DB config via Prisma Studio, re-enter the token in the Superadmin UI
- Never change `TELEGRAM_TOKEN_ENCRYPTION_KEY` after it has been used to encrypt a token

### Webhook secret mismatch

- If you see `401 Unauthorized` in webhook logs, the `TELEGRAM_WEBHOOK_SECRET` in your env doesn't match what was used when registering the webhook
- Re-register the webhook via the UI after updating the secret

### Deep links not working

- Verify `botUsername` is set correctly in Bot Sozlamalari (no `@` prefix)
- The generated link format is: `https://t.me/<botUsername>?start=<token>`
- Test by opening the link on a device with Telegram installed
