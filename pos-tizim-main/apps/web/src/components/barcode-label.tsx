'use client';

import { useEffect, useRef } from 'react';
import { X, Printer } from 'lucide-react';

interface BarcodeLabelProps {
  products: {
    name: string;
    price: number;
    barcode?: string;
  }[];
  format: '40x30' | '58mm';
  onClose: () => void;
}

const fmt = (n: number) => new Intl.NumberFormat('uz-UZ').format(n);

export default function BarcodeLabel({ products, format, onClose }: BarcodeLabelProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const is40x30 = format === '40x30';
    const labelW = is40x30 ? '40mm' : '58mm';
    const labelH = is40x30 ? '30mm' : '40mm';
    const fontSize = is40x30 ? '8px' : '10px';
    const barcodeSize = is40x30 ? '12px' : '16px';
    const priceSize = is40x30 ? '11px' : '14px';

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Etiketka</title>
<style>
  @page {
    size: ${labelW} ${labelH};
    margin: 0;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; }
  .label {
    width: ${labelW};
    height: ${labelH};
    padding: 2mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    page-break-after: always;
    text-align: center;
    overflow: hidden;
  }
  .label:last-child { page-break-after: auto; }
  .name {
    font-size: ${fontSize};
    font-weight: bold;
    line-height: 1.2;
    max-height: ${is40x30 ? '8mm' : '12mm'};
    overflow: hidden;
    width: 100%;
    word-break: break-word;
  }
  .barcode-text {
    font-family: 'Courier New', monospace;
    font-size: ${barcodeSize};
    letter-spacing: 1px;
    margin: 1mm 0;
  }
  .price {
    font-size: ${priceSize};
    font-weight: bold;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
${products
  .map(
    (p) => `
  <div class="label">
    <div class="name">${p.name.replace(/</g, '&lt;')}</div>
    ${p.barcode ? `<div class="barcode-text">${p.barcode.replace(/</g, '&lt;')}</div>` : ''}
    <div class="price">${fmt(p.price)} so'm</div>
  </div>`,
  )
  .join('')}
</body>
</html>`;

    doc.open();
    doc.write(html);
    doc.close();
  }, [products, format]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-bold text-base">Etiketka — {format === '40x30' ? '40×30mm' : '58mm'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 flex justify-center bg-gray-50">
          <iframe
            ref={iframeRef}
            className="border border-gray-200 bg-white"
            style={{ width: format === '40x30' ? '160px' : '230px', height: '300px' }}
            title="Label preview"
          />
        </div>

        <div className="px-5 py-4 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm hover:bg-gray-50 transition"
          >
            Yopish
          </button>
          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-xl text-sm font-medium transition"
          >
            <Printer className="w-4 h-4 inline mr-1" />Chop etish
          </button>
        </div>
      </div>
    </div>
  );
}
