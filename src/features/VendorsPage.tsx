import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Receipt, Search, Package, AlertTriangle } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Field, Modal, Seg, StatusBadge, Empty, PageHead } from '../components/ui';
import {
  billStatus, INV_STATUS_META, paidForBill, inr, fmtDate, daysFromToday, todayISO, uid,
  D, PAY_METHODS, methodLabel,
} from '../lib/utils';
import type { Bill, PayMethod, Vendor } from '../db/schema';

function VendorEditor({ open, initial, onClose }: { open: boolean; initial: Vendor | null; onClose: () => void }) {
  const { saveVendor } = useApp();
  const [f, setF] = useState<Partial<Vendor>>({});
  useEffect(() => { if (open) setF(initial ? { ...initial } : {}); }, [open, initial]);
  const set = (k: keyof Vendor, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit ${initial.name}` : 'New supplier / vendor'}
      subtitle="Payable account opens with the first bill you record"
      footer={<>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!f.name || !f.phone} onClick={async () => {
          await saveVendor({
            id: initial?.id ?? uid(), name: f.name ?? '', contact: f.contact ?? '', phone: f.phone ?? '',
            gstin: f.gstin ?? '', address: f.address ?? '', category: f.category ?? 'Raw Material',
            createdAt: initial?.createdAt ?? todayISO(),
          }, !initial);
          onClose();
        }}>{initial ? 'Save changes' : 'Add vendor'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vendor name" className="col-span-2"><input className="input" value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Contact person"><input className="input" value={f.contact ?? ''} onChange={(e) => set('contact', e.target.value)} /></Field>
        <Field label="Phone"><input className="input mono" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="GSTIN"><input className="input mono" value={f.gstin ?? ''} onChange={(e) => set('gstin', e.target.value)} /></Field>
        <Field label="Category">
          <select className="input" value={f.category ?? 'Raw Material'} onChange={(e) => set('category', e.target.value)}>
            {['Raw Material', 'Packaging', 'Chemicals', 'Machinery & Spares', 'Logistics', 'Utilities'].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Address" className="col-span-2"><input className="input" value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function BillEditor({ open, initial, onClose }: { open: boolean; initial: Bill | null; onClose: () => void }) {
  const { data, saveBill } = useApp();
  const [f, setF] = useState<Partial<Bill>>({});
  useEffect(() => {
    if (open) setF(initial ? { ...initial } : {
      vendorId: data?.vendors[0]?.id, date: todayISO().slice(0, 10), dueDate: D(15).slice(0, 10),
    });
  }, [open, initial, data]);
  if (!data) return null;
  const valid = f.vendorId && f.amount && Number(f.amount) > 0 && f.billNo;
  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit ${initial.billNo}` : 'Record vendor bill'}
      subtitle="Raw-material purchase, packing material or any payable"
      footer={<>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid} onClick={async () => {
          await saveBill({
            id: initial?.id ?? uid(), billNo: f.billNo ?? '', vendorId: f.vendorId ?? '',
            date: new Date((f.date ?? todayISO().slice(0, 10)) + 'T10:00:00').toISOString(),
            dueDate: new Date((f.dueDate ?? D(15).slice(0, 10)) + 'T10:00:00').toISOString(),
            description: f.description ?? '', amount: Number(f.amount),
            createdAt: initial?.createdAt ?? todayISO(),
          }, !initial);
          onClose();
        }}>{initial ? 'Save bill' : 'Add bill'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vendor" className="col-span-2">
          <select className="input" value={f.vendorId ?? ''} onChange={(e) => setF((x) => ({ ...x, vendorId: e.target.value }))}>
            {data.vendors.map((v) => <option key={v.id} value={v.id}>{v.name} — {v.category}</option>)}
          </select>
        </Field>
        <Field label="Bill no."><input className="input mono" placeholder="BL-9180" value={f.billNo ?? ''} onChange={(e) => setF((x) => ({ ...x, billNo: e.target.value }))} /></Field>
        <Field label="Amount (₹ incl. GST)"><input type="number" min={0} className="input mono" value={f.amount ?? ''} onChange={(e) => setF((x) => ({ ...x, amount: Number(e.target.value) }))} /></Field>
        <Field label="Bill date"><input type="date" className="input" value={f.date?.slice(0, 10) ?? ''} onChange={(e) => setF((x) => ({ ...x, date: e.target.value }))} /></Field>
        <Field label="Payment due"><input type="date" className="input" value={f.dueDate?.slice(0, 10) ?? ''} onChange={(e) => setF((x) => ({ ...x, dueDate: e.target.value }))} /></Field>
        <Field label="Description" className="col-span-2">
          <input className="input" placeholder="e.g. EVA granules — 3 MT natural" value={f.description ?? ''} onChange={(e) => setF((x) => ({ ...x, description: e.target.value }))} />
        </Field>
      </div>
    </Modal>
  );
}

function VendorPayModal({ bill, onClose }: { bill: Bill; onClose: () => void }) {
  const { recordVendorPayment } = useApp();
  const { data } = useApp();
  const paid = data ? paidForBill(bill.id, data.payments) : 0;
  const due = Math.max(0, bill.amount - paid);
  const [amount, setAmount] = useState(String(due));
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [method, setMethod] = useState<PayMethod>('bank');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => { setAmount(String(due)); }, [due]);
  return (
    <Modal open onClose={onClose} title={`Pay against ${bill.billNo}`}
      subtitle={`Balance due ${inr(due)} · partial payments allowed`}
      footer={<>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!(Number(amount) > 0)} onClick={async () => {
          await recordVendorPayment({
            vendorId: bill.vendorId, billId: bill.id, amount: Number(amount), method, ref, note,
            date: new Date(date + 'T12:00:00').toISOString(),
          });
          onClose();
        }}><Receipt size={14} /> Record payment</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount paid (₹)">
          <input type="number" min={0} className="input mono" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Payment date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Mode" className="col-span-2">
          <Seg options={PAY_METHODS.map((p) => ({ id: p.id, label: p.label }))} value={method} onChange={(v) => setMethod(v as PayMethod)} />
        </Field>
        <Field label="Reference no."><input className="input mono" placeholder="NEFT / UTR" value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function VendorsPage() {
  const { data } = useApp();
  const [selId, setSelId] = useState<string | 'all'>('all');
  const [query, setQuery] = useState('');
  const [vendorEditor, setVendorEditor] = useState<{ open: boolean; v: Vendor | null }>({ open: false, v: null });
  const [billEditor, setBillEditor] = useState<{ open: boolean; b: Bill | null }>({ open: false, b: null });
  const [payBill, setPayBill] = useState<Bill | null>(null);

  const enriched = useMemo(() => {
    if (!data) return [];
    return data.bills.map((b) => {
      const paid = paidForBill(b.id, data.payments);
      return { b, paid, status: billStatus(b, paid), due: Math.max(0, b.amount - paid) };
    }).sort((a, x) => x.b.date.localeCompare(a.b.date));
  }, [data]);

  const totals = useMemo(() => ({
    payable: enriched.reduce((s, e) => s + e.due, 0),
    overdue: enriched.filter((e) => e.status === 'overdue').reduce((s, e) => s + e.due, 0),
    open: enriched.filter((e) => e.status !== 'paid').length,
  }), [enriched]);

  const rows = useMemo(() => enriched
    .filter((e) => selId === 'all' || e.b.vendorId === selId)
    .filter((e) => {
      if (!query.trim()) return true;
      const s = query.toLowerCase();
      return e.b.billNo.toLowerCase().includes(s) || e.b.description.toLowerCase().includes(s);
    }), [enriched, selId, query]);

  if (!data) return null;
  const vendorName = (id: string) => data.vendors.find((v) => v.id === id)?.name ?? '—';

  return (
    <div>
      <PageHead kicker="Accounts payable" title="Vendor bills & supplier dues"
        right={<>
          <button className="btn-outline btn-sm" onClick={() => setVendorEditor({ open: true, v: null })}><Plus size={13} /> Vendor</button>
          <button className="btn-primary btn-sm" onClick={() => setBillEditor({ open: true, b: null })}><Plus size={14} /> Record bill</button>
        </>} />

      <div className="grid grid-cols-3 gap-3.5 mb-4">
        {[
          ['Payables outstanding', inr(totals.payable), 'text-ink'],
          ['Overdue to suppliers', inr(totals.overdue), totals.overdue > 0 ? 'text-rose-500' : 'text-emerald-500'],
          ['Open bills', String(totals.open), 'text-ink'],
        ].map(([k, v, cls]) => (
          <div key={k} className="card p-3.5">
            <p className="text-[10.5px] font-bold uppercase tracking-[.12em] text-mut">{k}</p>
            <p className={`mono font-semibold text-[20px] mt-1 ${cls}`}>{v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className={`chip ${selId === 'all' ? 'chip-on' : ''}`} onClick={() => setSelId('all')}>All vendors</button>
        {data.vendors.map((v) => (
          <button key={v.id} className={`chip ${selId === v.id ? 'chip-on' : ''}`} onClick={() => setSelId(v.id)}>
            {v.name.split(' ')[0]} {v.name.split(' ')[1] ?? ''}
          </button>
        ))}
        <div className="relative ml-auto w-[210px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mut" />
          <input className="input h-8 pl-7 text-xs" placeholder="Search bills…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[780px]">
          <thead>
            <tr>
              <th>Bill</th><th>Vendor</th><th>Description</th><th>Billed</th><th>Due</th>
              <th className="text-right">Amount</th><th className="text-right">Paid</th><th>Status</th><th />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ b, paid, status, due }) => {
              const late = daysFromToday(b.dueDate) < 0 && status !== 'paid';
              return (
                <motion.tr key={b.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td>
                    <button className="text-[12.5px] font-bold text-ink hover:text-accent transition-colors cursor-pointer"
                      onClick={() => setBillEditor({ open: true, b })}>{b.billNo}</button>
                  </td>
                  <td className="text-[12.5px] font-semibold text-ink">{vendorName(b.vendorId)}</td>
                  <td className="text-[12px] text-mut max-w-[240px] truncate">{b.description}</td>
                  <td className="mono text-[12px] text-mut whitespace-nowrap">{fmtDate(b.date, false)}</td>
                  <td className={`mono text-[12px] font-semibold whitespace-nowrap ${late ? 'text-rose-500' : 'text-mut'}`}>
                    {fmtDate(b.dueDate, false)}{late && <AlertTriangle size={11} className="inline ml-1 -mt-0.5" />}
                  </td>
                  <td className="mono text-[12.5px] font-bold text-ink text-right">{inr(b.amount)}</td>
                  <td className="mono text-[12px] text-emerald-500 text-right">{paid > 0 ? inr(paid) : '—'}</td>
                  <td><StatusBadge tone={INV_STATUS_META[status].tone} pulse={status === 'overdue'}>{INV_STATUS_META[status].label}</StatusBadge></td>
                  <td className="text-right">
                    {status !== 'paid' && (
                      <button className="btn-primary btn-xs" onClick={() => setPayBill(b)}><Receipt size={11} /> Pay {due > 0 && due < b.amount ? inr(due) : ''}</button>
                    )}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && <Empty title="No vendor bills" hint="Record a raw-material bill to start tracking payables."
          action={<button className="btn-primary btn-sm" onClick={() => setBillEditor({ open: true, b: null })}><Package size={13} /> Record bill</button>} />}
      </div>

      <p className="text-[11px] text-mut mt-3">
        Supplier payments post to the cash-flow chart on the Command Deck and the audit trail automatically.
      </p>

      <VendorEditor open={vendorEditor.open} initial={vendorEditor.v} onClose={() => setVendorEditor({ open: false, v: null })} />
      {billEditor.open && <BillEditor open initial={billEditor.b} onClose={() => setBillEditor({ open: false, b: null })} />}
      {payBill && <VendorPayModal bill={payBill} onClose={() => setPayBill(null)} />}
    </div>
  );
}
