// Umumiy enumlar (Prisma schema bilan mos keladi)
export enum Role {
  SUPERADMIN = 'SUPERADMIN',
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  CASHIER = 'CASHIER',
}

export enum SaleStatus {
  PAID = 'PAID',
  VOID = 'VOID',
  PARTIAL = 'PARTIAL',
}

export enum PaymentType {
  CASH = 'CASH',
  CARD = 'CARD',
  MIXED = 'MIXED',
}

export enum CashSessionStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashMoveType {
  IN = 'IN',
  OUT = 'OUT',
}

export enum DiscountType {
  PERCENT = 'PERCENT',
  FIXED = 'FIXED',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  CANCELED = 'CANCELED',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
}

export enum InvoiceStatus {
  OPEN = 'OPEN',
  PAID = 'PAID',
  VOID = 'VOID',
}

export enum ReceivableStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum CashbackTxType {
  EARN = 'EARN',
  REDEEM = 'REDEEM',
}

// JWT token payload
export interface TokenPayload {
  sub: string;
  username: string;
  role: Role;
  tenantId?: string;
  branchId?: string;
}

// Pagination
export interface PaginationQuery {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Authenticated user (request.user dan olinadigan)
export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  tenantId?: string;
  branchId?: string;
}

// Plan features
export interface PlanFeatures {
  enableProfit: boolean;
  enableDebt: boolean;
  enableImport: boolean;
  enableProductImages: boolean;
  enableCashback: boolean;
  advancedReports: boolean;
}
