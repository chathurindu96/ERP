import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable,
  type SortingState,
} from '@tanstack/react-table';
import {
  Plus, Pencil, XCircle, Printer, FileText, ChevronRight, ArrowRight, Search, History,
} from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Drawer, Field, Modal, Confirm, StatusBadge, Empty, PageHead } from '../components/ui';
import {
  ORDER_STATUS_META, NEXT_STATUS, computeTotals, inr, fmtDate, daysFromToday,
  todayISO, uid, timeAgo, clientOf, D, type Tone,
} from '../lib/utils';
import type { Client, LineItem, Order, OrderStatus } from '../db/schema';

const col = createColumnHelper<Order>();

function OrderEditor({ open, initial, onClose }: { open: boolean; initial: Order | null; onClose: () => void }) {
  const { data, saveOrder } = useApp();
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState(todayISO().slice(0, 10));
  const [dueDate, setDueDate] = useState(D(14).slice(0, 10));
  const [status, setStatus] = useState<OrderStatus>('draft');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setClientId(initial.clientId);
      setDate(initial.date.slice(0, 10));
      setDueDate(initial.dueDate.slice(0, 10));
      setStatus(initial.status);
      setNotes(initial.notes);
      setItems(initial.items.map((i) => ({ ...i })));
    } else {
      setClientId(data?.clients[0]?.id ?? '');
      setDate(todayISO().slice(0, 10));
      setDueDate(D(14).slice(0, 10));
      setStatus('draft');
      setNotes('');
      setItems([]);
    }
  }, [open, initial, data]);

  if (!data) return null;

  const blank = (): LineItem => ({
    catalogId: data.catalog[0]?.id ?? '', sku: '', name: '', hsn: '', batchNo: '',
    qty: 1, unit: 'pair', unitPrice: 0, discountPct: 0, taxRate: 12,
  });

  const pickItem = (idx: number, catalogId: string) => {
    const c = data.catalog.find((x) => x.id === catalogId);
    setItems((arr) => arr.map((it, i) => i === idx && c
      ? { ...it, catalogId, sku: c.sku, name: c.name, hsn: c.hsn, unit: c.unit, unitPrice: c.wholesalePrice, taxRate: c.taxRate }
      : it));
  };
  const patch = (idx: number, k: keyof LineItem, v: string | number) =>
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, [k]: v } : it)));

  const totals = computeTotals(items.filter((i) => i.qty > 0));
  const valid = clientId && items.some((i) => i.qty > 0 && i.unitPrice > 0);

  const save = async () => {
    let mx = 1040;
    data.orders.forEach((o) => { const m = o.orderNo.match(/(\d+)$/); if (m) mx = Math.max(mx, parseInt(m[1], 10)); });
    const orderNo = initial?.orderNo ?? `ORD-${mx + 1}`;
    const order: Order = {
      id: initial?.id ?? uid(), orderNo, clientId,
      date: new Date(date + 'T10:00:00').toISOString(),
      dueDate: new Date(dueDate + 'T10:00:00').toISOString(),
      status, items: items.filter((i) => i.qty > 0), notes,
      createdAt: initial?.createdAt ?? todayISO(), updatedAt: todayISO(),
    };
    await saveOrder(order, !initial);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} wide
      title={initial ? `Edit ${initial.orderNo}` : 'New customer order'}
      subtitle={initial ? 'Amend line items before the order is locked' : 'Draft a wholesale order — convert to invoice once fulfilled'}
      footer={<>
        <button className="btn-outline" onClick={onClose}>Discard</button>
        <button className="btn-primary" disabled={!valid} onClick={save}>
          {initial ? 'Save changes' : 'Create order'} <ArrowRight size={14} />
        </button>
      </>}>
      <div className="grid sm:grid-cols-4 gap-3 mb-4">
        <Field label="Client" className="sm:col-span-2">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            {data.clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.city}</option>)}
          </select>
        </Field>
        <Field label="Order date"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Delivery due"><input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="lbl !mb-0">Line items</span>
        <button className="btn-outline btn-xs" onClick={() => setItems((a) => [...a, blank()])}>
          <Plus size={12} /> Add line
        </button>
      </div>
      <div className="border border-line rounded-md overflow-hidden">
        <div className="hidden md:grid grid-cols-[minmax(0,1fr)_92px_64px_58px_84px_52px_84px_28px] gap-2 px-3 py-2 bg-panel2/70 text-[10px] font-bold uppercase tracking-wider text-mut">
          <span>Catalog item</span><span>Batch no.</span><span>Qty</span><span>Unit</span><span>Rate ₹</span><span>Disc %</span><span className="text-right">Amount</span><span />
        </div>
        {items.length === 0 && (
          <p className="px-3 py-5 text-center text-xs text-mut">No lines yet — add the first item above.</p>
        )}
        {items.map((it, idx) => (
          <div key={idx} className="grid md:grid-cols-[minmax(0,1fr)_92px_64px_58px_84px_52px_84px_28px] grid-cols-2 gap-2 px-3 py-2 border-t border-line items-center bg-panel">
            <select className="input h-8 text-xs" value={it.catalogId} onChange={(e) => pickItem(idx, e.target.value)}>
              {data.catalog.map((c) => <option key={c.id} value={c.id}>{c.sku} · {c.name}</option>)}
            </select>
            <input className="input h-8 text-xs mono" placeholder="EV-1130-A" value={it.batchNo}
              onChange={(e) => patch(idx, 'batchNo', e.target.value)} />
            <input type="number" min={1} className="input h-8 text-xs mono" value={it.qty || ''}
              onChange={(e) => patch(idx, 'qty', Number(e.target.value))} />
            <select className="input h-8 text-xs" value={it.unit} onChange={(e) => patch(idx, 'unit', e.target.value)}>
              {['pair', 'box', 'dozen', 'kg', 'pc'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <input type="number" min={0} className="input h-8 text-xs mono" value={it.unitPrice || ''}
              onChange={(e) => patch(idx, 'unitPrice', Number(e.target.value))} />
            <input type="number" min={0} max={100} className="input h-8 text-xs mono" value={it.discountPct || ''}
              placeholder="0" onChange={(e) => patch(idx, 'discountPct', Number(e.target.value))} />
            <span className="mono text-xs font-semibold text-ink text-right">
              {inr(it.qty * it.unitPrice * (1 - it.discountPct / 100))}
            </span>
            <button className="btn-ghost btn-xs text-rose-500" onClick={() => setItems((a) => a.filter((_, i) => i !== idx))} aria-label="Remove line">
              <XCircle size={14} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-line bg-panel2/70">
          <span className="text-[11px] text-mut">{totals.qty.toLocaleString('en-IN')} units · GST {inr(totals.taxAmt)} included in total</span>
          <span className="font-display font-bold text-[15px] text-ink mono">{inr(totals.total)}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-3 mt-4">
        <Field label="Status" className="sm:col-span-1">
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {Object.entries(ORDER_STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <Field label="Dispatch / packing notes" className="sm:col-span-3">
          <input className="input" placeholder="e.g. Packed in branded cartons, LR copy with driver" value={notes}
            onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function OrderDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const { data, setOrderStatus, createInvoiceFromOrder, setPrintDoc, go } = useApp();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  if (!data) return null;
  const client = clientOf(data.clients, order.clientId);
  const meta = ORDER_STATUS_META[order.status];
  const next = NEXT_STATUS[order.status];
  const totals = computeTotals(order.items);
  const hasInvoice = data.invoices.some((i) => i.orderId === order.id);
  const invoice = data.invoices.find((i) => i.orderId === order.id);
  const trail = data.audit.filter((a) => a.entityId === order.id).slice(0, 6);
  const STAGES: OrderStatus[] = ['draft', 'confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'invoiced'];
  const stageIdx = STAGES.indexOf(order.status);

  const challanNo = order.orderNo.replace(/^ORD/, data.settings.challanPrefix || 'DC');

  return (
    <>
      <Drawer open onClose={onClose} width="max-w-2xl"
        title={<span className="flex items-center gap-2.5">{order.orderNo} <StatusBadge tone={meta.tone} pulse={order.status === 'in_production'}>{meta.label}</StatusBadge></span>}
        subtitle={`${client?.name} · ordered ${fmtDate(order.date)} · due ${fmtDate(order.dueDate)}`}
        footer={
          <div className="flex flex-wrap gap-2">
            {next && (
              <button className="btn-primary btn-sm" onClick={() => setOrderStatus(order.id, next.to)}>
                {next.label} <ArrowRight size={13} />
              </button>
            )}
            {order.status === 'delivered' && !hasInvoice && (
              <button className="btn-primary btn-sm" onClick={async () => {
                const inv = await createInvoiceFromOrder(order.id);
                if (inv && client) { onClose(); go('invoices', { invoiceId: inv.id }); }
              }}>
                <FileText size={13} /> Generate tax invoice
              </button>
            )}
            {['ready', 'dispatched', 'delivered', 'invoiced'].includes(order.status) && (
              <button className="btn-outline btn-sm" onClick={() => client && setPrintDoc({ kind: 'challan', order, client, challanNo })}>
                <Printer size={13} /> Delivery challan
              </button>
            )}
            {invoice && (
              <button className="btn-outline btn-sm" onClick={() => { onClose(); go('invoices', { invoiceId: invoice.id }); }}>
                <FileText size={13} /> View {invoice.invoiceNo}
              </button>
            )}
            {['draft', 'confirmed'].includes(order.status) && (
              <button className="btn-outline btn-sm" onClick={() => setEditing(true)}><Pencil size={13} /> Edit</button>
            )}
            {!['invoiced', 'cancelled'].includes(order.status) && (
              <button className="btn-ghost btn-sm text-rose-500 hover:text-rose-400" onClick={() => setConfirmCancel(true)}>
                <XCircle size={13} /> Cancel order
              </button>
            )}
          </div>
        }>
        {/* pipeline stepper */}
        <div className="mb-5">
          <div className="flex items-center">
            {STAGES.map((st, i) => {
              const done = order.status === 'cancelled' ? false : i < stageIdx || (i === stageIdx && order.status === 'invoiced');
              const current = i === stageIdx && order.status !== 'cancelled';
              return (
                <div key={st} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 transition-colors ${
                      order.status === 'cancelled' ? 'bg-rose-500/20 border-rose-500'
                        : done ? 'bg-emerald-500 border-emerald-500'
                        : current ? 'bg-accent border-accent pulse-dot'
                        : 'bg-panel2 border-line'}`} />
                  </div>
                  {i < STAGES.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < stageIdx && order.status !== 'cancelled' ? 'bg-emerald-500/60' : 'bg-line'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-[8.5px] font-bold uppercase tracking-wide text-mut">
            <span>Draft</span><span>Conf.</span><span>Prod.</span><span>Ready</span><span>Disp.</span><span>Deliv.</span><span>Inv.</span>
          </div>
          {order.status === 'cancelled' && (
            <p className="text-[11px] text-rose-500 font-semibold mt-1.5">This order was cancelled and will not proceed to billing.</p>
          )}
        </div>

        {/* items */}
        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-panel2/70">
              <tr className="text-[10px] uppercase tracking-wider text-mut text-left">
                <th className="px-3 py-2 font-bold">Item</th><th className="px-2 py-2 font-bold">Batch</th>
                <th className="px-2 py-2 font-bold text-right">Qty</th><th className="px-2 py-2 font-bold text-right">Rate</th>
                <th className="px-3 py-2 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="px-3 py-2">
                    <p className="text-[12.5px] font-semibold text-ink">{it.name}</p>
                    <p className="text-[10.5px] text-mut mono">{it.sku} · HSN {it.hsn} · GST {it.taxRate}%{it.discountPct ? ` · ${it.discountPct}% off` : ''}</p>
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
            <div className="flex justify-between text-[12px] text-mut"><span>Taxable value</span><span className="mono">{inr(totals.subTotal)}</span></div>
            {totals.discountAmt > 0 && <div className="flex justify-between text-[12px] text-mut"><span>Item discount</span><span className="mono">− {inr(totals.discountAmt)}</span></div>}
            <div className="flex justify-between text-[12px] text-mut"><span>CGST + SGST</span><span className="mono">{inr(totals.taxAmt)}</span></div>
            <div className="flex justify-between text-[13.5px] font-bold text-ink pt-1 border-t border-line"><span>Order value</span><span className="mono">{inr(totals.total)}</span></div>
          </div>
        </div>

        {order.notes && <p className="text-[12px] text-mut italic mt-3 border-l-2 border-accent/60 pl-2.5">{order.notes}</p>}

        {/* audit trail */}
        <h4 className="font-display font-semibold text-[13px] text-ink mt-5 mb-2 flex items-center gap-1.5">
          <History size={13} className="text-mut" /> Audit trail
        </h4>
        {trail.length === 0 ? <p className="text-xs text-mut">No recorded events yet.</p> : (
          <div className="space-y-1.5">
            {trail.map((a) => (
              <div key={a.id} className="flex items-baseline gap-2 text-[11.5px]">
                <span className="mono text-[10px] text-mut shrink-0 w-[70px]">{timeAgo(a.ts)}</span>
                <span className="font-semibold text-ink">{a.label}</span>
                <span className="text-mut truncate">— {a.detail}</span>
              </div>
            ))}
          </div>
        )}
      </Drawer>
      <Confirm open={confirmCancel} onClose={() => setConfirmCancel(false)} danger yesLabel="Cancel order"
        title={`Cancel ${order.orderNo}?`}
        body="The order will be marked cancelled, removed from the production queue, and the decision logged in the audit trail. This cannot be undone from the UI."
        onYes={() => setOrderStatus(order.id, 'cancelled', 'Cancelled from order drawer')} />
      {editing && <OrderEditor open={editing} initial={order} onClose={() => setEditing(false)} />}
    </>
  );
}

export function OrdersPage() {
  const { data, view } = useApp();
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [query, setQuery] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const h = () => { setEditing(null); setEditorOpen(true); };
    window.addEventListener('fc-new-order', h);
    return () => window.removeEventListener('fc-new-order', h);
  }, []);

  const seenView = useRef<typeof view | null>(null);
  useEffect(() => {
    if (view === seenView.current) return;
    seenView.current = view;
    const id = view.params?.orderId;
    if (id && data?.orders.some((o) => o.id === id)) setOpenId(id);
  }, [view, data?.orders]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.orders
      .filter((o) => filter === 'all' || o.status === filter)
      .filter((o) => {
        if (!query.trim()) return true;
        const c = clientOf(data.clients, o.clientId);
        const s = query.toLowerCase();
        return o.orderNo.toLowerCase().includes(s) || (c?.name.toLowerCase().includes(s) ?? false);
      });
  }, [data, filter, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.orders.length ?? 0 };
    data?.orders.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [data]);

  const columns = useMemo(() => [
    col.accessor('orderNo', {
      header: 'Order',
      cell: (i) => (
        <button className="text-[12.5px] font-bold text-ink hover:text-accent transition-colors cursor-pointer"
          onClick={() => setOpenId(i.row.original.id)}>{i.getValue()}</button>
      ),
    }),
    col.accessor((o) => o.clientId, {
      id: 'client',
      header: 'Client',
      cell: (i) => {
        const c = data ? clientOf(data.clients, i.row.original.clientId) : undefined;
        return (
          <div>
            <p className="text-[12.5px] font-semibold text-ink">{c?.name ?? '—'}</p>
            <p className="text-[10.5px] text-mut">{c?.city}</p>
          </div>
        );
      },
    }),
    col.accessor('date', {
      header: 'Ordered',
      cell: (i) => <span className="mono text-[12px] text-mut">{fmtDate(i.getValue(), false)}</span>,
    }),
    col.accessor('dueDate', {
      header: 'Due',
      cell: (i) => {
        const d = daysFromToday(i.getValue());
        const done = ['invoiced', 'cancelled', 'delivered'].includes(i.row.original.status);
        return (
          <span className={`mono text-[12px] font-semibold ${!done && d < 0 ? 'text-rose-500' : !done && d <= 2 ? 'text-amber-500' : 'text-mut'}`}>
            {fmtDate(i.getValue(), false)}
          </span>
        );
      },
    }),
    col.accessor((o) => computeTotals(o.items).total, {
      id: 'value',
      header: () => <span className="block text-right">Value (incl. GST)</span>,
      cell: (i) => <span className="mono text-[12.5px] font-bold text-ink block text-right">{inr(i.getValue())}</span>,
    }),
    col.accessor('status', {
      header: 'Stage',
      cell: (i) => {
        const st = i.getValue() as OrderStatus;
        return <StatusBadge tone={ORDER_STATUS_META[st].tone as Tone} pulse={st === 'in_production'}>{ORDER_STATUS_META[st].label}</StatusBadge>;
      },
    }),
    col.display({
      id: 'act',
      cell: (i) => (
        <button className="btn-ghost btn-xs ml-auto" onClick={() => setOpenId(i.row.original.id)} aria-label="Open order">
          <ChevronRight size={14} />
        </button>
      ),
    }),
  ], [data]);

  const table = useReactTable({
    data: rows, columns, state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const openOrder = data?.orders.find((o) => o.id === openId) ?? null;

  if (!data) return null;

  return (
    <div>
      <PageHead kicker="Order lifecycle" title="Order pipeline"
        right={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={14} /> New order</button>} />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(['all', 'draft', 'confirmed', 'in_production', 'ready', 'dispatched', 'delivered', 'invoiced', 'cancelled'] as const).map((s) => (
          <button key={s} className={`chip ${filter === s ? 'chip-on' : ''}`} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All' : ORDER_STATUS_META[s].label}
            <span className="mono text-[10px] opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
        <div className="relative ml-auto w-[210px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mut" />
          <input className="input h-8 pl-7 text-xs" placeholder="Filter orders…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="tbl w-full min-w-[760px]">
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
                {r.getVisibleCells().map((c) => (
                  <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <Empty title="No orders in this stage"
            hint="Adjust the stage filter, or draft a new wholesale order for the floor."
            action={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={13} /> New order</button>} />
        )}
      </div>

      <OrderEditor open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} />
      {openOrder && <OrderDrawer order={openOrder} onClose={() => setOpenId(null)} />}
    </div>
  );
}
