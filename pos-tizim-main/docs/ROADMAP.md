# POS Tizim — ROADMAP

## PHASE 1 — MVP1+ (✅ Tugallangan)

| #       | Vazifa                              | Holat  |
| ------- | ----------------------------------- | ------ |
| TASK-1  | iOS barcode scanner fallback        | ✅ Done |
| TASK-2  | Receipt print 80mm                  | ✅ Done |
| TASK-3  | Product Images (upload + API)       | ✅ Done |
| TASK-4  | Discount types (% / so'm)           | ✅ Done |
| TASK-5  | Change password (user + admin)      | ✅ Done |
| TASK-6  | Report export (Excel + PDF)         | ✅ Done |
| TASK-7  | PWA (manifest + SW + offline shell) | ✅ Done |
| TASK-8  | POS UX hotkeys                      | ✅ Done |
| TASK-9  | Production hardening                | ✅ Done |
| TASK-10 | Barcode label print (40x30/58mm)    | ✅ Done |
| TASK-11 | Excel import/export products        | ✅ Done |
| TASK-12 | Bulk price update + price history   | ✅ Done |

---

## PHASE 2 — SaaS Readiness (INNOV)

Bu yerda "skeleton" DB schema tayyor (Prisma schema'da commented out holatda).
Real implement qilish ketma-ketligi:

### INNOV-1: Multi-tenant + Branch
- `Tenant` va `Branch` modellari
- Har jadvalda `tenantId` ustun
- Middleware: tenant isolation (JWT → tenantId)
- SuperAdmin roli (platform owner)
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### INNOV-2: Subscription Billing + Trial
- `Plan` modeli: BASIC / PRO / ENTERPRISE
- Limitlar: branches, cashiers (seats), oylik receipts, storageMB
- `BillingProvider` interface (Stripe/Paddle/local)
- Trial + grace period
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### INNOV-3: Feature Flags (plan bo'yicha)
- `FeatureOverride` table
- Flaglar: `enablePWAOfflineQueue`, `enableLoyalty`, `enableAdvancedReports`
- Web UI: "locked feature" banner ko'rsatish
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### INNOV-4: Usage Metering
- `UsageRecord`: monthly receipts, active users, storage
- Background job: reset monthly
- Dashboard widget: "Bu oy 450/1000 chek ishlatildi"
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### INNOV-5: Smart Analytics (Recommendations)
- "Dead stock" — 30 kun sotilmagan mahsulotlar
- "Peak hour" — eng ko'p sotuv soatlari
- "Cashier performance" — kassir statistikasi
- Basic charts + 1-2 tavsiya
- **Implement**: ❌ Planned

### INNOV-6: Loyalty & Internal Cashback (QR)
- `Customer` modeli (phone optional)
- `LoyaltyTransaction`: points / cashback
- Receipt'da QR → `/r/<signedToken>` → cashback qo'shiladi
- Admin: loyalti qoidalari (1% cashback, etc.)
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### INNOV-7: Digital Receipt (SMS/WhatsApp/Email)
- Share link generator
- Provider adapter (SMS gateway integration)
- **Implement**: ❌ Planned

### INNOV-8: Shift Management + Reconciliation
- CashSession kengaytirish: expectedCash vs actualCash
- Discrepancy report
- Cash movement categories
- **Implement**: ❌ Planned

### INNOV-9: Anti-fraud & Audit Intelligence
- Rules: too many voids, unusual discounts, price overrides
- `FraudAlert` table + dashboard
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### INNOV-10: Integrations Marketplace (Plugin System)
- `Integration` table: type, config, status
- Web: "Integratsiyalar" sahifasi
- Webhook framework: outgoing events (`sale.created`, `inventory.adjusted`)
- **DB schema**: ✅ Draft
- **Implement**: ❌ Planned

### BONUS: Fiskalization (Soliq)
- `SaleFiscal` table + `FiscalizationProvider` interface
- Job queue: retry/backoff
- **DB schema**: ✅ Draft
- **Implement**: ❌ Future

---

## Architecture Decisions

1. **Monorepo** (Turborepo): `apps/api`, `apps/web`, `packages/shared`
2. **Shared Zod schemas**: validation ikkala tomonda ishlatiladi
3. **Multi-tenant ready**: schema'da `tenantId` qo'shish oson
4. **Feature flags**: plan-based, tenant-level overrides
5. **Plugin system**: webhook-based integrations
