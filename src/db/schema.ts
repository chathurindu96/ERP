import Dexie, { type Table } from 'dexie';

export type Unit = 'pair' | 'box' | 'dozen' | 'kg' | 'pc';
export type OrderStatus =
  | 'draft' | 'confirmed' | 'in_production' | 'ready'
  | 'dispatched' | 'delivered' | 'invoiced' | 'cancelled';
export type PayMethod = 'cash' | 'bank' | 'cheque' | 'upi';

export interface LineItem {
  catalogId: string;
  sku: string;
  name: string;
  hsn: string;
  batchNo: string;
  qty: number;
  unit: Unit;
  unitPrice: number;
  discountPct: number;
  taxRate: number;
}

export interface Client {
  id: string; name: string; contact: string; phone: string; email: string;
  gstin: string; address: string; city: string; state: string; terms: string;
  notes?: string; createdAt: string;
}

export interface Vendor {
  id: string; name: string; contact: string; phone: string; gstin: string;
  address: string; category: string; createdAt: string;
}

export interface CatalogItem {
  id: string; sku: string; name: string; unit: Unit; hsn: string;
  wholesalePrice: number; taxRate: number; stock: number;
}

export interface Order {
  id: string; orderNo: string; clientId: string; date: string; dueDate: string;
  status: OrderStatus; items: LineItem[]; notes: string;
  createdAt: string; updatedAt: string;
}

export interface Invoice {
  id: string; invoiceNo: string; orderId?: string; clientId: string;
  date: string; dueDate: string; items: LineItem[];
  subTotal: number; discountAmt: number; taxAmt: number;
  cgst: number; sgst: number; roundOff: number; total: number;
  terms: string; notes: string; createdAt: string;
}

export interface Payment {
  id: string; date: string; direction: 'in' | 'out';
  clientId?: string; vendorId?: string; invoiceId?: string; billId?: string;
  amount: number; method: PayMethod; ref: string; note: string; createdAt: string;
}

export interface Bill {
  id: string; billNo: string; vendorId: string; date: string; dueDate: string;
  description: string; amount: number; createdAt: string;
}

export interface AuditEntry {
  id: string; ts: string; entity: string; entityId: string;
  action: string; detail: string; label: string;
}

export interface FactorySettings {
  id: 'factory';
  name: string; tagline: string; gstin: string; address: string;
  phone: string; email: string; invoicePrefix: string; challanPrefix: string;
  defaultTerms: string; bankName: string; bankAccount: string; ifsc: string;
  bankBranch: string; invoiceFooter: string; logo?: string;
}

class FactoryCoreDB extends Dexie {
  clients!: Table<Client, string>;
  vendors!: Table<Vendor, string>;
  catalog!: Table<CatalogItem, string>;
  orders!: Table<Order, string>;
  invoices!: Table<Invoice, string>;
  payments!: Table<Payment, string>;
  bills!: Table<Bill, string>;
  audit!: Table<AuditEntry, string>;
  settings!: Table<FactorySettings, string>;

  constructor() {
    super('factorycore');
    this.version(1).stores({
      clients: 'id, name',
      vendors: 'id, name',
      catalog: 'id, sku, name',
      orders: 'id, orderNo, clientId, status, date',
      invoices: 'id, invoiceNo, clientId, date',
      payments: 'id, clientId, vendorId, invoiceId, billId, date',
      bills: 'id, vendorId, date',
      audit: 'id, ts',
      settings: 'id',
    });
  }
}

export const db = new FactoryCoreDB();

export const DEFAULT_SETTINGS: FactorySettings = {
  id: 'factory',
  name: 'Krishna Polyfoot Industries',
  tagline: 'Manufacturer & Wholesale Distributor — EVA / Sports / Canvas Footwear',
  gstin: '06AABCK7743F1ZC',
  address: 'Plot 42, Industrial Area Phase-II, Bahadurgarh, Haryana 124507',
  phone: '+91 98761 44021',
  email: 'accounts@krishnapolyfoot.in',
  invoicePrefix: 'INV',
  challanPrefix: 'DC',
  defaultTerms: 'Net 15',
  bankName: 'Punjab National Bank',
  bankAccount: '3140 0021 8876',
  ifsc: 'PUNB0314000',
  bankBranch: 'Industrial Area, Bahadurgarh',
  invoiceFooter: 'Goods once sold will not be taken back. Interest @18% p.a. on overdue balances. Subject to Bahadurgarh jurisdiction only.',
};
