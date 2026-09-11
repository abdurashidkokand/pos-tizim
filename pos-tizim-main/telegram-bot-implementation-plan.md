# Telegram Bot Integration Implementation Plan for `abdurashidkokand/pos-tizim`

## Goal

Integrate a full Telegram Bot layer into the existing POS system as a first-class product module, without replacing the existing web POS / mini app flows.

This implementation must support:

- **Owner / Manager notifications**
- **Customer loyalty / cashback / nakopitel card interactions**
- **Staff utility notifications**
- **Telegram account linking**
- **Mini App deep-link launching**
- **Inventory alerts**
- **Sales / debt / refund / session notifications**
- **Superadmin bot configuration panel**
- **Per-tenant bot settings**
- **Global bot token / username management**
- **Notification template and preference management**

This plan is for implementation by an agent, so it is intentionally structured and execution-oriented.

---

# 1. Product Model

The Telegram Bot should act as a **communication + automation + self-service layer** on top of the POS.

## Existing system remains source of truth
- POS sales, customers, stock, cash sessions, reports, users, RBAC, etc. remain in the existing system.
- Telegram Bot reads from and reacts to system events.
- Telegram Bot may trigger lightweight actions, but should not replace heavy admin CRUD UI.

## Bot user groups
Implement bot behavior for 4 actor types:

1. **SUPERADMIN**
   - global bot setup
   - token / username / webhook settings
   - template defaults
   - feature gating
   - tenant bot health monitoring

2. **OWNER / MANAGER**
   - real-time alerts
   - daily/weekly/monthly reports
   - low stock / debt / refund / cashier activity summaries
   - quick navigation to mini app/web sections

3. **STAFF / CASHIER / WAREHOUSE STAFF**
   - limited operational notifications
   - shift reminders
   - stock task reminders
   - assigned alerts only

4. **CUSTOMER**
   - loyalty balance
   - cashback / bonus history
   - nakopitel card progress
   - post-purchase messages
   - promo messages
   - receipt links
   - mini app launch

---

# 2. High-Level Architecture

## New bounded areas to add
Create the following logical modules:

1. **Telegram Core Module**
2. **Telegram Linking Module**
3. **Telegram Notifications Module**
4. **Telegram Templates Module**
5. **Telegram Customer Bot Module**
6. **Telegram Owner Alerts Module**
7. **Telegram Staff Notifications Module**
8. **Telegram Settings Module**
9. **Superadmin Bot Settings Module**
10. **Event Dispatcher / Domain Events Module**

## Recommended backend architecture
Use an event-driven design.

### Pattern
- Existing business actions occur normally:
  - sale created
  - stock adjusted
  - debt created
  - debt repaid
  - cash session opened/closed
  - refund created
  - loyalty transaction added
- These emit internal domain events
- A Telegram notification orchestrator consumes them
- Notification orchestrator resolves:
  - recipients
  - preferences
  - templates
  - channel availability
  - throttling / deduplication
- Then it sends messages via Telegram Bot API

## Required delivery behavior
- Retry failed sends
- Mark blocked/unreachable chats
- Persist delivery logs
- Never block core POS transaction flow because Telegram failed

---

# 3. Database / Data Model Plan

Add the following models / fields.

## 3.1 Global bot configuration
Create a model for global Telegram bot settings controlled by SUPERADMIN.

### TelegramBotConfig
Fields:
- id
- name
- botTokenEncrypted
- botUsername
- webhookUrl
- webhookSecret
- miniAppUrl
- isActive
- status
- lastWebhookSetAt
- lastHealthCheckAt
- createdAt
- updatedAt
- createdByUserId
- updatedByUserId

Notes:
- Bot token must be encrypted at rest
- Only superadmin can view masked token and rotate it
- Full raw token should never be returned after save
- Username should be stored separately for deep-link generation
- Support future multi-bot possibility even if currently one active bot is used

## 3.2 Per-tenant bot settings
Create per-tenant settings.

### TelegramTenantSettings
Fields:
- id
- tenantId
- enabled
- useGlobalBotConfig
- customBotConfigId nullable
- ownerNotificationsEnabled
- customerBotEnabled
- staffBotEnabled
- miniAppEnabled
- deepLinkBaseUrl nullable
- defaultLanguage
- quietHoursEnabled
- quietHoursStart
- quietHoursEnd
- createdAt
- updatedAt

Notes:
- allow tenant-level bot behavior customization
- initial version may use only global bot config, but schema should support tenant-level custom bot later

## 3.3 Telegram identities / linking
Add Telegram linkage models.

### TelegramIdentity
Fields:
- id
- tenantId nullable for customer/staff multi-tenant logic if needed
- telegramUserId
- telegramChatId
- telegramUsername nullable
- firstName nullable
- lastName nullable
- languageCode nullable
- isBot
- linkedAt
- lastSeenAt
- isActive
- isBlocked
- blockedAt nullable
- lastDeliveryStatus nullable
- createdAt
- updatedAt

### TelegramLink
Fields:
- id
- tenantId
- telegramIdentityId
- entityType enum:
  - USER
  - CUSTOMER
  - OWNER
  - STAFF
- entityId
- linkSource enum:
  - TOKEN
  - QR
  - PHONE_OTP
  - RECEIPT
  - MANUAL_ADMIN
- verified
- linkedByUserId nullable
- createdAt
- updatedAt

## 3.4 One-time linking tokens
### TelegramLinkToken
Fields:
- id
- tenantId
- tokenHash
- entityType
- entityId
- intendedRole
- expiresAt
- usedAt nullable
- usedByTelegramIdentityId nullable
- createdByUserId
- createdAt

Notes:
- store only token hash
- tokens must be one-time use
- short expiry

## 3.5 Notification preferences
### TelegramNotificationPreference
Fields:
- id
- tenantId
- entityType enum:
  - USER
  - CUSTOMER
- entityId
- telegramIdentityId nullable
- notificationType
- enabled
- deliveryMode enum:
  - INSTANT
  - DIGEST
  - OFF
- language nullable
- quietHoursOverride nullable
- createdAt
- updatedAt

## 3.6 Notification templates
### TelegramMessageTemplate
Fields:
- id
- tenantId nullable for global template
- code
- audience enum:
  - OWNER
  - CUSTOMER
  - STAFF
  - SUPERADMIN
- language
- titleTemplate nullable
- bodyTemplate
- parseMode enum:
  - NONE
  - HTML
  - MARKDOWNV2
- inlineKeyboardJson nullable
- isDefault
- isActive
- createdAt
- updatedAt

## 3.7 Notification logs
### TelegramNotificationLog
Fields:
- id
- tenantId
- telegramIdentityId
- notificationType
- audience
- sourceEntityType nullable
- sourceEntityId nullable
- templateCode nullable
- payloadJson
- messageTextSnapshot
- telegramMessageId nullable
- status enum:
  - PENDING
  - SENT
  - FAILED
  - BLOCKED
  - SKIPPED
- errorCode nullable
- errorMessage nullable
- retryCount
- sentAt nullable
- createdAt
- updatedAt

## 3.8 Digest / queue table
### TelegramNotificationQueue
Fields:
- id
- tenantId
- notificationType
- audience
- telegramIdentityId
- payloadJson
- scheduledFor
- dedupeKey nullable
- priority enum:
  - LOW
  - NORMAL
  - HIGH
  - CRITICAL
- status enum:
  - PENDING
  - PROCESSING
  - SENT
  - FAILED
  - CANCELLED
- retryCount
- lastError nullable
- createdAt
- updatedAt

## 3.9 Customer loyalty / nakopitel support
If not already fully implemented, extend loyalty models.

### Customer additions
Add fields if missing:
- telegramLinked boolean default false
- telegramIdentityId nullable
- preferredLanguage nullable
- marketingOptIn boolean
- loyaltyTier nullable

### Loyalty models recommended
- LoyaltyAccount
- LoyaltyTransaction
- LoyaltyRule
- StampCardProgram
- StampCardProgress
- RewardRedemption
- CustomerPromoAssignment

## 3.10 Inventory alert config
### InventoryAlertRule
Fields:
- id
- tenantId
- branchId nullable
- categoryId nullable
- productId nullable
- alertType enum:
  - LOW_STOCK
  - OUT_OF_STOCK
  - FAST_MOVING
  - DEAD_STOCK
  - OVERSTOCK
  - EXPIRY_SOON
  - INVENTORY_MISMATCH
- minQuantity nullable
- daysWithoutSale nullable
- velocityWindowDays nullable
- enabled
- createdAt
- updatedAt

### InventoryAlertSubscription
Fields:
- id
- tenantId
- userId
- telegramIdentityId nullable
- alertType
- branchId nullable
- enabled
- createdAt
- updatedAt

---

# 4. RBAC / Authorization Plan

## Roles allowed
- **SUPERADMIN**
  - full Telegram global configuration
  - global templates
  - view delivery health
  - rotate token
  - configure webhook
  - see tenant-level bot status

- **OWNER / ADMIN**
  - tenant Telegram settings
  - link owner account
  - configure alerts
  - configure customer notification defaults
  - configure mini app launch texts
  - manage inventory alert subscriptions

- **MANAGER**
  - view settings
  - manage some tenant-level notification preferences if desired
  - no access to bot token or webhook secret

- **CASHIER / STAFF**
  - can link own Telegram account
  - can set own notification preferences
  - no system-wide config

- **CUSTOMER**
  - no admin panel access
  - bot interactions only

---

# 5. Admin / Frontend UI Plan

Add new menus to the existing admin panel.

## 5.1 SUPERADMIN menus
Add a new top-level menu group:

### Bot Sozlamalari
This must exist as a SUPERADMIN-only menu group.

Submenus:

1. **Global Bot Sozlamalari**
2. **Webhook va Health**
3. **Template Manager**
4. **Delivery Loglari**
5. **Tenant Bot Holati**
6. **Deep Link Generator**
7. **Test Xabar Yuborish**

### Global Bot Sozlamalari page
Fields:
- Bot enabled switch
- Bot token input
- Bot username input
- Webhook URL input
- Webhook secret input
- Mini App URL input
- Active status badge
- Last webhook setup timestamp
- Last health check status
- Rotate token action
- Send test message action

Important:
- token display must be masked after save
- username validation should be present
- webhook test / verify action required

## 5.2 Tenant-level menus
Add a tenant-facing menu:

### Telegram Sozlamalari
Visible to OWNER / ADMIN, maybe MANAGER read-only.

Submenus:
1. Umumiy Sozlamalar
2. Owner Alertlari
3. Mijoz Boti
4. Xodim Bildirishnomalari
5. Ombor Alertlari
6. Template Override
7. Bog‘langan Akkountlar
8. Notification Preference

### Umumiy Sozlamalar
Fields:
- Telegram integration enabled
- Customer bot enabled
- Staff bot enabled
- Owner alerts enabled
- Mini App launch enabled
- Default language
- Quiet hours
- Deep link preview
- Bot username preview from global config

### Owner Alertlari
Switches for:
- daily summary
- weekly summary
- monthly summary
- low stock alert
- out of stock alert
- refund alert
- debt alert
- cash session open/close alert
- large discount alert
- suspicious inventory adjustment alert

### Mijoz Boti
Switches and settings:
- receipt message after purchase
- cashback notification
- bonus expiry reminder
- nakopitel progress updates
- promo campaigns enabled
- birthday rewards enabled
- reactivation messages enabled

### Xodim Bildirishnomalari
- shift reminders
- stock tasks
- assigned alerts
- branch-level alert scope

### Ombor Alertlari
- low stock threshold defaults
- dead stock day window
- fast-moving sensitivity
- alert severity routing
- subscribed owner/staff accounts

### Bog‘langan Akkountlar
Lists all linked telegram accounts:
- linked users
- linked owners
- linked staff
- linked customers count
- link status
- unlink action
- re-link action
- test send action

## 5.3 Customer-facing Mini App entry
Optional UI pages:
- customer QR / telegram link
- loyalty card page
- bot connect page
- “Open in Telegram” deep link CTA

---

# 6. Backend Modules and Responsibilities

## 6.1 TelegramCoreModule
Responsibilities:
- Telegram API client wrapper
- sendMessage
- sendPhoto
- editMessage
- answerCallbackQuery
- webhook signature validation if applicable
- retry handling
- bot config resolution

## 6.2 TelegramSettingsModule
Responsibilities:
- CRUD for global and tenant settings
- masked token handling
- validation
- bot health checks
- webhook registration endpoint

## 6.3 TelegramLinkingModule
Responsibilities:
- generate link token
- consume link token
- link telegram identity to user/customer/staff
- unlink
- re-link
- phone/OTP flow if later added

## 6.4 TelegramNotificationModule
Responsibilities:
- create notification jobs
- resolve recipients
- apply quiet hours
- apply templates
- queue or instant delivery
- log results
- dedupe

## 6.5 TelegramTemplateModule
Responsibilities:
- template storage
- global defaults
- tenant overrides
- preview rendering
- variable validation

## 6.6 TelegramOwnerAlertsModule
Responsibilities:
- owner/manager-specific digests and alerts
- daily summary
- weekly summary
- monthly summary
- inventory alerts
- refund alerts
- debt alerts

## 6.7 TelegramCustomerBotModule
Responsibilities:
- /start flow for customers
- main customer menu
- loyalty balance
- stamp card progress
- receipt notification orchestration
- promo notifications
- bonus expiry reminders

## 6.8 TelegramStaffModule
Responsibilities:
- staff linking
- shift reminders
- assigned stock alerts
- operational notices

## 6.9 DomainEventModule
Responsibilities:
- internal event bus abstraction
- event publishing from existing modules
- event handlers for telegram

---

# 7. Required Domain Events

Add event publishing from existing business flows.

## Sales
Emit:
- `sale.created`
- `sale.completed`
- `sale.discount.applied`
- `sale.debt.created`
- `sale.payment.mixed`
- `sale.refund.created` (future if return/refund module exists)

Payload should include:
- tenantId
- branchId
- saleId
- receiptNo
- cashierId
- customerId nullable
- totals
- payment types
- discount
- createdAt

## Inventory
Emit:
- `stock.adjusted`
- `stock.low`
- `stock.out`
- `stock.fast_moving`
- `stock.dead`
- `stock.mismatch_detected`

## Cash Session
Emit:
- `cash_session.opened`
- `cash_session.closed`
- `cash_session.variance_detected`

## Debt
Emit:
- `debt.created`
- `debt.partial_paid`
- `debt.fully_paid`
- `debt.overdue`

## Loyalty
Emit:
- `loyalty.earned`
- `loyalty.redeemed`
- `stamp_card.progressed`
- `stamp_card.completed`
- `bonus.expiring_soon`

## User / link lifecycle
Emit:
- `telegram.link.created`
- `telegram.link.removed`
- `telegram.delivery.blocked`

---

# 8. Telegram Bot Functional Flows

## 8.1 /start flow
Behavior:
- identify telegram user
- create/update TelegramIdentity
- parse deep-link payload
- if payload is a link token:
  - validate token
  - link account
  - return success menu
- if no payload:
  - show role-neutral intro screen
  - offer:
    - Mini App ochish
    - Akkount ulash
    - Mening bonuslarim
    - Yordam

## 8.2 Owner linking flow
Via admin panel:
- owner clicks “Telegram account ulash”
- backend creates one-time token
- deep-link generated using bot username
- owner opens bot via link
- bot consumes token and links TelegramIdentity to user
- owner receives success + owner menu

## 8.3 Customer linking flow
Possible options:
- from receipt QR
- from mini app customer cabinet
- from phone verification flow
- from cashback/nakopitel promo page

After linking:
- bot shows:
  - bonus balance
  - stamp progress
  - latest receipts
  - promos

## 8.4 Callback button menu patterns
Use inline keyboards heavily.

Owner menu:
- Bugungi tushum
- Ombor ogohlantirishlari
- Qarzlar
- Sessiyalar
- Mini App ochish
- Sozlamalar

Customer menu:
- Bonuslarim
- Kartam
- Xaridlarim
- Aksiyalar
- Mini App

Staff menu:
- Smena
- Vazifalar
- Ombor alertlari
- Mini App

## 8.5 Post-sale customer message flow
When sale completed and customer linked:
- send receipt summary
- send bonus/cashback delta
- send current balance
- send stamp progress if relevant
- optionally suggest next reward

## 8.6 Low stock owner alert flow
When stock threshold crossed:
- send alert to subscribed owner/manager accounts
- include:
  - product
  - current stock
  - branch
  - recent sales velocity if available
- inline actions:
  - Mini App ochish
  - Mahsulotni ko‘rish
  - Alertni o‘chirish
  - Buyurtma tavsiyasi

---

# 9. Notification Types to Implement

## Owner notifications
Implement these notification types:

- OWNER_DAILY_SUMMARY
- OWNER_WEEKLY_SUMMARY
- OWNER_MONTHLY_SUMMARY
- OWNER_LOW_STOCK_ALERT
- OWNER_OUT_OF_STOCK_ALERT
- OWNER_FAST_MOVING_ALERT
- OWNER_DEAD_STOCK_ALERT
- OWNER_REFUND_ALERT
- OWNER_DEBT_CREATED_ALERT
- OWNER_DEBT_OVERDUE_ALERT
- OWNER_DEBT_PAID_ALERT
- OWNER_CASH_SESSION_OPENED
- OWNER_CASH_SESSION_CLOSED
- OWNER_CASH_VARIANCE_ALERT
- OWNER_LARGE_DISCOUNT_ALERT
- OWNER_INVENTORY_MISMATCH_ALERT

## Customer notifications
- CUSTOMER_LINK_SUCCESS
- CUSTOMER_PURCHASE_RECEIPT
- CUSTOMER_BONUS_EARNED
- CUSTOMER_BONUS_REDEEMED
- CUSTOMER_BONUS_EXPIRING
- CUSTOMER_STAMP_PROGRESS
- CUSTOMER_STAMP_COMPLETED
- CUSTOMER_BIRTHDAY_REWARD
- CUSTOMER_PROMO_ASSIGNED
- CUSTOMER_REACTIVATION_PROMO

## Staff notifications
- STAFF_SHIFT_REMINDER
- STAFF_STOCK_TASK
- STAFF_LOW_STOCK_ASSIGNMENT
- STAFF_BRANCH_NOTICE

## System / superadmin notifications
- SUPERADMIN_BOT_HEALTH_FAILED
- SUPERADMIN_WEBHOOK_FAILED
- SUPERADMIN_DELIVERY_ERROR_SPIKE
- SUPERADMIN_BOT_TOKEN_ROTATED

---

# 10. Superadmin Bot Settings Requirements

This is mandatory per user request.

Implement a **SUPERADMIN menu section called “Bot Sozlamalari”**.

## Required capabilities
Superadmin must be able to:

1. Save / update Telegram bot API token
2. Save / update bot username
3. Save / update mini app URL
4. Save / update webhook URL
5. Save / update webhook secret
6. Test webhook registration
7. See current bot health
8. Send test message to linked account
9. Rotate token securely
10. Enable / disable Telegram integration globally
11. View per-tenant usage and linked-account counts
12. Manage global templates

## Security requirements
- token must be encrypted in DB
- token must never be shown in full after save
- audit log all token changes
- require elevated confirmation to rotate token
- if token changes, webhook should be revalidated
- prevent non-superadmin from reading these settings

---

# 11. Suggested API Endpoints

Add REST endpoints approximately like below.

## Superadmin config
- `GET /telegram/admin/config`
- `PUT /telegram/admin/config`
- `POST /telegram/admin/config/test`
- `POST /telegram/admin/config/webhook/set`
- `POST /telegram/admin/config/webhook/delete`
- `POST /telegram/admin/config/token/rotate`
- `GET /telegram/admin/health`
- `GET /telegram/admin/tenants`

## Tenant settings
- `GET /telegram/settings`
- `PUT /telegram/settings`
- `GET /telegram/settings/alerts`
- `PUT /telegram/settings/alerts`
- `GET /telegram/settings/customer-bot`
- `PUT /telegram/settings/customer-bot`

## Linking
- `POST /telegram/link-token`
- `POST /telegram/link/unlink`
- `GET /telegram/linked-accounts`
- `POST /telegram/linked-accounts/:id/test`
- `POST /telegram/webhook`

## Templates
- `GET /telegram/templates`
- `POST /telegram/templates`
- `PUT /telegram/templates/:id`
- `POST /telegram/templates/:id/preview`

## Logs / queue
- `GET /telegram/notifications/logs`
- `GET /telegram/notifications/queue`

## Customer interactions
- `GET /telegram/customer/me`
- `GET /telegram/customer/loyalty`
- `GET /telegram/customer/receipts`

---

# 12. Frontend Pages to Add

Recommended pages under admin panel.

## SUPERADMIN pages
- `/superadmin/bot-settings`
- `/superadmin/bot-settings/templates`
- `/superadmin/bot-settings/logs`
- `/superadmin/bot-settings/tenants`
- `/superadmin/bot-settings/health`

## Tenant/admin pages
- `/telegram/settings`
- `/telegram/settings/owners`
- `/telegram/settings/customers`
- `/telegram/settings/staff`
- `/telegram/settings/inventory-alerts`
- `/telegram/settings/linked-accounts`

## Suggested component sections
- Bot status card
- Token masked input card
- Username card
- Webhook status card
- Mini app deep-link preview
- Notification toggles grid
- Linked account table
- Test-send modal
- Template editor / preview
- Delivery log table
- Quiet hours config
- Inventory alert threshold config

---

# 13. Message Template Strategy

Templates must not be hardcoded everywhere.

Use template codes and variable interpolation.

## Example owner template codes
- `owner.daily_summary`
- `owner.low_stock`
- `owner.refund_alert`
- `owner.debt_created`

## Example customer template codes
- `customer.link_success`
- `customer.purchase_receipt`
- `customer.bonus_earned`
- `customer.stamp_progress`

## Example variables
- `{{store_name}}`
- `{{branch_name}}`
- `{{customer_name}}`
- `{{receipt_no}}`
- `{{sale_total}}`
- `{{bonus_earned}}`
- `{{bonus_balance}}`
- `{{stamp_progress}}`
- `{{product_name}}`
- `{{stock_qty}}`

Support:
- global default templates
- per-tenant override
- Uzbek primary, future multilingual support

---

# 14. Inventory Alerts Plan

## Minimum implementation
Implement:
- LOW_STOCK
- OUT_OF_STOCK
- DEAD_STOCK

## Second step
Implement:
- FAST_MOVING
- OVERSTOCK
- MISMATCH

## Logic recommendations
LOW_STOCK:
- trigger when stock falls to configured threshold or below

OUT_OF_STOCK:
- trigger at zero

DEAD_STOCK:
- scheduled job checks no sales in N days and stock > 0

FAST_MOVING:
- compare recent sales velocity against configurable baseline

MISMATCH:
- detect frequent manual adjustments or reconciliation gaps

## Alert routing
- owner accounts receive default
- subscribed staff may also receive selected categories/branches

---

# 15. Loyalty / Nakopitel Plan

If customer bot is being implemented, add or finish these capabilities.

## Must-have loyalty functionality
- customer balance lookup
- cashback earned notifications
- bonus expiry reminders
- stamp card progress notifications
- reward redemption notifications

## Suggested loyalty mechanics
1. Spend-based cashback
2. Visit-based stamp card
3. Category-specific campaign card
4. Birthday bonus
5. Inactive customer reactivation offer

## Telegram-specific UX
- customer receives instant update after eligible sale
- progress and next reward should be explicit
- include CTA button to open mini app / show QR / claim reward

---

# 16. Background Jobs / Scheduling

Add background workers / cron jobs for:

- send queued notifications
- retry failed sends
- compile daily digests
- compile weekly digests
- compile monthly digests
- detect dead stock
- detect bonus expiry
- detect overdue debts
- run bot health checks
- cleanup expired link tokens

These jobs should be isolated from request-response lifecycle.

---

# 17. Reliability / Error Handling

Implement safely.

## Requirements
- POS sale creation must not fail if bot send fails
- all sends should be queued or wrapped in resilient async handling
- handle Telegram blocked-user responses gracefully
- mark identity blocked on known error responses
- retry only retryable failures
- deduplicate repeated alerts
- protect against notification storms

## Dedupe examples
- if low stock already sent in last X hours, do not spam repeatedly
- if daily digest sent, do not resend
- if webhook duplicate update received, handle idempotently

---

# 18. Security Requirements

## Sensitive data
- encrypt bot token
- hash one-time link tokens
- never log raw token
- do not expose secrets to frontend
- role-check every admin endpoint

## Linking safety
- short-lived tokens
- one-time use
- tenant-bound
- intended-role aware
- audit log link/unlink actions

## Message actions
Be careful with callback actions.
- Use signed callback payloads or resolvable callback IDs
- Never trust raw client-side callback data blindly

---

# 19. Audit Logging Requirements

Audit these actions:
- bot token created/updated/rotated
- bot username changed
- webhook changed
- tenant bot settings changed
- notification preference changed
- link created
- link removed
- template changed
- test message sent by admin
- alert rule changed

---

# 20. Suggested Rollout Phases

## Phase 1 — Foundation
Implement:
- global bot config
- superadmin bot settings UI
- webhook endpoint
- telegram identity/linking
- owner account linking
- owner daily summary
- owner low stock alert
- tenant telegram settings
- test message feature

## Phase 2 — Customer bot
Implement:
- customer account linking
- customer main menu
- purchase receipt notifications
- bonus/cashback notifications
- stamp progress notifications
- customer mini app entry

## Phase 3 — Staff + advanced alerts
Implement:
- staff linking
- shift reminders
- out-of-stock / dead-stock alerts
- debt alerts
- cash session alerts
- refund alerts

## Phase 4 — Templates / digests / analytics
Implement:
- template manager
- weekly/monthly digests
- dead stock recommendations
- fast-moving alerts
- notification logs/queue UI

---

# 21. Definition of Done

Implementation is considered complete when all of the following are true:

1. SUPERADMIN can open **Bot Sozlamalari** menu
2. SUPERADMIN can save Telegram bot token and username securely
3. SUPERADMIN can configure webhook and mini app URL
4. Owner can generate a Telegram linking token from admin UI
5. Owner can link Telegram account successfully
6. System can send test Telegram message
7. Sale / inventory / debt events can enqueue bot notifications
8. Low stock alerts can be delivered to owner
9. Daily owner summary can be generated and delivered
10. Customer can link Telegram account
11. Customer can receive purchase receipt / bonus message
12. Notification logs are persisted
13. Failed sends do not break POS transactions
14. All admin actions are RBAC-protected and audited

---

# 22. Important Implementation Constraints

- Keep bot logic modular
- Do not bury Telegram calls directly inside every business service
- Use a dispatcher/orchestrator layer
- Prefer template-driven messages
- Prefer event-driven notifications
- Keep Telegram failures non-blocking
- Build for future multi-tenant, multi-bot possibility even if starting with one global bot
- Reuse existing RBAC and tenant scoping patterns already present in the repo

---

# 23. Concrete Deliverables Expected from the Agent

The coding agent should implement the following categories of changes:

## Backend
- DB schema changes + migrations
- Telegram modules/services/controllers
- webhook receiver
- settings APIs
- linking APIs
- notification queue/logging
- event handlers
- scheduled jobs
- encryption utilities for bot token
- audit integration

## Frontend
- SUPERADMIN “Bot Sozlamalari” menus and pages
- tenant “Telegram Sozlamalari” pages
- linked accounts management UI
- template management UI
- notification settings UI
- test-send UI
- deep-link generation UI

## Integration
- domain event publishing from sales / stock / debt / cash session flows
- low stock alert engine
- owner digest engine
- customer receipt notification flow

## Documentation
- setup instructions
- env variables
- webhook setup guide
- bot linking flow documentation
- admin usage notes

---

# 24. Environment Variables to Support

Expected env support:
- TELEGRAM_BOT_TOKEN optional if using DB-stored config bootstrap
- TELEGRAM_BOT_USERNAME optional bootstrap
- TELEGRAM_WEBHOOK_BASE_URL
- TELEGRAM_WEBHOOK_SECRET
- TELEGRAM_MINI_APP_URL
- TELEGRAM_TOKEN_ENCRYPTION_KEY
- TELEGRAM_DEFAULT_PARSE_MODE
- TELEGRAM_NOTIFICATIONS_ENABLED

Note:
Even if token is stored in DB through SUPERADMIN settings, bootstrap env support is still useful.

---

# 25. Final Instruction to the Implementing Agent

Implement Telegram Bot integration as an enterprise-grade extension of the current POS system.

Prioritize:
1. secure bot config management in **SUPERADMIN > Bot Sozlamalari**
2. Telegram account linking
3. owner notifications
4. low-stock alerts
5. customer purchase / loyalty messaging
6. notification logging and reliability

Do not reduce this to a simple `/start` bot only.
This must be implemented as a maintainable product module integrated with the existing tenant/RBAC/admin architecture.

If tradeoffs are needed:
- choose reliability over chat feature richness
- choose modularity over shortcuts
- choose admin configurability over hardcoding
- choose non-blocking notification delivery over synchronous send patterns