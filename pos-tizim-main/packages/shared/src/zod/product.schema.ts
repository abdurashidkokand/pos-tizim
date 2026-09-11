import { z } from 'zod';

export const ProductVariantSchema = z.object({
  size: z.string().trim().max(50).optional(),
  color: z.string().trim().max(50).optional(),
  sku: z.string().trim().max(100).optional(),
  price: z.number().int().positive().optional(),
  cost: z.number().int().nonnegative().optional(),
  quantity: z.number().int().nonnegative().default(0),
  barcode: z.string().trim().min(1).optional(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1, 'Nom kiritilishi shart').max(200),
  sku: z.string().max(100).optional(),
  price: z.number().int().positive("Narx musbat bo'lishi kerak"),
  cost: z.number().int().nonnegative().optional(),
  barcodes: z.array(z.string().min(1)).optional().default([]),
  variants: z.array(ProductVariantSchema).min(1).optional(),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sku: z.string().max(100).optional(),
  price: z.number().int().positive().optional(),
  cost: z.number().int().nonnegative().optional(),
});

export const AdjustStockSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  qtyDelta: z
    .number()
    .int()
    .refine((v) => v !== 0, "Delta 0 bo'lmasligi kerak"),
  reason: z.string().min(1, 'Sabab kiritilishi shart').max(200),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
export type ProductVariantDto = z.infer<typeof ProductVariantSchema>;
export type AdjustStockDto = z.infer<typeof AdjustStockSchema>;
