import { api } from './api';
import { getPendingSales, removePendingSale } from './offline-db';

let syncing = false;

// Replays queued offline sales to the server in order, stopping at the first
// one that still fails (keeps the rest queued for the next attempt).
export async function flushPendingSales(): Promise<number> {
  if (syncing) return 0;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 0;

  syncing = true;
  let flushed = 0;
  try {
    const pending = await getPendingSales();
    for (const sale of pending) {
      try {
        await api.post('/sales', sale.body);
        await removePendingSale(sale.clientTxnId);
        flushed++;
      } catch {
        break; // still unreachable/rejected — retry the whole batch next time
      }
    }
  } finally {
    syncing = false;
  }
  return flushed;
}
