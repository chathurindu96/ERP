import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Printer, Bell, Receipt, Search, FileText, Phone, MapPin, Pencil } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Field, Modal, StatusBadge, Empty, PageHead } from '../components/ui';
import { PaymentModal } from './InvoicesPage';
import {
  buildStatement, clientBalance, inr, fmtDate, todayISO, uid, TERMS_OPTIONS, timeAgo,
} from '../lib/utils';
import type { Client } from '../db/schema';

function ClientEditor({ open, initial, onClose }: { open: boolean; initial: Client | null; onClose: () => void }) {
  const { saveClient } = useApp();
  const [f, setF] = useState<Partial<Client>>({});
  useEffect(() => {
    if (open) setF(initial ? { ...initial } : { terms: 'Net 15', state: '' });
  }, [open, initial]);
  const set = (k: keyof Client, v: string) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name && f.phone;
  return (
    <Modal open={open} onClose={onClose} title={initial ? `Edit ${initial.name}` : 'New wholesale client'}
      subtitle="Ledger (khata) opens automatically with the first invoice"
      footer={<>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!valid} onClick={async () => {
          await saveClient({
            id: initial?.id ?? uid(), name: f.name ?? '', contact: f.contact ?? '', phone: f.phone ?? '',
            email: f.email ?? '', gstin: f.gstin ?? '', address: f.address ?? '', city: f.city ?? '',
            state: f.state ?? '', terms: f.terms ?? 'Net 15', notes: f.notes,
            createdAt: initial?.createdAt ?? todayISO(),
          }, !initial);
          onClose();
        }}>{initial ? 'Save changes' : 'Add client'}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Firm name" className="col-span-2"><input className="input" value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} autoFocus /></Field>
        <Field label="Contact person"><input className="input" value={f.contact ?? ''} onChange={(e) => set('contact', e.target.value)} /></Field>
        <Field label="Phone"><input className="input mono" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input className="input" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="GSTIN"><input className="input mono" value={f.gstin ?? ''} onChange={(e) => set('gstin', e.target.value)} /></Field>
        <Field label="Address" className="col-span-2"><input className="input" value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="City"><input className="input" value={f.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
        <Field label="State"><input className="input" value={f.state ?? ''} onChange={(e) => set('state', e.target.value)} /></Field>
        <Field label="Payment terms" className="col-span-2">
          <select className="input" value={f.terms} onChange={(e) => set('terms', e.target.value)}>
            {TERMS_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

export function ClientsPage() {
  const { data, view, setPrintDoc, log, toast } = useApp();
  const [query, setQuery] = useState('');
  const [selId, setSelId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [payClient, setPayClient] = useState<Client | null>(null);

  const seenView = useRef<typeof view | null>(null);
  useEffect(() => {
    if (view === seenView.current) return;
    seenView.current = view;
    const id = view.params?.clientId;
    if (id && data?.clients.some((c) => c.id === id)) setSelId(id);
  }, [view, data?.clients]);

  useEffect(() => {
    if (!selId && data && data.clients.length) setSelId(data.clients[0].id);
  }, [selId, data]);

  const list = useMemo(() => {
    if (!data) return [];
    return data.clients
      .filter((c) => !query.trim() || c.name.toLowerCase().includes(query.toLowerCase()) || c.city.toLowerCase().includes(query.toLowerCase()))
      .map((c) => ({ c, bal: clientBalance(c.id, data.invoices, data.payments) }));
  }, [data, query]);

  const sel = data?.clients.find((c) => c.id === selId) ?? null;
  const statement = useMemo(
    () => (data && sel ? buildStatement(sel.id, data.invoices, data.payments) : []),
    [data, sel]);
  const bal = data && sel ? clientBalance(sel.id, data.invoices, data.payments) : null;

  if (!data) return null;

  return (
    <div>
      <PageHead kicker="Accounts receivable · Khata" title="Client ledgers"
        right={<button className="btn-primary btn-sm" onClick={() => { setEditing(null); setEditorOpen(true); }}><Plus size={14} /> New client</button>} />

      <div className="grid lg:grid-cols-[300px_1fr] gap-4">
        {/* directory */}
        <div className="card p-3 h-fit lg:sticky lg:top-[72px]">
          <div className="relative mb-2.5">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mut" />
            <input className="input h-8 pl-7 text-xs" placeholder="Search clients…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="space-y-1.5 max-h-[62vh] overflow-y-auto pr-0.5">
            {list.map(({ c, bal: b }) => (
              <motion.button key={c.id} layout onClick={() => setSelId(c.id)}
                className={`w-full text-left rounded-md border px-3 py-2.5 transition-colors cursor-pointer ${
                  selId === c.id ? 'border-accent/60 bg-accent/8' : 'border-line bg-panel hover:bg-panel2'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-bold text-ink truncate">{c.name}</p>
                  <span className={`mono text-[11.5px] font-bold ${b.outstanding > 0 ? 'text-rose-500' : b.outstanding < 0 ? 'text-sky-500' : 'text-emerald-500'}`}>
                    {inr(Math.abs(b.outstanding))}{b.outstanding < 0 ? ' adv' : ''}
                  </span>
                </div>
                <p className="text-[10.5px] text-mut mt-0.5">{c.city} · {c.terms} · billed {inr(b.billed)}</p>
              </motion.button>
            ))}
            {list.length === 0 && <Empty title="No clients found" hint="Try a different search or add a new firm." />}
          </div>
        </div>

        {/* statement */}
        {sel && bal ? (
          <div className="space-y-3.5 min-w-0">
            <div className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display font-bold text-[17px] text-ink">{sel.name}</h2>
                  <p className="text-[11.5px] text-mut mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin size={11} /> {sel.address}, {sel.city}, {sel.state}</span>
                    <span className="flex items-center gap-1"><Phone size={11} /> {sel.phone} ({sel.contact})</span>
                  </p>
                  <p className="text-[10.5px] text-mut mt-1 mono">GSTIN {sel.gstin} · terms {sel.terms} · client since {fmtDate(sel.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary btn-sm" onClick={() => setPayClient(sel)}><Receipt size={13} /> Record payment</button>
                  <button className="btn-outline btn-sm" onClick={() => setPrintDoc({ kind: 'statement', client: sel, rows: statement, totals: bal })}>
                    <Printer size={13} /> Statement
                  </button>
                  <button className="btn-outline btn-sm" onClick={async () => {
                    const text = `Dear ${encodeURIComponent(sel.contact || 'Sir')}, your outstanding balance with ${encodeURIComponent(data.settings.name)} is ${inr(Math.abs(bal.outstanding))} as of ${fmtDate(todayISO())}. Kindly confirm.`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    await log('reminder', sel.id, 'reminder.sent', `Balance reminder → ${sel.name}`, 'WhatsApp balance confirmation sent');
                    toast('Balance reminder queued via WhatsApp', 'info');
                  }}><Bell size={13} /> Remind</button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mt-4">
                {[
                  ['Total invoiced', inr(bal.billed), 'text-ink'],
                  ['Payments received', inr(bal.received), 'text-emerald-500'],
                  [bal.outstanding >= 0 ? 'Outstanding balance' : 'Advance held', inr(Math.abs(bal.outstanding)), bal.outstanding > 0 ? 'text-rose-500' : 'text-sky-500'],
                ].map(([k, v, cls]) => (
                  <div key={k as string} className="rounded-md border border-line bg-panel2/40 px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-mut">{k}</p>
                    <p className={`mono font-bold text-[16px] mt-0.5 ${cls}`}>{v}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-x-auto">
              <table className="tbl w-full min-w-[640px]">
                <thead>
                  <tr>
                    <th>Date</th><th>Particulars</th><th>Reference</th>
                    <th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.map((r) => (
                    <tr key={r.id}>
                      <td className="mono text-[11.5px] text-mut whitespace-nowrap">{fmtDate(r.date, false)}</td>
                      <td>
                        <span className="flex items-center gap-2 text-[12.5px] text-ink">
                          {r.type === 'invoice' ? <FileText size={12} className="text-amber-500 shrink-0" /> : <Receipt size={12} className="text-emerald-500 shrink-0" />}
                          {r.detail}
                        </span>
                      </td>
                      <td className="mono text-[11px] text-mut">{r.ref}</td>
                      <td className="mono text-[12px] text-right text-ink">{r.debit ? inr(r.debit) : <span className="text-mut/50">—</span>}</td>
                      <td className="mono text-[12px] text-right text-emerald-500">{r.credit ? inr(r.credit) : <span className="text-mut/50">—</span>}</td>
                      <td className={`mono text-[12.5px] text-right font-bold ${r.balance > 0 ? 'text-ink' : 'text-emerald-500'}`}>{inr(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {statement.length === 0 && <Empty title="Ledger is empty" hint="Invoices and payments for this client will post here automatically." />}
            </div>

            <ClientActivity clientId={sel.id} />
          </div>
        ) : (
          <div className="card"><Empty title="Select a client" hint="Choose a firm from the directory to open its khata." /></div>
        )}
      </div>

      <ClientEditor open={editorOpen} initial={editing} onClose={() => setEditorOpen(false)} />
      {payClient && (
        <PaymentModal open onClose={() => setPayClient(null)} clientId={payClient.id}
          defaultAmount={clientBalance(payClient.id, data.invoices, data.payments).outstanding}
          title={`Payment from ${payClient.name}`} />
      )}
    </div>
  );

  function ClientActivity({ clientId }: { clientId: string }) {
    const entries = data!.audit.filter((a) => a.entity === 'client' && a.entityId === clientId)
      .concat(data!.audit.filter((a) => a.detail.includes(data!.clients.find((c) => c.id === clientId)?.name ?? '§')))
      .slice(0, 5);
    if (entries.length === 0) return null;
    return (
      <div className="card p-4">
        <h3 className="font-display font-semibold text-[13px] text-ink mb-2">Recent ledger events</h3>
        <div className="space-y-1.5">
          {entries.map((a) => (
            <div key={a.id} className="flex items-baseline gap-2 text-[11.5px]">
              <span className="mono text-[10px] text-mut shrink-0 w-[70px]">{timeAgo(a.ts)}</span>
              <span className="font-semibold text-ink">{a.label}</span>
              <span className="text-mut truncate">— {a.detail}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
}
