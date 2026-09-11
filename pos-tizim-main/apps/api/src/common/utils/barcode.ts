import { randomInt } from 'crypto';

// GS1 reserves the 20-29 prefix range for internal/in-store use, so codes we
// mint here can never collide with real manufacturer EAN-13 barcodes.
const INTERNAL_PREFIX = '20';

function ean13CheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(digits12[i]);
    sum += i % 2 === 0 ? d : d * 3;
  }
  return (10 - (sum % 10)) % 10;
}

// Generates a random, well-formed 13-digit EAN-13 barcode in the internal-use range.
export function generateEan13(): string {
  let body = '';
  for (let i = 0; i < 10; i++) body += randomInt(0, 10);
  const digits12 = INTERNAL_PREFIX + body;
  return digits12 + ean13CheckDigit(digits12);
}
