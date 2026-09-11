import { z } from 'zod';

export const SaleItemSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  qty: z.number().int().positive("Miqdor musbat bo'lishi kerak"),
  price: z.number().int().positive("Narx musbat bo'lishi kerak"),
});

export const PaymentSchema = z.object({
  type: z.enum(['CASH', 'CARD', 'MIXED']),
  amount: z.number().int().positive("Summa musbat bo'lishi kerak"),
});

export const CreateSaleSchema = z.object({
  items: z.array(SaleItemSchema).min(1, 'Kamida 1 ta mahsulot kerak'),
  payments: z.array(PaymentSchema).default([]),
  discount: z.number().int().nonnegative().optional().default(0),
  discountType: z.enum(['PERCENT', 'FIXED']).optional().default('FIXED'),
  discountValue: z.number().int().nonnegative().optional().default(0),
  cashSessionId: z.string().min(1).nullable().optional(),
  customerId: z.string().min(1).nullable().optional(),
  cashbackCardId: z.string().min(1).nullable().optional(),
  // Idempotency key set by offline clients replaying a queued sale after reconnecting
  clientTxnId: z.string().min(1).max(100).optional(),
});

export const OpenCashSessionSchema = z.object({
  openingCash: z.number().int().nonnegative().default(0),
});

export const CloseCashSessionSchema = z.object({
  closingCash: z.number().int().nonnegative(),
});

export const CashMovementSchema = z.object({
  type: z.enum(['IN', 'OUT']),
  amount: z.number().int().positive(),
  note: z.string().max(200).optional(),
});

export type CreateSaleDto = z.infer<typeof CreateSaleSchema>;
export type OpenCashSessionDto = z.infer<typeof OpenCashSessionSchema>;
export type CloseCashSessionDto = z.infer<typeof CloseCashSessionSchema>;
export type CashMovementDto = z.infer<typeof CashMovementSchema>;
