# Changelog

Barcha muhim o'zgarishlar shu faylda yoziladi.

## [1.4.0] — 2026-03-10

### Qo'shildi

- **Mobile drawer navigatsiya**: Chap tarafdan chiquvchi drawer menyu — barcha sahifalar mobilda qulay yetib borish uchun
  - "Marva POS" header bosilganda hamburger menyu ochiladi
  - Drawer ichida nav elementlar guruhlangan: Asosiy, Boshqaruv, Mijozlar, Hisobotlar, Tizim
  - Backdrop, Escape, close tugmasi va route o'zgarganda avtomatik yopiladi
  - Body scroll drawer ochiq bo'lganda bloklangan
  - Telegram WebView va safe-area to'liq qo'llab-quvvatlanadi
  - Aria attributlari va focus management — accessibility tayyor
- **Shared navigation config** (`lib/navigation.ts`): Barcha nav elementlar, bottom nav, drawer guruhlari, role filtrlash — bitta faylda
- **Dashboard premium fon**: Portfolio kabi chiroyli gradient, animated bloblar, nozik grid pattern

### O'zgartirildi

- **Sidebar refactored**: Desktop sidebar va mobile bottom nav endi shared config'dan ishlaydi — duplikat kodlar olib tashlandi
- **Bottom nav**: `backdrop-blur-lg` effekti qo'shildi, dizayn yangilandi
- **Mobile header**: Hamburger icon + "Marva POS" tugmasiga aylandi (drawer trigger)

### Fayllar

- `lib/navigation.ts` — yangi (shared nav config)
- `components/mobile-drawer.tsx` — yangi (drawer component)
- `components/sidebar.tsx` — refactored
- `app/(dashboard)/layout.tsx` — dashboard background
- `app/globals.css` — dashboard-bg styles, blob animatsiyalar

---

## [1.3.1] — 2026-03-09

### Tuzatildi

- **TG header safe-area background**: Telegram WebView'da header ustidagi oq/kulrang bo'shliq yo'qotildi — `::before` pseudo-element orqali dark background yuqoriga to'ldirildi
- Header content ("Marva POS", "Chiqish") o'z joyida qoldi, faqat fon rangi yuqoriga cho'zildi

---

## [1.3.0] — 2026-03-08

### Tuzatildi

- **Mobile layout overhaul**: Global CSS variable system (`--app-top-offset`, `--app-bottom-offset`, `--tg-chrome-h`) — header, bottom nav, safe-area bir joydan boshqariladi
- **Header overlap fix**: Dashboard content endi header ostida yashirinmaydi (Telegram WebView va oddiy brauzerlarda)
- **POS page positioning**: Fixed layout `var(--app-top-offset)` / `var(--app-bottom-offset)` ishlatadi — `bottom-16` va inline `max()` olib tashlandi
- **Telegram header**: `--tg-header` → `--tg-chrome-h` o'zgaruvchisi, TG header pozitsiyasi to'g'rilandi
- **Bottom nav safe area**: `safe-bottom` class → inline `var(--safe-bottom)` padding
- **Desktop layout**: Barcha mobile offset'lar `@media (min-width: 768px)` da 0px ga tushadi — desktop buzilmaydi

---

## [1.2.0] — 2026-03-08

### Tuzatildi

- **Mobile form**: "Yangi mahsulot qo'shish" forma mobilda input maydonlari ustma-ust tushishi — `col-span-2` → `sm:col-span-2`

### O'zgartirildi

- **Scanner UX overhaul**:
  - `CameraManager` singleton (`lib/cameraManager.ts`) — kamera stream sahifalar orasida saqlanadi, re-prompt yo'q
  - Full-frame skanlash — butun video kadr skanerlanadi (markaziy ROI olib tashlandi)
  - 800ms debounce lock — dublikat skanlar oldini oladi
  - Manual fallback — kamera mavjud bo'lmasa qo'lda kiritish doim ko'rinadi
  - Oxirgi skanlangan kod kadr ustida ko'rsatiladi (flash overlay)
  - Camera close'da tracklar to'xtatilmaydi — faqat video element ajratiladi

---

## [1.1.0] — 2026-03-08

### Qo'shildi

- **TASK-1**: iOS barcode scanner fallback — ZXing dual-engine (BarcodeDetector + fallback)
- **TASK-2**: Receipt print 80mm — thermal print component (`receipt-print.tsx`), POS va Sales sahifalarida "Chop etish" tugmasi
- **TASK-3**: Product Images — `ProductImage` modeli, `uploads` modul (multer), static file serving, API endpoints (upload/list/delete)
- **TASK-4**: Discount turlari — `DiscountType` enum (PERCENT/FIXED), POS'da % / so'm toggle, backend hisoblash
- **TASK-5**: Parol o'zgartirish — `POST /auth/change-password`, `PATCH /users/:id/reset-password` (ADMIN), Settings sahifasi
- **TASK-6**: Hisobot eksport — `GET /reports/daily.xlsx` (ExcelJS), `GET /reports/daily.pdf` (print HTML), frontend tugmalari
- **TASK-7**: PWA — `manifest.json`, `sw.js` (static caching), offline shell
- **TASK-8**: POS UX hotkeys — F2 (fokus), F9 (checkout), Esc (modal close), +/- (qty), Delete (remove)
- **TASK-9**: Production hardening
  - `@nestjs/throttler` — rate limiting (20/sec, 300/min, auth: 5/min)
  - `RequestIdMiddleware` — har request'da UUID `x-request-id` header
  - Exception filter'da `requestId` va structured log
  - Sales transaction: `SELECT ... FOR UPDATE` stock locking (race condition himoya)
- **TASK-10**: Barcode label print — `barcode-label.tsx` component (40×30mm / 58mm), Products sahifasida "Etiketka" tugmasi
- **TASK-11**: Excel import/export products
  - `GET /products/export/excel` — ExcelJS bilan export
  - `POST /products/import/excel` — multipart upload, validation (duplicate SKU/barcode)
  - Frontend tugmalari (export/import)
- **TASK-12**: Bulk price update
  - `POST /products/bulk-price` — foiz bilan ommaviy narx o'zgartirish
  - `GET /products/:id/price-history` — narx o'zgarish tarixi
  - `PriceHistory` modeli (avtomatik tracking)
  - Frontend: "Ommaviy narx" panel (filter + foiz)
- **INNOV**: SaaS roadmap skeleton — commented DB schemas (Tenant, Branch, Plan, Subscription, FeatureOverride, UsageRecord, Customer, LoyaltyTransaction, FraudAlert, Integration, SaleFiscal)

### O'zgartirildi

- `app.module.ts` — ThrottlerModule, RequestIdMiddleware, ServeStaticModule qo'shildi
- Prisma schema — ProductImage, PriceHistory, DiscountType modellari + INNOV draft
- Sales transaction — `FOR UPDATE` locking bilan kuchaytirildi
- Products controller — export/import/bulk-price/price-history endpoints

### DB Migration

- `20260307172242_add_images_discount_pricehistory` — ProductImage, PriceHistory, DiscountType

---

## [1.0.0] — 2026-03-07

### MVP1

- Auth (JWT access + refresh, bcryptjs, RBAC)
- Users CRUD (ADMIN/MANAGER/CASHIER)
- Products + Barcodes + Stock
- Inventory adjust
- Sales (cart → checkout → receipt)
- Cash Sessions (open/close)
- Reports (daily summary)
- Audit log
- Web POS (full-screen, responsive)
