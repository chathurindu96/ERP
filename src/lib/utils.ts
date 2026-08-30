import type {
  Bill, Client, Invoice, LineItem, OrderStatus, PayMethod, Payment,
} from '../db/schema';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const todayISO = () => new Date().toISOString();
export const D = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86400000).toISOString();

export const inr = (n: number) =>
  (n < 0 ? '−' : '') + '₹' + Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const fmtDate = (iso: string, withYear = true) =>
  new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', ...(withYear ? { year: 'numeric' as const } : {}),
  });

/** whole days from today to date; negative = past */
export const daysFromToday = (iso: string) => {
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  return Math.round((a.getTime() - b.getTime()) / 86400000);
};

/* ---------------- money math ---------------- */

export interface Totals {
  subTotal: number; discountAmt: number; taxAmt: number;
  cgst: number; sgst: number; roundOff: number; total: number; qty: number;
}

export function computeTotals(items: LineItem[]): Totals {
  let taxable = 0, discountAmt = 0, taxAmt = 0, qty = 0;
  for (const it of items) {
    const gross = it.qty * it.unitPrice;
    const d = (gross * it.discountPct) / 100;
    const net = gross - d;
    taxable += net;
    discountAmt += d;
    taxAmt += (net * it.taxRate) / 100;
    qty += it.qty;
  }
  const raw = taxable + taxAmt;
  const total = Math.round(raw);
  return {
    subTotal: round2(taxable), discountAmt: round2(discountAmt), taxAmt: round2(taxAmt),
    cgst: round2(taxAmt / 2), sgst: round2(taxAmt / 2),
    roundOff: round2(total - raw), total, qty,
  };
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export const lineNet = (it: LineItem) =>
  it.qty * it.unitPrice * (1 - it.discountPct / 100);

/* ---------------- statuses ---------------- */

export type Tone = 'slate' | 'amber' | 'blue' | 'emerald' | 'rose';

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Draft', tone: 'slate' },
  confirmed: { label: 'Confirmed', tone: 'amber' },
  in_production: { label: 'In Production', tone: 'amber' },
  ready: { label: 'Ready for Dispatch', tone: 'blue' },
  dispatched: { label: 'Dispatched', tone: 'blue' },
  delivered: { label: 'Delivered', tone: 'emerald' },
  invoiced: { label: 'Invoiced', tone: 'emerald' },
  cancelled: { label: 'Cancelled', tone: 'rose' },
};

export const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  draft: { to: 'confirmed', label: 'Confirm order' },
  confirmed: { to: 'in_production', label: 'Start production' },
  in_production: { to: 'ready', label: 'Mark ready for dispatch' },
  ready: { to: 'dispatched', label: 'Dispatch with challan' },
  dispatched: { to: 'delivered', label: 'Mark delivered' },
};

export type InvStatus = 'paid' | 'partial' | 'overdue' | 'unpaid';
export const INV_STATUS_META: Record<InvStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Fully Paid', tone: 'emerald' },
  partial: { label: 'Partially Paid', tone: 'blue' },
  overdue: { label: 'Overdue', tone: 'rose' },
  unpaid: { label: 'Awaiting Payment', tone: 'amber' },
};

export function invStatus(inv: Invoice, paidAmt: number): InvStatus {
  const bal = inv.total - paidAmt;
  if (bal <= 0.5) return 'paid';
  if (daysFromToday(inv.dueDate) < 0) return 'overdue';
  return paidAmt > 0 ? 'partial' : 'unpaid';
}

export const paidForInvoice = (invoiceId: string, payments: Payment[]) =>
  payments.filter((p) => p.direction === 'in' && p.invoiceId === invoiceId)
    .reduce((s, p) => s + p.amount, 0);

export const paidForBill = (billId: string, payments: Payment[]) =>
  payments.filter((p) => p.direction === 'out' && p.billId === billId)
    .reduce((s, p) => s + p.amount, 0);

export const billStatus = (bill: Bill, paid: number): InvStatus => {
  const bal = bill.amount - paid;
  if (bal <= 0.5) return 'paid';
  if (daysFromToday(bill.dueDate) < 0) return 'overdue';
  return paid > 0 ? 'partial' : 'unpaid';
};

/* ---------------- numbering ---------------- */

export function nextSeq(prefix: string, existingNos: string[], pad = 4) {
  let max = 0;
  for (const no of existingNos) {
    const m = no.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const y = String(new Date().getFullYear()).slice(2);
  return `${prefix}-${y}-${String(max + 1).padStart(pad, '0')}`;
}

/* ---------------- terms / calendar ---------------- */

export const TERMS_OPTIONS = ['Cash on Delivery', 'Net 7', 'Net 15', 'Net 30', 'Net 45'];
export const termsDays = (t: string) => {
  const m = t.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
};
export const dueFromTerms = (terms: string, fromISO: string) =>
  new Date(new Date(fromISO).getTime() + termsDays(terms) * 86400000).toISOString();

export function lastMonths(n: number) {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
    });
  }
  return out;
}

/* ---------------- client ledger (khata) ---------------- */

export interface StatementRow {
  id: string; date: string; ref: string; type: 'invoice' | 'payment';
  detail: string; debit: number; credit: number; balance: number;
}

export function buildStatement(
  clientId: string, invoices: Invoice[], payments: Payment[],
): StatementRow[] {
  const inv = invoices.filter((i) => i.clientId === clientId).map((i) => ({
    id: i.id, date: i.date, ref: i.invoiceNo, type: 'invoice' as const,
    detail: `Tax invoice · ${i.items.length} line item${i.items.length > 1 ? 's' : ''}`,
    debit: i.total, credit: 0,
  }));
  const pay = payments
    .filter((p) => p.direction === 'in' && p.clientId === clientId)
    .map((p) => ({
      id: p.id, date: p.date, ref: `${methodLabel(p.method)}${p.ref ? ' · ' + p.ref : ''}`,
      type: 'payment' as const, detail: p.note || 'Payment received',
      debit: 0, credit: p.amount,
    }));
  const rows = [...inv, ...pay].sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  return rows.map((r) => { bal += r.debit - r.credit; return { ...r, balance: round2(bal) }; });
}

export const PAY_METHODS: { id: PayMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank Transfer' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'upi', label: 'UPI' },
];
export const methodLabel = (m: PayMethod) =>
  PAY_METHODS.find((x) => x.id === m)?.label ?? m;

export const clientOf = (clients: Client[], id?: string) =>
  clients.find((c) => c.id === id);

export const clientBalance = (clientId: string, invoices: Invoice[], payments: Payment[]) => {
  const billed = invoices.filter((i) => i.clientId === clientId).reduce((s, i) => s + i.total, 0);
  const received = payments.filter((p) => p.direction === 'in' && p.clientId === clientId)
    .reduce((s, p) => s + p.amount, 0);
  return { billed, received, outstanding: round2(billed - received) };
};

export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : fmtDate(iso, false);
};

export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
