import type {
  AuditEntry, Bill, CatalogItem, Client, Invoice, LineItem, Order, Payment, Unit, Vendor,
} from './schema';
import { db, DEFAULT_SETTINGS } from './schema';
import { computeTotals, D, uid } from '../lib/utils';

const Y = String(new Date().getFullYear()).slice(2);

const cat = (sku: string, name: string, unit: Unit, hsn: string, price: number, taxRate: number, stock: number): CatalogItem =>
  ({ id: uid(), sku, name, unit, hsn, wholesalePrice: price, taxRate, stock });

export async function seedDatabase() {
  const catalog: CatalogItem[] = [
    cat('EVS-01', 'EVA Slide Slipper "Metro"', 'pair', '6402', 68, 12, 4200),
    cat('EVS-02', 'Kids Flip-Flop "TinyStep"', 'dozen', '6402', 310, 12, 860),
    cat('SRS-11', 'Sports Runner "Velocity ZX"', 'pair', '6402', 285, 12, 1240),
    cat('CNS-21', 'Canvas Sneaker "StreetLo"', 'pair', '6402', 240, 12, 980),
    cat('BTS-31', 'Bathroom Slide "AquaSoft"', 'box', '6402', 520, 12, 340),
    cat('MGB-41', 'Monsoon Gumboot "TerraDry"', 'pair', '6403', 315, 18, 720),
    cat('SCH-51', 'School Shoe "Scholar Black"', 'pair', '6403', 198, 12, 1560),
    cat('LDF-61', 'Ladies Flat "Bella"', 'pair', '6402', 225, 12, 890),
    cat('PUS-71', 'PU Insole Sheet 3mm', 'kg', '3921', 145, 18, 520),
    cat('LAC-81', 'Shoe Lace Set (Assorted)', 'dozen', '6307', 96, 5, 1400),
  ];
  const bySku = (sku: string) => catalog.find((c) => c.sku === sku)!;

  const cli = (name: string, contact: string, phone: string, email: string, gstin: string,
    address: string, city: string, state: string, terms: string, age: number): Client =>
    ({ id: uid(), name, contact, phone, email, gstin, address, city, state, terms, createdAt: D(-age) });

  const clients: Client[] = [
    cli('Mahavir Footwear Mart', 'Rohit Mahavir', '98110 24365', 'orders@mahavirfootwear.in', '07AAACM4218G1Z5', 'Shop 118-119, Sadar Bazaar', 'Delhi', 'Delhi', 'Net 30', 420),
    cli('Agarwal & Sons', 'Suresh Agarwal', '98290 77412', 'agarwalsons.jpr@gmail.com', '08AAKCA9312P1ZQ', '14, Johari Bazaar Road', 'Jaipur', 'Rajasthan', 'Net 15', 380),
    cli('New Star Traders', 'Gurpreet Singh', '98761 55210', 'newstar.lud@outlook.com', '03AAJCN5527R1Z8', 'B-22, Industrial Area-B', 'Ludhiana', 'Punjab', 'Net 30', 300),
    cli('Balaji Retail Chain', 'Anil Verma', '99350 88771', 'purchase@balajiretail.co.in', '09AAGCB8814M1Z2', '7/112, Swaroop Nagar', 'Kanpur', 'Uttar Pradesh', 'Cash on Delivery', 260),
    cli('Eastern Footwear Co.', 'Md. Imran', '98350 41129', 'easternfootwear.pat@gmail.com', '10AAHCE2201N1Z6', '31, Boring Road', 'Patna', 'Bihar', 'Net 15', 210),
  ];

  const ven = (name: string, contact: string, phone: string, gstin: string, address: string, category: string): Vendor =>
    ({ id: uid(), name, contact, phone, gstin, address, category, createdAt: D(-400) });

  const vendors: Vendor[] = [
    ven('Sunrise Polymer Granules', 'Vikram Sethi', '98104 22981', '07AAGCS8812K1Z3', 'Naraina Industrial Area, New Delhi', 'EVA / PU Raw Material'),
    ven('Arora Packaging Co.', 'Hemant Arora', '98991 40026', '06AAACA5519R1Z7', 'Sector 6, IMT Manesar, Gurugram', 'Cartons & Packaging'),
    ven('Om Chemicals & Adhesives', 'Deepak Om', '98735 66410', '07AABCO2248H1Z9', 'Mayapuri Phase-I, New Delhi', 'Solvents & Adhesives'),
  ];

  const li = (sku: string, qty: number, batchNo: string, discountPct = 0, price?: number): LineItem => {
    const c = bySku(sku);
    return {
      catalogId: c.id, sku: c.sku, name: c.name, hsn: c.hsn, batchNo, qty,
      unit: c.unit, unitPrice: price ?? c.wholesalePrice, discountPct, taxRate: c.taxRate,
    };
  };

  const ord = (no: number, client: Client, age: number, dueIn: number,
    status: Order['status'], items: LineItem[], notes = ''): Order =>
    ({
      id: uid(), orderNo: `ORD-${no}`, clientId: client.id, date: D(-age),
      dueDate: D(dueIn), status, items, notes, createdAt: D(-age), updatedAt: D(-Math.max(0, age - 2)),
    });

  const orders: Order[] = [
    ord(1038, clients[2], 55, -40, 'invoiced', [li('SRS-11', 120, 'SR-2408-A'), li('EVS-01', 300, 'EV-1102-A')], 'Repeat monthly runner order.'),
    ord(1040, clients[4], 40, -30, 'cancelled', [li('MGB-41', 100, 'MG-0701-B')], 'Cancelled by buyer — monsoon stock revised.'),
    ord(1041, clients[0], 32, -20, 'invoiced', [li('EVS-01', 500, 'EV-1102-B'), li('SCH-51', 150, 'SC-3301-A')]),
    ord(1042, clients[1], 18, -6, 'invoiced', [li('CNS-21', 144, 'CN-1204-A'), li('LAC-81', 60, 'LC-0091-C')], 'Packed in branded cartons.'),
    ord(1043, clients[2], 6, 2, 'dispatched', [li('MGB-41', 240, 'MG-0901-A')], 'Sent via VRL Roadlines, LR copy with driver.'),
    ord(1044, clients[3], 3, 0, 'delivered', [li('EVS-02', 90, 'TF-0455-B'), li('BTS-31', 40, 'AQ-0231-A')], 'COD client — invoice pending.'),
    ord(1045, clients[0], 1, 6, 'in_production', [li('SRS-11', 200, 'SR-1115-C', 2), li('EVS-01', 400, 'EV-1130-A')], 'Mould change on line 2 for ZX colourway.'),
    ord(1046, clients[4], 0, 10, 'confirmed', [li('SCH-51', 300, 'SC-3302-B'), li('LDF-61', 120, 'BL-0618-A')], 'Back-to-school demand; prioritise.', ),
    ord(1047, clients[1], 0, 14, 'draft', [li('EVS-01', 250, 'EV-1131-C')], 'Awaiting final size-ratio from buyer.'),
  ];

  const mkInv = (seq: number, client: Client, age: number, dueIn: number,
    items: LineItem[], orderId?: string, terms?: string, notes = ''): Invoice => {
    const t = computeTotals(items);
    return {
      id: uid(), invoiceNo: `INV-${Y}-${String(seq).padStart(4, '0')}`, orderId,
      clientId: client.id, date: D(-age), dueDate: D(dueIn), items,
      ...t, terms: terms ?? client.terms, notes, createdAt: D(-age),
    };
  };

  const invoices: Invoice[] = [
    mkInv(171, clients[0], 150, -120, [li('EVS-01', 800, 'EV-1010-A'), li('EVS-02', 120, 'TF-0410-B')], undefined, undefined, 'Season opening stock.'),
    mkInv(176, clients[2], 118, -88, [li('CNS-21', 200, 'CN-1102-A'), li('SRS-11', 96, 'SR-2310-B')]),
    mkInv(182, clients[1], 92, -62, [li('SCH-51', 400, 'SC-3210-A'), li('LAC-81', 100, 'LC-0082-B')]),
    mkInv(189, clients[3], 66, -51, [li('EVS-01', 600, 'EV-1064-A'), li('BTS-31', 60, 'AQ-0212-C')], undefined, 'Cash on Delivery'),
    mkInv(193, clients[4], 58, -28, [li('SRS-11', 160, 'SR-2391-C'), li('LDF-61', 90, 'BL-0602-A')], undefined, undefined, '₹20,000 received on account; balance promised this week.'),
    mkInv(197, clients[2], 55, -25, [li('SRS-11', 120, 'SR-2408-A'), li('EVS-01', 300, 'EV-1102-A')], orders[0].id),
    mkInv(203, clients[0], 32, -2, [li('EVS-01', 500, 'EV-1102-B'), li('SCH-51', 150, 'SC-3301-A')], orders[2].id),
    mkInv(208, clients[1], 18, 5, [li('CNS-21', 144, 'CN-1204-A'), li('LAC-81', 60, 'LC-0091-C')], orders[3].id),
    mkInv(214, clients[1], 38, -8, [li('EVS-02', 80, 'TF-0441-A'), li('LDF-61', 60, 'BL-0611-B')]),
    mkInv(219, clients[2], 9, 6, [li('MGB-41', 150, 'MG-0901-A')]),
    mkInv(221, clients[3], 2, 13, [li('EVS-01', 700, 'EV-1131-A'), li('PUS-71', 40, 'PU-0718-B')], undefined, 'Cash on Delivery', 'Advance of ₹5,000 adjusted against next billing.'),
  ];

  const pay = (daysAgo: number, amount: number, method: Payment['method'],
    ref: string, note: string, extra: Partial<Payment>): Payment =>
    ({ id: uid(), date: D(-daysAgo), direction: 'in', amount, method, ref, note, createdAt: D(-daysAgo), ...extra });

  const payments: Payment[] = [
    pay(145, invoices[0].total, 'bank', 'NEFT-88123', 'Full & final settlement', { clientId: clients[0].id, invoiceId: invoices[0].id }),
    pay(110, invoices[1].total, 'upi', 'UPI-771205', 'Payment against INV', { clientId: clients[2].id, invoiceId: invoices[1].id }),
    pay(88, invoices[2].total, 'bank', 'IMPS-445190', 'Full payment', { clientId: clients[1].id, invoiceId: invoices[2].id }),
    pay(60, invoices[3].total, 'cheque', 'CHQ-445211', 'COD collected at delivery', { clientId: clients[3].id, invoiceId: invoices[3].id }),
    pay(30, 20000, 'upi', 'UPI-812260', 'Part payment — balance next week', { clientId: clients[4].id, invoiceId: invoices[4].id }),
    pay(50, invoices[5].total, 'bank', 'NEFT-903317', 'Against ORD-1038', { clientId: clients[2].id, invoiceId: invoices[5].id }),
    pay(25, invoices[6].total, 'bank', 'NEFT-918842', 'Against ORD-1041', { clientId: clients[0].id, invoiceId: invoices[6].id }),
    pay(10, 15000, 'upi', 'UPI-903118', 'Part payment received', { clientId: clients[1].id, invoiceId: invoices[7].id }),
    pay(4, 5000, 'cash', 'RCP-2291', 'Advance against next order', { clientId: clients[3].id }),
    { id: uid(), date: D(-70), direction: 'out', vendorId: vendors[0].id, billId: 'b-pending', amount: 142000, method: 'bank', ref: 'NEFT-770213', note: 'Full payment — EVA granules', createdAt: D(-70) },
    { id: uid(), date: D(-45), direction: 'out', vendorId: vendors[2].id, billId: 'b-pending2', amount: 38500, method: 'bank', ref: 'IMPS-331806', note: 'Adhesives bill cleared', createdAt: D(-45) },
    { id: uid(), date: D(-20), direction: 'out', vendorId: vendors[0].id, billId: 'b-pending3', amount: 50000, method: 'bank', ref: 'NEFT-804419', note: 'Part payment against BL-9034', createdAt: D(-20) },
  ];

  const bills: Bill[] = [
    { id: uid(), billNo: 'BL-8821', vendorId: vendors[0].id, date: D(-75), dueDate: D(-45), description: 'EVA granules — 4.2 MT (natural + black)', amount: 142000, createdAt: D(-75) },
    { id: uid(), billNo: 'BL-1107', vendorId: vendors[2].id, date: D(-50), dueDate: D(-35), description: 'PU adhesive & solvent drums (200L × 4)', amount: 38500, createdAt: D(-50) },
    { id: uid(), billNo: 'BL-9034', vendorId: vendors[0].id, date: D(-28), dueDate: D(-13), description: 'EVA granules — 2.8 MT monsoon batch', amount: 96800, createdAt: D(-28) },
    { id: uid(), billNo: 'BL-2216', vendorId: vendors[1].id, date: D(-15), dueDate: D(5), description: 'Corrugated cartons 5-ply (2,400 pcs)', amount: 21300, createdAt: D(-15) },
    { id: uid(), billNo: 'BL-9177', vendorId: vendors[0].id, date: D(-6), dueDate: D(12), description: 'Masterbatch colourant — red / navy', amount: 118400, createdAt: D(-6) },
    { id: uid(), billNo: 'BL-1142', vendorId: vendors[2].id, date: D(-2), dueDate: D(-1), description: 'Solvent top-up (thinner NT-90)', amount: 17650, createdAt: D(-2) },
  ];
  payments[9].billId = bills[0].id;
  payments[10].billId = bills[1].id;
  payments[11].billId = bills[2].id;

  const aud = (hoursAgo: number, entity: string, entityId: string, action: string, label: string, detail: string): AuditEntry =>
    ({ id: uid(), ts: new Date(Date.now() - hoursAgo * 3600000).toISOString(), entity, entityId, action, label, detail });

  const audit: AuditEntry[] = [
    aud(1, 'order', orders[7].id, 'order.status', `ORD-1046 → Confirmed`, 'Confirmed by S. Agarwal over phone; advance expected.'),
    aud(3, 'invoice', invoices[10].id, 'invoice.created', `INV-${Y}-0221 raised`, `₹60,156 billed to Balaji Retail Chain.`),
    aud(26, 'order', orders[5].id, 'order.status', 'ORD-1044 → Delivered', 'POD signed by store in-charge, Swaroop Nagar.'),
    aud(49, 'payment', payments[7].id, 'payment.received', '₹15,000 · UPI', 'Part payment from Agarwal & Sons against INV-0208.'),
    aud(74, 'order', orders[4].id, 'order.status', 'ORD-1043 → Dispatched', 'Handed to VRL Roadlines; DC-1187 issued.'),
    aud(120, 'bill', bills[5].id, 'bill.recorded', 'BL-1142 recorded', 'Om Chemicals solvent top-up ₹17,650.'),
    aud(170, 'payment', payments[6].id, 'payment.received', '₹72,228 · NEFT', 'Mahavir Footwear Mart cleared INV-0203 in full.'),
    aud(240, 'invoice', invoices[9].id, 'invoice.created', `INV-${Y}-0219 raised`, 'New Star Traders gumboot lot billed.'),
    aud(300, 'order', orders[1].id, 'order.status', 'ORD-1040 → Cancelled', 'Buyer revised monsoon plan; stock returned to pool.'),
    aud(360, 'settings', 'factory', 'settings.updated', 'Bank details updated', 'IFSC re-verified for PNB Industrial Area branch.'),
  ];

  await db.transaction(
    'rw',
    [db.clients, db.vendors, db.catalog, db.orders, db.invoices, db.payments, db.bills, db.audit, db.settings],
    async () => {
      await db.clients.bulkAdd(clients);
      await db.vendors.bulkAdd(vendors);
      await db.catalog.bulkAdd(catalog);
      await db.orders.bulkAdd(orders);
      await db.invoices.bulkAdd(invoices);
      await db.payments.bulkAdd(payments);
      await db.bills.bulkAdd(bills);
      await db.audit.bulkAdd(audit);
      await db.settings.put(DEFAULT_SETTINGS);
    },
  );
}
