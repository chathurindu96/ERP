import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, FileText, ClipboardList, Truck, IndianRupee, Bell,
  ArrowRight, Settings, Users, Receipt, AlertTriangle, CheckCircle2, Zap,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { useApp } from '../state/AppStore';
import { StatusBadge } from '../components/ui';
import {
  ORDER_STATUS_META, NEXT_STATUS, invStatus, INV_STATUS_META, paidForInvoice, inr,
  fmtDate, daysFromToday, lastMonths, timeAgo, clientOf, truncate,
} from '../lib/utils';

const in30 = (iso: string) => daysFromToday(iso) >= -30 && daysFromToday(iso) <= 0;
const inPrev30 = (iso: string) => daysFromToday(iso) >= -60 && daysFromToday(iso) < -30;

const compact = (v: number) =>
  v >= 1e7 ? `${(v / 1e7).toFixed(1)}Cr` : v >= 1e5 ? `${(v / 1e5).toFixed(1)}L` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v);

function Kpi({ label, value, sub, delta, tone }: {
  label: string; value: string; sub: string; delta?: number; tone?: 'rose' | 'accent';
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <motion.div layout className="card p-4 relative overflow-hidden group hover:border-mut/40 transition-colors"
      whileHover={{ y: -2 }}>
      <div className={`absolute -right-6 -top-8 w-24 h-24 rounded-full blur-2xl opacity-[.13] ${tone === 'rose' ? 'bg-rose-500' : 'bg-accent'}`} />
      <p className="text-[10.5px] font-bold uppercase tracking-[.12em] text-mut">{label}</p>
      <p className={`mono font-semibold text-[24px] mt-1.5 leading-none ${tone === 'rose' ? 'text-rose-500' : 'text-ink'}`}>{value}</p>
      <div className="flex items-center gap-2 mt-2.5">
        {delta !== undefined && (
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${up ? 'text-emerald-500' : 'text-rose-500'}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(delta).toFixed(0)}%
          </span>
        )}
        <span className="text-[11px] text-mut">{sub}</span>
      </div>
    </motion.div>
  );
}

const AUDIT_ICON: Record<string, typeof FileText> = {
  invoice: FileText, payment: IndianRupee, order: ClipboardList, bill: Truck,
  settings: Settings, client: Users, vendor: Truck, reminder: Bell,
};

export function Dashboard() {
  const { data, go, setOrderStatus, createInvoiceFromOrder, setPrintDoc, log, toast } = useApp();

  const m = useMemo(() => {
    if (!data) return null;
    const { invoices, payments, bills, orders, clients, audit } = data;
    const paidMap = new Map(invoices.map((i) => [i.id, paidForInvoice(i.id, payments)]));
    const rev30 = invoices.filter((i) => in30(i.date)).reduce((s, i) => s + i.total, 0);
    const revPrev = invoices.filter((i) => inPrev30(i.date)).reduce((s, i) => s + i.total, 0);
    const outstanding = invoices.reduce((s, i) => s + Math.max(0, i.total - (paidMap.get(i.id) ?? 0)), 0);
    const overdue = invoices.filter((i) => invStatus(i, paidMap.get(i.id) ?? 0) === 'overdue');
    const overdueAmt = overdue.reduce((s, i) => s + i.total - (paidMap.get(i.id) ?? 0), 0);
    const exp30 = bills.filter((b) => in30(b.date)).reduce((s, b) => s + b.amount, 0);
    const expPrev = bills.filter((b) => inPrev30(b.date)).reduce((s, b) => s + b.amount, 0);
    const rev90 = invoices.filter((i) => daysFromToday(i.date) >= -90).reduce((s, i) => s + i.total, 0);
    const exp90 = bills.filter((b) => daysFromToday(b.date) >= -90).reduce((s, b) => s + b.amount, 0);
    const margin = rev90 > 0 ? ((rev90 - exp90) / rev90) * 100 : 0;

    const months = lastMonths(6).map((mo) => ({
      ...mo,
      revenue: invoices.filter((i) => i.date.slice(0, 7) === mo.key).reduce((s, i) => s + i.total, 0),
      expense: bills.filter((b) => b.date.slice(0, 7) === mo.key).reduce((s, b) => s + b.amount, 0),
    }));

    const byClient = clients.map((c) => ({
      name: c.name,
      value: invoices.filter((i) => i.clientId === c.id).reduce((s, i) => s + i.total, 0),
    })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);

    const queue = orders
      .filter((o) => ['confirmed', 'in_production', 'ready'].includes(o.status))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const toInvoice = orders.filter((o) => o.status === 'delivered');

    return { paidMap, rev30, revPrev, outstanding, overdue, overdueAmt, exp30, expPrev, margin, months, byClient, queue, toInvoice, audit };
  }, [data]);

  if (!data || !m) return null;
  const PIE = ['#f5a524', '#38bdf8', '#34d399', '#f43f5e', '#94a3b8', '#a3e635'];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[.14em] text-accent mb-1">Command Deck</p>
          <h1 className="font-display font-bold text-[22px] leading-tight text-ink">
            {data.settings.name.split(' ')[0]} works — live position
          </h1>
        </div>
        <p className="text-xs text-mut mono">{fmtDate(new Date().toISOString())} · all figures in INR</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3.5">
        <Kpi label="Revenue billed · 30d" value={inr(m.rev30)}
          sub="vs prior 30 days" delta={m.revPrev > 0 ? ((m.rev30 - m.revPrev) / m.revPrev) * 100 : undefined} />
        <Kpi label="Outstanding collections" value={inr(m.outstanding)} tone="rose"
          sub={`${m.overdue.length} invoice${m.overdue.length === 1 ? '' : 's'} overdue · ${inr(m.overdueAmt)}`} />
        <Kpi label="Supplier bills · 30d" value={inr(m.exp30)}
          sub="vs prior 30 days" delta={m.expPrev > 0 ? ((m.exp30 - m.expPrev) / m.expPrev) * 100 : undefined} />
        <Kpi label="Net margin · 90d" value={`${m.margin.toFixed(1)}%`} tone="accent"
          sub="billing minus raw-material bills" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-5 gap-3.5">
        <div className="card p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-semibold text-[14px] text-ink">Cash flow — billed vs. supplier bills</h2>
            <div className="flex items-center gap-3 text-[11px] text-mut">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent" />Billed</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-500" />Expenses</span>
            </div>
          </div>
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.months} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--c-line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--c-mut)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={compact} tick={{ fill: 'var(--c-mut)', fontSize: 10.5 }} axisLine={false} tickLine={false} width={42} />
                <Tooltip cursor={{ fill: 'var(--c-panel2)' }} formatter={(v) => inr(Number(v))}
                  contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 12, color: 'var(--c-ink)' }} />
                <Bar dataKey="revenue" name="Billed" fill="#f5a524" radius={[3, 3, 0, 0]} maxBarSize={26} />
                <Bar dataKey="expense" name="Expenses" fill="#64748b" radius={[3, 3, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4 lg:col-span-2">
          <h2 className="font-display font-semibold text-[14px] text-ink mb-1">Top buying clients</h2>
          <p className="text-[11px] text-mut mb-2">share of all billed value</p>
          <div className="h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={m.byClient} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66}
                  paddingAngle={3} strokeWidth={0}>
                  {m.byClient.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(Number(v))}
                  contentStyle={{ background: 'var(--c-panel)', border: '1px solid var(--c-line)', borderRadius: 8, fontSize: 12, color: 'var(--c-ink)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-1">
            {m.byClient.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-[11.5px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE[i % PIE.length] }} />
                <span className="text-ink font-medium truncate">{c.name}</span>
                <span className="mono text-mut ml-auto">{inr(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts + queue + activity */}
      <div className="grid lg:grid-cols-3 gap-3.5">
        {/* Overdue alerts */}
        <div className="card p-4 border-rose-500/30">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={15} className="text-rose-500" />
            <h2 className="font-display font-semibold text-[14px] text-ink">Overdue collections</h2>
            <span className="b-rose ml-auto">{m.overdue.length}</span>
          </div>
          {m.overdue.length === 0 && (
            <p className="text-xs text-mut flex items-center gap-2 py-6 justify-center">
              <CheckCircle2 size={15} className="text-emerald-500" /> No invoices past due — clean book.
            </p>
          )}
          <div className="space-y-2">
            {m.overdue.slice(0, 4).map((inv) => {
              const client = clientOf(data.clients, inv.clientId);
              const bal = inv.total - (m.paidMap.get(inv.id) ?? 0);
              return (
                <motion.div key={inv.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  className="rounded-md border border-rose-500/25 bg-rose-500/6 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-ink truncate">{client?.name}</p>
                      <p className="text-[10.5px] text-mut mono">{inv.invoiceNo} · due {fmtDate(inv.dueDate, false)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="mono text-[13px] font-bold text-rose-500">{inr(bal)}</p>
                      <p className="text-[10px] text-rose-400 font-semibold">{Math.abs(daysFromToday(inv.dueDate))}d late</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 mt-2">
                    <button className="btn-outline btn-xs flex-1" onClick={async () => {
                      const text = `Dear ${encodeURIComponent(client?.contact || 'Sir')}, reminder from ${encodeURIComponent(data.settings.name)}: invoice ${inv.invoiceNo} of ${inr(bal)} was due ${fmtDate(inv.dueDate, false)}. Kindly arrange payment at the earliest.`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                      await log('reminder', inv.id, 'reminder.sent', `Reminder → ${client?.name}`, `WhatsApp reminder for ${inv.invoiceNo}`);
                      toast('Reminder queued via WhatsApp + logged to audit trail', 'info');
                    }}>
                      <Bell size={11} /> Remind
                    </button>
                    <button className="btn-primary btn-xs flex-1" onClick={() => go('invoices', { invoiceId: inv.id, pay: '1' })}>
                      <Receipt size={11} /> Take payment
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Production queue */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={15} className="text-accent" />
            <h2 className="font-display font-semibold text-[14px] text-ink">Production & dispatch queue</h2>
          </div>
          <div className="space-y-2">
            {m.queue.length === 0 && m.toInvoice.length === 0 && (
              <p className="text-xs text-mut py-6 text-center">Floor is clear — no open work orders.</p>
            )}
            {[...m.queue, ...m.toInvoice].slice(0, 5).map((o) => {
              const meta = ORDER_STATUS_META[o.status];
              const next = NEXT_STATUS[o.status];
              const client = clientOf(data.clients, o.clientId);
              const val = o.items.reduce((s, it) => s + it.qty * it.unitPrice * (1 - it.discountPct / 100), 0);
              return (
                <motion.div key={o.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-md border border-line bg-panel2/40 p-2.5 hover:border-mut/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <button className="text-[12px] font-bold text-ink hover:text-accent transition-colors cursor-pointer"
                      onClick={() => go('orders', { orderId: o.id })}>{o.orderNo}</button>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    <span className="mono text-[11.5px] text-mut ml-auto">{inr(val)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <p className="text-[10.5px] text-mut truncate">{client?.name} · due {fmtDate(o.dueDate, false)}</p>
                    {o.status === 'delivered' ? (
                      <button className="btn-primary btn-xs" onClick={() => createInvoiceFromOrder(o.id)}>
                        <FileText size={11} /> Invoice now
                      </button>
                    ) : next ? (
                      <button className="btn-outline btn-xs" onClick={() => setOrderStatus(o.id, next.to)}>
                        {truncate(next.label, 22)} <ArrowRight size={11} />
                      </button>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Activity */}
        <div className="card p-4">
          <h2 className="font-display font-semibold text-[14px] text-ink mb-3">Audit trail — recent activity</h2>
          <div className="relative">
            <div className="absolute left-[13px] top-1 bottom-1 w-px bg-line" />
            <div className="space-y-2.5">
              {m.audit.slice(0, 8).map((a) => {
                const Icon = AUDIT_ICON[a.entity] ?? Receipt;
                return (
                  <div key={a.id} className="flex gap-2.5 relative">
                    <div className="w-[27px] h-[27px] rounded-md bg-panel2 border border-line flex items-center justify-center shrink-0 z-10">
                      <Icon size={12.5} className="text-mut" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[12px] font-semibold text-ink leading-tight">{a.label}</p>
                      <p className="text-[10.5px] text-mut truncate">{a.detail}</p>
                      <p className="text-[10px] text-mut/70 mono mt-0.5">{timeAgo(a.ts)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InvoiceStatusChip({ s }: { s: ReturnType<typeof invStatus> }) {
  const meta = INV_STATUS_META[s];
  return <StatusBadge tone={meta.tone} pulse={s === 'overdue'}>{meta.label}</StatusBadge>;
}
