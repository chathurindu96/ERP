import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import { Printer, MessageCircle, Mail, Receipt, Search, ChevronRight, FileText } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Drawer, Field, Modal, Seg, StatusBadge, Empty, PageHead } from '../components/ui';
import {
  invStatus, INV_STATUS_META, paidForInvoice, inr, fmtDate, daysFromToday, todayISO,
  PAY_METHODS, methodLabel, clientOf, type InvStatus,
} from '../lib/utils';
import type { Invoice, PayMethod } from '../db/schema';

const col = createColumnHelper<Invoice>();

export function PaymentModal({ open, onClose, clientId, invoiceId, defaultAmount, title }: {
  open: boolean; onClose: () => void; clientId: string; invoiceId?: string;
  defaultAmount: number; title: string;
}) {
  const { recordPayment } = useApp();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [method, setMethod] = useState<PayMethod>('bank');
  const [ref, setRef] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setAmount(defaultAmount > 0 ? String(defaultAmount) : '');
      setDate(todayISO().slice(0, 10));
      setMethod('bank'); setRef(''); setNote('');
    }
  }, [open, defaultAmount]);

  const amt = Number(amount);
  const valid = amt > 0 && date;

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle="Balance auto-adjusts across the ledger the moment you save"
      footer={<>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid} onClick={async () => {
          await recordPayment({
            clientId, invoiceId, amount: amt, method, ref, note,
            date: new Date(date + 'T12:00:00').toISOString(),
          });
          onClose();
        }}><Receipt size={14} /> Record payment</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount received (₹)">
          <input type="number" min={0} className="input mono" value={amount} placeholder="0"
            onChange={(e) => setAmount(e.target.value)} autoFocus />
        </Field>
        <Field label="Payment date">
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Mode" className="col-span-2">
          <Seg options={PAY_METHODS.map((p) => ({ id: p.id, label: p.label }))}
            value={method} onChange={(v) => setMethod(v as PayMethod)} />
        </Field>
        <Field label="Reference no.">
          <input className="input mono" placeholder="NEFT / UPI / cheque no." value={ref} onChange={(e) => setRef(e.target.value)} />
        </Field>
        <Field label="Note">
          <input className="input" placeholder="Optional remark" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {invoiceId && defaultAmount > 0 && (
        <button className="btn-outline btn-xs mt-3" onClick={() => setAmount(String(defaultAmount))}>
          Fill balance due · {inr(defaultAmount)}
        </button>
      )}
    </Modal>
  );
}

function InvoiceDrawer({ invoice, onClose, payOpen, setPayOpen }: {
  invoice: Invoice; onClose: () => void; payOpen: boolean; setPayOpen: (v: boolean) => void;
}) {
  const { data, setPrintDoc, log, toast, go } = useApp();
  if (!data) return null;
  const client = clientOf(data.clients, invoice.clientId);
  const paid = paidForInvoice(invoice.id, data.payments);
  const balance = Math.max(0, invoice.total - paid);
  const st = invStatus(invoice, paid);
  const meta = INV_STATUS_META[st];
  const pays = data.payments
    .filter((p) => p.invoiceId === invoice.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const order = invoice.orderId ? data.orders.find((o) => o.id === invoice.orderId) : undefined;

  return (
    <>
      <Drawer open onClose={onClose} width="max-w-2xl"
        title={<span className="flex items-center gap-2.5">{invoice.invoiceNo} <StatusBadge tone={meta.tone} pulse={st === 'overdue'}>{meta.label}</StatusBadge></span>}
        subtitle={`Billed to ${client?.name} on ${fmtDate(invoice.date)} · due ${fmtDate(invoice.dueDate)} (${invoice.terms})`}
        footer={
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary btn-sm" disabled={balance <= 0} onClick={() => setPayOpen(true)}>
              <Receipt size={13} /> Record payment {balance > 0 && `· ${inr(balance)}`}
            </button>
            <button className="btn-outline btn-sm" onClick={() => client && setPrintDoc({ kind: 'invoice', invoice, client })}>
              <Printer size={13} /> Print / PDF
            </button>
            {client && (
              <>
                <a className="btn btn-sm bg-emerald-600/15 border border-emerald-500/40 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-600/25" target="_blank" rel="noreferrer"
                  href={`https://wa.me/?text=${encodeURIComponent(`Dear ${client.contact}, your invoice ${invoice.invoiceNo} for ${inr(invoice.total)} is due ${fmtDate(invoice.dueDate)}. — ${data.settings.name}`)}`}
                  onClick={() => log('reminder', invoice.id, 'reminder.sent', `Invoice shared → ${client.name}`, 'WhatsApp share triggered from invoice drawer')}>
                  <MessageCircle size={13} /> WhatsApp
                </a>
                <a className="btn-outline btn-sm"
                  href={`mailto:${client.email}?subject=${encodeURIComponent('Tax Invoice ' + invoice.invoiceNo)}&body=${encodeURIComponent(`Dear ${client.contact},\n\nPlease find the details of invoice ${invoice.invoiceNo} dated ${fmtDate(invoice.date)} for ${inr(invoice.total)} (due ${fmtDate(invoice.dueDate)}).\n\nRegards,\n${data.settings.name}`)}`}>
                  <Mail size={13} /> Email
                </a>
              </>
            )}
            {order && (
              <button className="btn-ghost btn-sm" onClick={() => { onClose(); go('orders', { orderId: order.id }); }}>
                Source {order.orderNo} <ChevronRight size={13} />
              </button>
            )}
          </div>
        }>
        {/* amounts strip */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          {[
            ['Invoice value', inr(invoice.total), 'text-ink'],
            ['Received', inr(paid), 'text-emerald-500'],
            ['Balance due', inr(balance), balance > 0 && st === 'overdue' ? 'text-rose-500' : 'text-ink'],
          ].map(([k, v, cls]) => (
            <div key={k as string} className="rounded-md border border-line bg-panel2/40 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-mut">{k}</p>
              <p className={`mono font-bold text-[16px] mt-0.5 ${cls}`}>{v}</p>
            </div>
          ))}
        </div>

        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-panel2/70 text-[10px] uppercase tracking-wider text-mut text-left">
              <tr>
                <th className="px-3 py-2 font-bold">Item</th><th className="px-2 py-2 font-bold">Batch</th>
                <th className="px-2 py-2 font-bold text-right">Qty</th><th className="px-2 py-2 font-bold text-right">Rate</th>
                <th className="px-3 py-2 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="px-3 py-2">
                    <p className="text-[12.5px] font-semibold text-ink">{it.name}</p>
                    <p className="text-[10.5px] text-mut mono">{it.sku} · HSN {it.hsn} · GST {it.taxRate}%</p>
                  </td>
                  <td className="px-2 py-2 mono text-[11.5px] text-mut">{it.batchNo || '—'}</td>
                  <td className="px-2 py-2 mono text-[12px] text-right text-ink">{it.qty.toLocaleString('en-IN')} {it.unit}</td>
                  <td className="px-2 py-2 mono text-[12px] text-right text-mut">{inr(it.unitPrice)}</td>
                  <td className="px-3 py-2 mono text-[12.5px] text-right font-semibold text-ink">{inr(it.qty * it.unitPrice * (1 - it.discountPct / 100))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-3 py-2.5 border-t border-line bg-panel2/50 space-y-1">
            <div className="flex justify-between text-[12px] text-mut"><span>Taxable value</span><span className="mono">{inr(invoice.subTotal)}</span></div>
            <div className="flex justify-between text-[12px] text-mut"><span>CGST</span><span className="mono">{inr(invoice.cgst)}</span></div>
            <div className="flex justify-between text-[12px] text-mut"><span>SGST</span><span className="mono">{inr(invoice.sgst)}</span></div>
            {invoice.roundOff !== 0 && <div className="flex justify-between text-[12px] text-mut"><span>Round off</span><span className="mono">{inr(invoice.roundOff)}</span></div>}
            <div className="flex justify-between text-[13.5px] font-bold text-ink pt-1 border-t border-line"><span>Grand total</span><span className="mono">{inr(invoice.total)}</span></div>
          </div>
        </div>

        <h4 className="font-display font-semibold text-[13px] text-ink mt-5 mb-2">Payments received against this invoice</h4>
        {pays.length === 0 ? (
          <p className="text-xs text-mut">No payments yet — the first receipt will appear here and settle the balance automatically.</p>
        ) : (
          <div className="space-y-1.5">
            {pays.map((p) => (
              <div key={p.id} className="flex items-center gap-2.5 rounded-md border border-line bg-panel2/30 px-3 py-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="mono text-[12.5px] font-bold text-emerald-500">{inr(p.amount)}</span>
                <span className="text-[11.5px] text-mut">{methodLabel(p.method)}{p.ref ? ` · ${p.ref}` : ''}</span>
                <span className="mono text-[10.5px] text-mut ml-auto">{fmtDate(p.date, false)}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>
      <PaymentModal open={payOpen} onClose={() => setPayOpen(false)} clientId={invoice.clientId}
        invoiceId={invoice.id} defaultAmount={balance} title={`Payment against ${invoice.invoiceNo}`} />
    </>
  );
}

export function InvoicesPage() {
  const { data, view, setPrintDoc, go } = useApp();
  const [filter, setFilter] = useState<'all' | InvStatus>('all');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const enriched = useMemo(() => {
    if (!data) return [];
    return data.invoices.map((inv) => {
      const paid = paidForInvoice(inv.id, data.payments);
      return { inv, paid, status: invStatus(inv, paid), balance: Math.max(0, inv.total - paid) };
    });
  }, [data]);

  const seenView = useRef<typeof view | null>(null);
  useEffect(() => {
    if (view === seenView.current) return;
    seenView.current = view;
    const id = view.params?.invoiceId;
    if (id && enriched.some((e) => e.inv.id === id)) {
      setOpenId(id);
      setPayOpen(view.params?.pay === '1');
    }
  }, [view, enriched]);

  const rows = useMemo(() => enriched
    .filter((e) => filter === 'all' || e.status === filter)
    .filter((e) => {
      if (!query.trim()) return true;
      const c = data ? clientOf(data.clients, e.inv.clientId) : undefined;
      const s = query.toLowerCase();
      return e.inv.invoiceNo.toLowerCase().includes(s) || (c?.name.toLowerCase().includes(s) ?? false);
    })
    .map((e) => e.inv), [enriched, filter, query, data]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: enriched.length };
    enriched.forEach((e) => { c[e.status] = (c[e.status] ?? 0) + 1; });
    return c;
  }, [enriched]);

  const paidOf = (id: string) => enriched.find((e) => e.inv.id === id)?.paid ?? 0;

  const columns = useMemo(() => [
    col.accessor('invoiceNo', {
      header: 'Invoice',
      cell: (i) => (
        <button className="text-[12.5px] font-bold text-ink hover:text-accent transition-colors cursor-pointer"
          onClick={(e) => { e.stopPropagation(); setOpenId(i.row.original.id); }}>{i.getValue()}</button>
      ),
    }),
    col.accessor((o) => o.clientId, {
      id: 'client', header: 'Client',
      cell: (i) => {
        const c = data ? clientOf(data.clients, i.row.original.clientId) : undefined;
        return <span className="text-[12.5px] font-semibold text-ink">{c?.name ?? '—'}</span>;
      },
    }),
    col.accessor('date', { header: 'Billed', cell: (i) => <span className="mono text-[12px] text-mut">{fmtDate(i.getValue(), false)}</span> }),
    col.accessor('dueDate', {
      header: 'Due',
      cell: (i) => {
        const d = daysFromToday(i.getValue());
        const e = enriched.find((x) => x.inv.id === i.row.original.id);
        const late = e && e.status === 'overdue';
        return <span className={`mono text-[12px] font-semibold ${late ? 'text-rose-500' : d <= 3 && e?.status !== 'paid' ? 'text-amber-500' : 'text-mut'}`}>{fmtDate(i.getValue(), false)}</span>;
      },
    }),
    col.accessor('total', {
      header: () => <span className="block text-right">Value</span>,
      cell: (i) => <span className="mono text-[12.5px] font-bold text-ink block text-right">{inr(i.getValue())}</span>,
    }),
    col.accessor((o) => paidOf(o.id), {
      id: 'paid',
      header: () => <span className="block text-right">Received</span>,
      cell: (i) => <span className="mono text-[12px] text-emerald-500 block text-right">{inr(i.getValue())}</span>,
    }),
    col.accessor((o) => o.id, {
      id: 'status', header: 'Status',
      cell: (i) => {
        const e = enriched.find((x) => x.inv.id === i.getValue());
        if (!e) return null;
        return <StatusBadge tone={INV_STATUS_META[e.status].tone} pulse={e.status === 'overdue'}>{INV_STATUS_META[e.status].label}</StatusBadge>;
      },
    }),
    col.display({
      id: 'act',
      cell: (i) => (
        <div className="flex justify-end gap-0.5">
          <button className="btn-ghost btn-xs" title="Print / PDF"
            onClick={(e) => {
              e.stopPropagation();
              const c = data ? clientOf(data.clients, i.row.original.clientId) : undefined;
              if (c) setPrintDoc({ kind: 'invoice', invoice: i.row.original, client: c });
            }}><Printer size={13} /></button>
          <button className="btn-ghost btn-xs" title="Open" onClick={(e) => { e.stopPropagation(); setOpenId(i.row.original.id); }}>
            <ChevronRight size={14} />
          </button>
        </div>
      ),
    }),
  ], [data, enriched]);

  const table = useReactTable({
    data: rows, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
  });

  const openInv = data?.invoices.find((i) => i.id === openId) ?? null;
  if (!data) return null;

  const totalOut = enriched.reduce((s, e) => s + e.balance, 0);

  return (
    <div>
      <PageHead kicker="Billing engine" title="Tax invoices"
        right={<div className="text-right">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-mut">Receivable book</p>
          <p className="mono font-bold text-[18px] text-ink leading-tight">{inr(totalOut)}</p>
        </div>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['all', 'unpaid', 'partial', 'overdue', 'paid'] as const).map((s) => (
          <button key={s} className={`chip ${filter === s ? 'chip-on' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : INV_STATUS_META[s].label}
            <span className="mono text-[10px] opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
        <div className="relative ml-auto w-[210px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mut" />
          <input className="input h-8 pl-7 text-xs" placeholder="Filter invoices…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[820px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={h.column.getCanSort() ? 'cursor-pointer select-none hover:text-ink' : ''}
                    onClick={h.column.getToggleSortingHandler()}>
                    <span className="inline-flex items-center gap-1">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {h.column.getIsSorted() === 'asc' && '↑'}
                      {h.column.getIsSorted() === 'desc' && '↓'}
                    </span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((r) => (
              <motion.tr key={r.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="cursor-pointer"
                onClick={() => setOpenId(r.original.id)}>
                {r.getVisibleCells().map((c) => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty title="No invoices match" hint="Invoices appear the moment an order is converted from the pipeline."
            action={<button className="btn-outline btn-sm" onClick={() => go('orders')}><FileText size={13} /> Go to order pipeline</button>} />
        )}
      </div>

      {openInv && <InvoiceDrawer invoice={openInv} onClose={() => setOpenId(null)} payOpen={payOpen} setPayOpen={setPayOpen} />}
    </div>
  );
}
