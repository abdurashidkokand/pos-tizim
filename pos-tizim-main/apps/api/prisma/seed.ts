import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed boshlandi...');

  // ── PLANS ────────────────────────────────────────────
  const plans = [
    {
      name: 'FREE',
      displayName: 'Bepul',
      priceMonthly: 0,
      priceYearly: 0,
      maxBranches: 1,
      maxUsers: 1,
      maxCashiers: 0,
      maxRegisters: 1,
      maxProducts: 50,
      monthlyReceipts: 300,
      storageMB: 50,
      features: {
        enableProfit: false,
        enableDebt: false,
        enableImport: false,
        enableProductImages: false,
        enableCashback: false,
        advancedReports: false,
      },
      sortOrder: 0,
    },
    {
      name: 'PRO',
      displayName: 'Professional',
      priceMonthly: 249000,
      priceYearly: 2490000,
      maxBranches: 3,
      maxUsers: 10,
      maxCashiers: 10,
      maxRegisters: 5,
      maxProducts: 5000,
      monthlyReceipts: 50000,
      storageMB: 2000,
      features: {
        enableProfit: true,
        enableDebt: true,
        enableImport: true,
        enableProductImages: true,
        enableCashback: true,
        advancedReports: true,
      },
      sortOrder: 1,
    },
    {
      name: 'ENTERPRISE',
      displayName: 'Korporativ',
      priceMonthly: 499000,
      priceYearly: 4990000,
      maxBranches: 50,
      maxUsers: 100,
      maxCashiers: 100,
      maxRegisters: 100,
      maxProducts: 50000,
      monthlyReceipts: 500000,
      storageMB: 10000,
      features: {
        enableProfit: true,
        enableDebt: true,
        enableImport: true,
        enableProductImages: true,
        enableCashback: true,
        advancedReports: true,
      },
      sortOrder: 2,
    },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { name: p.name },
      update: p,
      create: p,
    });
    console.log(`  ✅ Plan: ${p.displayName}`);
  }

  // Remove BASIC plan if it exists (consolidated into 3 plans)
  await prisma.plan.deleteMany({ where: { name: 'BASIC' } }).catch(() => {});

  // ── DEFAULT TENANT ───────────────────────────────────
  const freePlan = await prisma.plan.findUnique({ where: { name: 'FREE' } });

  let tenant = await prisma.tenant.findFirst({ where: { slug: 'demo-dokon' } });
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: "Demo Do'kon",
        slug: 'demo-dokon',
        phone: '+998901234567',
        address: "Toshkent sh.",
      },
    });
    console.log(`  ✅ Tenant: ${tenant.name}`);
  }

  // Default branch
  let branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        tenantId: tenant.id,
        name: 'Asosiy filial',
        address: "Toshkent sh.",
      },
    });
    console.log(`  ✅ Branch: ${branch.name}`);
  }

  // Default register
  const existingReg = await prisma.register.findFirst({ where: { tenantId: tenant.id } });
  if (!existingReg) {
    await prisma.register.create({
      data: {
        tenantId: tenant.id,
        branchId: branch.id,
        name: 'Kassa #1',
      },
    });
    console.log('  ✅ Register: Kassa #1');
  }

  // Subscription
  const existingSub = await prisma.subscription.findUnique({ where: { tenantId: tenant.id } });
  if (!existingSub && freePlan) {
    await prisma.subscription.create({
      data: {
        tenantId: tenant.id,
        planId: freePlan.id,
        status: 'ACTIVE',
      },
    });
    console.log('  ✅ Subscription: FREE plan');
  }

  // ── USERS ────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: { role: 'OWNER', tenantId: tenant.id, branchId: branch.id, fullName: 'Administrator' },
    create: {
      username: 'admin',
      password: adminPassword,
      role: 'OWNER',
      fullName: 'Administrator',
      tenantId: tenant.id,
      branchId: branch.id,
    },
  });
  console.log('  ✅ User: admin (OWNER)');

  const managerPassword = await bcrypt.hash('manager123', 10);
  await prisma.user.upsert({
    where: { username: 'manager' },
    update: { tenantId: tenant.id, branchId: branch.id, fullName: 'Menejer' },
    create: {
      username: 'manager',
      password: managerPassword,
      role: 'MANAGER',
      fullName: 'Menejer',
      tenantId: tenant.id,
      branchId: branch.id,
    },
  });
  console.log('  ✅ User: manager (MANAGER)');

  const cashierPassword = await bcrypt.hash('cashier123', 10);
  await prisma.user.upsert({
    where: { username: 'cashier1' },
    update: { tenantId: tenant.id, branchId: branch.id, fullName: 'Kassir #1' },
    create: {
      username: 'cashier1',
      password: cashierPassword,
      role: 'CASHIER',
      fullName: 'Kassir #1',
      tenantId: tenant.id,
      branchId: branch.id,
    },
  });
  console.log('  ✅ User: cashier1 (CASHIER)');

  // ── SUPERADMIN (platform owner) ──────────────────────
  const superPassword = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD || 'super123', 10);
  await prisma.user.upsert({
    where: { username: 'superadmin' },
    update: { role: 'SUPERADMIN', fullName: 'Platform Admin' },
    create: {
      username: 'superadmin',
      password: superPassword,
      role: 'SUPERADMIN',
      fullName: 'Platform Admin',
    },
  });
  console.log('  ✅ User: superadmin (SUPERADMIN)');

  // ── DEMO PRODUCTS ────────────────────────────────────
  const products = [
    { name: 'Coca-Cola 0.5L', sku: 'CC-500', price: 8000, cost: 5000, barcode: '4870004100029' },
    { name: 'Pepsi 0.5L', sku: 'PP-500', price: 7500, cost: 4500, barcode: '4870002111111' },
    { name: 'Lipton Choy', sku: 'LP-100', price: 15000, cost: 10000, barcode: '8712100325953' },
    { name: 'Lays Classic', sku: 'LY-120', price: 12000, cost: 8000, barcode: '4028400001111' },
    { name: 'Snickers', sku: 'SN-50', price: 6000, cost: 3500, barcode: '5000159461122' },
  ];

  for (const p of products) {
    const { barcode, ...productData } = p;
    const existing = await prisma.product.findFirst({
      where: { tenantId: tenant.id, sku: productData.sku },
    });
    if (!existing) {
      const product = await prisma.product.create({
        data: {
          ...productData,
          tenantId: tenant.id,
          branchId: branch.id,
          barcodes: { create: [{ code: barcode }] },
          stock: { create: { quantity: 100 } },
        },
      });
      console.log(`  ✅ Mahsulot: ${product.name}`);
    } else {
      if (!existing.tenantId) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { tenantId: tenant.id, branchId: branch.id },
        });
      }
      console.log(`  ⏭️  Mahsulot mavjud: ${existing.name}`);
    }
  }

  console.log('');
  console.log('✅ Seed yakunlandi!');
  console.log('');
  console.log('📋 Kirish ma\'lumotlari:');
  console.log('  SuperAdmin:  superadmin / super123');
  console.log('  Admin/Owner: admin      / admin123');
  console.log('  Manager:     manager    / manager123');
  console.log('  Cashier:     cashier1   / cashier123');
}

main()
  .catch((e) => {
    console.error('❌ Seed xatosi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
