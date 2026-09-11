# POS Tizim — MVP1

Magazinlar uchun Point of Sale (POS) tizimi. Monorepo, NestJS + Next.js + PostgreSQL.

## Tezkor ishga tushirish

```bash
# 1. Muhit o'zgaruvchilari
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local

# 2. Databazani ko'tarish
bun run infra:up

# 3. Paketlarni o'rnatish
bun install

# 4. Prisma generate + migrate
bun run db:migrate

# 5. Seed (admin user yaratish)
bun run db:seed

# 6. Hammasini ishga tushirish
bun run dev
```

## Kirish ma'lumotlari (seed)

| Login   | Parol    | Role  |
|---------|----------|-------|
| admin   | admin123 | ADMIN |

## Manzillar

| Xizmat   | URL                        |
|----------|----------------------------|
| API      | http://localhost:3001/api  |
| Swagger  | http://localhost:3001/docs |
| Web      | http://localhost:3000      |

## Texnologiyalar

- **Runtime**: Bun
- **Backend**: NestJS + Prisma + PostgreSQL
- **Frontend**: Next.js 15 (App Router) + TailwindCSS
- **Auth**: JWT (access + refresh)
- **Validation**: Zod (shared schemas)
- **Docs**: Swagger

## Tuzilma

```
pos-tizim/
├─ apps/
│  ├─ api/          — NestJS REST API
│  └─ web/          — Next.js Admin Panel
├─ packages/
│  └─ shared/       — Zod schemalar + umumiy tiplar
└─ infra/           — Docker Compose (PostgreSQL)
```
