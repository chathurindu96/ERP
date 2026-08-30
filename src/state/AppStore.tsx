import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db, DEFAULT_SETTINGS,
  type AuditEntry, type Bill, type CatalogItem, type Client, type FactorySettings,
  type Invoice, type Order, type OrderStatus, type Payment, type Vendor,
} from '../db/schema';
import { seedDatabase } from '../db/seed';
import {
  computeTotals, D, dueFromTerms, NEXT_STATUS, nextSeq, paidForInvoice,
  termsDays, todayISO, uid, inr, fmtDate,
} from '../lib/utils';

export type Page = 'dashboard' | 'orders' | 'invoices' | 'clients' | 'vendors' | 'settings';
export interface View { page: Page; params?: Record<string, string> }

export type PrintDoc =
  | { kind: 'invoice'; invoice: Invoice; client: Client }
  | { kind: 'challan'; order: Order; client: Client; challanNo: string }
  | { kind: 'statement'; client: Client; rows: import('../lib/utils').StatementRow[]; totals: { billed: number; received: number; outstanding: number } };

export interface Toast { id: string; msg: string; tone: 'ok' | 'err' | 'info' }

interface AppData {
  clients: Client[]; vendors: Vendor[]; catalog: CatalogItem[]; orders: Order[];
  invoices: Invoice[]; payments: Payment[]; bills: Bill[]; audit: AuditEntry[];
  settings: FactorySettings;
}

interface AppCtx {
  data: AppData | null;
  ready: boolean;
  view: View; go: (page: Page, params?: Record<string, string>) => void;
  theme: 'dark' | 'light'; toggleTheme: () => void;
  online: boolean;
  toasts: Toast[]; toast: (msg: string, tone?: Toast['tone']) => void;
  printDoc: PrintDoc | null; setPrintDoc: (d: PrintDoc | null) => void;
  log: (entity: string, entityId: string, action: string, label: string, detail: string) => Promise<void>;
  saveOrder: (o: Order, isNew: boolean) => Promise<void>;
  setOrderStatus: (id: string, status: OrderStatus, note?: string) => Promise<void>;
  createInvoiceFromOrder: (orderId: string) => Promise<Invoice | null>;
  recordPayment: (p: { clientId: string; invoiceId?: string; amount: number; method: Payment['method']; ref: string; note: string; date: string }) => Promise<void>;
  recordVendorPayment: (p: { vendorId: string; billId?: string; amount: number; method: Payment['method']; ref: string; note: string; date: string }) => Promise<void>;
  saveBill: (b: Bill, isNew: boolean) => Promise<void>;
  saveClient: (c: Client, isNew: boolean) => Promise<void>;
  saveVendor: (v: Vendor, isNew: boolean) => Promise<void>;
  saveSettings: (s: FactorySettings) => Promise<void>;
  resetDemo: () => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>({ page: 'dashboard' });
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('fc-theme') as 'dark' | 'light') || 'dark');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [printDoc, setPrintDoc] = useState<PrintDoc | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [ready, setReady] = useState(false);
  const seeded = useRef(false);

  const data = useLiveQuery(async () => {
    const [clients, vendors, catalog, orders, invoices, payments, bills, audit, s] =
      await Promise.all([
        db.clients.toArray(), db.vendors.toArray(), db.catalog.toArray(),
        db.orders.toArray(), db.invoices.toArray(), db.payments.toArray(),
        db.bills.toArray(), db.audit.orderBy('ts').reverse().toArray(),
        db.settings.get('factory'),
      ]);
    return { clients, vendors, catalog, orders, invoices, payments, bills, audit, settings: s ?? DEFAULT_SETTINGS };
  }, []);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    (async () => {
      try {
        if ((await db.catalog.count()) === 0) await seedDatabase();
      } catch (e) { console.error('seed failed', e); }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('fc-theme', theme);
  }, [theme]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  const toast = useCallback((msg: string, tone: Toast['tone'] = 'ok') => {
    const id = uid();
    setToasts((t) => [...t, { id, msg, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const go = useCallback((page: Page, params?: Record<string, string>) => {
    setView({ page, params });
    window.scrollTo({ top: 0 });
  }, []);

  const log = useCallback(async (entity: string, entityId: string, action: string, label: string, detail: string) => {
    await db.audit.add({ id: uid(), ts: todayISO(), entity, entityId, action, label, detail });
  }, []);

  /* ---------------- mutations ---------------- */

  const saveOrder = useCallback(async (o: Order, isNew: boolean) => {
    await db.orders.put({ ...o, updatedAt: todayISO() });
    await log('order', o.id, isNew ? 'order.created' : 'order.updated',
      `${o.orderNo} ${isNew ? 'created' : 'updated'}`,
      `${o.items.length} line items · due ${fmtDate(o.dueDate, false)}`);
    toast(isNew ? `Order ${o.orderNo} created` : `Order ${o.orderNo} updated`);
  }, [log, toast]);

  const setOrderStatus = useCallback(async (id: string, status: OrderStatus, note?: string) => {
    const o = await db.orders.get(id);
    if (!o) return;
    await db.orders.update(id, { status, updatedAt: todayISO() });
    await log('order', id, 'order.status', `${o.orderNo} → ${status.replace('_', ' ')}`,
      note ?? NEXT_STATUS[o.status]?.to === status ? 'Advanced via pipeline' : 'Status changed manually');
    toast(`${o.orderNo} moved to “${status.replace(/_/g, ' ')}”`);
  }, [log, toast]);

  const createInvoiceFromOrder = useCallback(async (orderId: string): Promise<Invoice | null> => {
    const all = await Promise.all([db.orders.get(orderId), db.invoices.toArray(), db.clients.toArray()]);
    const order = all[0];
    const existing = all[1];
    if (!order) return null;
    if (existing.some((i) => i.orderId === orderId)) {
      toast('An invoice already exists for this order', 'err');
      return null;
    }
    const client = all[2].find((c) => c.id === order.clientId);
    const settings = (await db.settings.get('factory')) ?? DEFAULT_SETTINGS;
    const t = computeTotals(order.items);
    const inv: Invoice = {
      id: uid(), invoiceNo: nextSeq(settings.invoicePrefix, existing.map((i) => i.invoiceNo)),
      orderId, clientId: order.clientId, date: todayISO(),
      dueDate: dueFromTerms(client?.terms ?? 'Net 15', todayISO()),
      items: order.items, ...t,
      terms: client?.terms ?? 'Net 15', notes: `Against order ${order.orderNo}`, createdAt: todayISO(),
    };
    await db.transaction('rw', [db.invoices, db.orders], async () => {
      await db.invoices.add(inv);
      await db.orders.update(orderId, { status: 'invoiced' as OrderStatus, updatedAt: todayISO() });
    });
    await log('invoice', inv.id, 'invoice.created', `${inv.invoiceNo} raised from ${order.orderNo}`,
      `${inr(inv.total)} billed${client ? ' to ' + client.name : ''}`);
    toast(`Tax invoice ${inv.invoiceNo} generated · ${inr(inv.total)}`);
    return inv;
  }, [log, toast]);

  const recordPayment = useCallback(async (p: { clientId: string; invoiceId?: string; amount: number; method: Payment['method']; ref: string; note: string; date: string }) => {
    const payment: Payment = { id: uid(), direction: 'in', createdAt: todayISO(), ...p };
    await db.payments.add(payment);
    let label = `${inr(p.amount)} received · ${p.method.toUpperCase()}`;
    if (p.invoiceId) {
      const inv = await db.invoices.get(p.invoiceId);
      if (inv) {
        const paid = paidForInvoice(inv.id, await db.payments.toArray());
        if (paid >= inv.total) {
          await log('invoice', inv.id, 'invoice.paid', `${inv.invoiceNo} fully settled`, 'Balance cleared — no dues remaining.');
          label += ` · ${inv.invoiceNo} settled in full`;
        }
      }
    }
    await log('payment', payment.id, 'payment.received', label, p.note || 'Payment recorded');
    toast(`Payment of ${inr(p.amount)} recorded`);
  }, [log, toast]);

  const recordVendorPayment = useCallback(async (p: { vendorId: string; billId?: string; amount: number; method: Payment['method']; ref: string; note: string; date: string }) => {
    const payment: Payment = { id: uid(), direction: 'out', createdAt: todayISO(), ...p };
    await db.payments.add(payment);
    await log('payment', payment.id, 'payment.made', `${inr(p.amount)} paid to supplier`, p.note || 'Vendor payment recorded');
    toast(`Supplier payment of ${inr(p.amount)} recorded`);
  }, [log, toast]);

  const saveBill = useCallback(async (b: Bill, isNew: boolean) => {
    await db.bills.put(b);
    await log('bill', b.id, isNew ? 'bill.recorded' : 'bill.updated', `${b.billNo} ${isNew ? 'recorded' : 'updated'}`, inr(b.amount) + ' vendor bill');
    toast(isNew ? `Bill ${b.billNo} recorded` : `Bill ${b.billNo} updated`);
  }, [log, toast]);

  const saveClient = useCallback(async (c: Client, isNew: boolean) => {
    await db.clients.put(c);
    await log('client', c.id, isNew ? 'client.created' : 'client.updated', `${c.name} ${isNew ? 'added' : 'updated'}`, `${c.city} · ${c.terms}`);
    toast(isNew ? `Client “${c.name}” added to directory` : `Client “${c.name}” updated`);
  }, [log, toast]);

  const saveVendor = useCallback(async (v: Vendor, isNew: boolean) => {
    await db.vendors.put(v);
    await log('vendor', v.id, isNew ? 'vendor.created' : 'vendor.updated', `${v.name} ${isNew ? 'added' : 'updated'}`, v.category);
    toast(isNew ? `Vendor “${v.name}” added` : `Vendor “${v.name}” updated`);
  }, [log, toast]);

  const saveSettings = useCallback(async (s: FactorySettings) => {
    await db.settings.put(s);
    await log('settings', 'factory', 'settings.updated', 'Factory profile saved', 'Invoice header / bank details updated');
    toast('Factory profile saved');
  }, [log, toast]);

  const resetDemo = useCallback(async () => {
    await db.transaction('rw',
      [db.clients, db.vendors, db.catalog, db.orders, db.invoices, db.payments, db.bills, db.audit, db.settings],
      async () => {
        await Promise.all([db.clients.clear(), db.vendors.clear(), db.catalog.clear(),
          db.orders.clear(), db.invoices.clear(), db.payments.clear(), db.bills.clear(),
          db.audit.clear(), db.settings.clear()]);
        await seedDatabase();
      });
    toast('Demo dataset restored', 'info');
  }, [toast]);

  const value = useMemo<AppCtx>(() => ({
    data: data ?? null, ready, view, go, theme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
    online, toasts, toast, printDoc, setPrintDoc, log,
    saveOrder, setOrderStatus, createInvoiceFromOrder, recordPayment,
    recordVendorPayment, saveBill, saveClient, saveVendor, saveSettings, resetDemo,
  }), [data, ready, view, go, theme, online, toasts, toast, printDoc, log, saveOrder,
    setOrderStatus, createInvoiceFromOrder, recordPayment, recordVendorPayment, saveBill,
    saveClient, saveVendor, saveSettings, resetDemo]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export const useDays = termsDays;
export { D };
