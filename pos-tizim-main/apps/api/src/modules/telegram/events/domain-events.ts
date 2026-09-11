// Domain event payloads emitted by business services.
// Handlers in Telegram modules subscribe via @OnEvent(EVENT_NAMES.x)

export const EVENTS = {
  SALE_CREATED: 'sale.created',
  STOCK_ADJUSTED: 'stock.adjusted',
  STOCK_LOW: 'stock.low',
  STOCK_OUT: 'stock.out',
  CASH_SESSION_OPENED: 'cash_session.opened',
  CASH_SESSION_CLOSED: 'cash_session.closed',
  DEBT_CREATED: 'debt.created',
  DEBT_PAID: 'debt.paid',
} as const;

export interface SaleCreatedEvent {
  saleId: string;
  tenantId: string;
  branchId?: string | null;
  userId: string;
  customerId?: string | null;
  receiptNo: string;
  total: number;
  discount: number;
  grossProfit: number;
  status: string; // PAID | PARTIAL
  itemCount: number;
  debtAmount?: number;
}

export interface StockAdjustedEvent {
  tenantId: string;
  productId: string;
  productName: string;
  newQty: number;
  qtyDelta: number;
  lowStockThreshold?: number;
}

export interface StockLowEvent {
  tenantId: string;
  productId: string;
  productName: string;
  currentQty: number;
  threshold: number;
  branchId?: string | null;
}

export interface StockOutEvent {
  tenantId: string;
  productId: string;
  productName: string;
  branchId?: string | null;
}

export interface CashSessionOpenedEvent {
  tenantId: string;
  sessionId: string;
  userId: string;
  openingCash: number;
  branchId?: string | null;
}

export interface CashSessionClosedEvent {
  tenantId: string;
  sessionId: string;
  userId: string;
  openingCash: number;
  closingCash: number;
  branchId?: string | null;
}

export interface DebtCreatedEvent {
  tenantId: string;
  saleId: string;
  customerId: string;
  customerName: string;
  amountDue: number;
  receiptNo: string;
}

export interface DebtPaidEvent {
  tenantId: string;
  receivableId: string;
  customerId: string;
  customerName: string;
  amountPaid: number;
  remaining: number;
}
