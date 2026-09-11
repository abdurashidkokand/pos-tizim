import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(3, 'Minimum 3 belgi').max(50),
  password: z.string().min(4, 'Minimum 4 belgi').max(100),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const CreateUserSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Faqat harf, raqam va _ ruxsat'),
  password: z
    .string()
    .min(8, 'Minimum 8 ta belgi')
    .max(100)
    .regex(/[a-zA-Z]/, 'Kamida bitta harf bo\'lishi kerak')
    .regex(/[0-9]/, 'Kamida bitta raqam bo\'lishi kerak'),
  fullName: z.string().max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER']).default('CASHIER'),
  branchId: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  password: z
    .string()
    .min(8, 'Minimum 8 ta belgi')
    .max(100)
    .regex(/[a-zA-Z]/, 'Kamida bitta harf bo\'lishi kerak')
    .regex(/[0-9]/, 'Kamida bitta raqam bo\'lishi kerak')
    .optional(),
  fullName: z.string().max(100).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER']).optional(),
  branchId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;
export type RefreshDto = z.infer<typeof RefreshSchema>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;
