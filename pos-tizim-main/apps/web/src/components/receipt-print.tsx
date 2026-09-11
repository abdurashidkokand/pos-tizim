'use client';

import { useRef } from 'react';
import { Printer } from 'lucide-react';

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

interface ReceiptItem {
  qty: number;
  price: number;
  product?: { name: string };
  name?: string;
}

interface Payment {
  type: string;
  amount: number;
}

interface ReceiptData {
  receiptNo: string;
  createdAt: string;
  subtotal: number;
  discount: number;
  total: number;
  items: ReceiptItem[];
  payments: Payment[];
  user?: { username: string };
  discountType?: string;
  discountValue?: number;
}

interface Props {
  sale: ReceiptData;
  shopName?: string;
  onClose: () => void;
}

export default function ReceiptPrint({ sale, shopName = 'POS Do\'kon', onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow || !ref.current) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Chek #${sale.receiptNo}</title>
        <style>
          @page { size: 80mm auto; margin: 2mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 76mm;
            max-width: 76mm;
            padding: 2mm;
            color: #000;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .hr { border-top: 1px dashed #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; }
          .item-name { font-size: 11px; margin-bottom: 1px; }
          .item-detail { font-size: 11px; color: #333; }
          .total-row { font-size: 14px; font-weight: bold; }
          .footer { font-size: 10px; color: #666; margin-top: 6px; }
          @media print {
            body { width: 76mm; }
          }
        </style>
      </head>
      <body>
        ${ref.current.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  const date = new Date(sale.createdAt);
  const cashPayment = sale.payments.find(p => p.type === 'CASH');
  const cardPayment = sale.payments.find(p => p.type === 'CARD');
  const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
  const change = cashPayment && sale.payments.length === 1 ? Math.max(0, cashPayment.amount - sale.total) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Preview */}
        <div className="p-5 max-h-[70vh] overflow-auto">
          <div ref={ref}>
            <div className="center bold" style={{ fontSize: '16px', marginBottom: '4px' }}>
              {shopName}
            </div>
            <div className="hr"></div>
            <div className="row" style={{ fontSize: '11px' }}>
              <span>Chek: #{sale.receiptNo}</span>
            </div>
            <div className="row" style={{ fontSize: '11px' }}>
              <span>{date.toLocaleDateString('uz-UZ')}</span>
              <span>{date.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            {sale.user && (
              <div style={{ fontSize: '11px' }}>Kassir: {sale.user.username}</div>
            )}
            <div className="hr"></div>

            {/* Items */}
            {sale.items.map((item, i) => {
              const name = item.product?.name || item.name || 'Mahsulot';
              return (
                <div key={i} style={{ marginBottom: '3px' }}>
                  <div className="item-name">{name}</div>
                  <div className="row item-detail">
                    <span>{item.qty} x {fmt(item.price)}</span>
                    <span>{fmt(item.qty * item.price)}</span>
                  </div>
                </div>
              );
            })}

            <div className="hr"></div>

            {/* Subtotal */}
            <div className="row" style={{ fontSize: '12px' }}>
              <span>Jami:</span>
              <span>{fmt(sale.subtotal)}</span>
            </div>

            {/* Discount */}
            {sale.discount > 0 && (
              <div className="row" style={{ fontSize: '12px' }}>
                <span>Chegirma{sale.discountType === 'PERCENT' ? ` (${sale.discountValue}%)` : ''}:</span>
                <span>-{fmt(sale.discount)}</span>
              </div>
            )}

            <div className="hr"></div>

            {/* Total */}
            <div className="row total-row">
              <span>TO&apos;LOV:</span>
              <span>{fmt(sale.total)} so&apos;m</span>
            </div>

            <div className="hr"></div>

            {/* Payment breakdown */}
            {sale.payments.map((p, i) => (
              <div key={i} className="row" style={{ fontSize: '11px' }}>
                <span>{p.type === 'CASH' ? 'Naqd' : p.type === 'CARD' ? 'Karta' : 'Aralash'}:</span>
                <span>{fmt(p.amount)} so&apos;m</span>
              </div>
            ))}

            {change > 0 && (
              <div className="row bold" style={{ fontSize: '12px', marginTop: '2px' }}>
                <span>Qaytim:</span>
                <span>{fmt(change)} so&apos;m</span>
              </div>
            )}

            <div className="hr"></div>
            <div className="center footer">
              Xaridingiz uchun rahmat!
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
          >
            Yopish
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold text-sm transition"
          >
            <Printer className="w-4 h-4 inline mr-1" />Chop etish
          </button>
        </div>
      </div>
    </div>
  );
}
