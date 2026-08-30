import { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Printer, X, MessageCircle, Mail, Factory } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { fmtDate, inr, methodLabel, truncate } from '../lib/utils';

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number): string => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''));
const three = (n: number): string => {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? two(r) : '');
};
export function amountInWords(num: number): string {
  let n = Math.round(Math.abs(num));
  if (n === 0) return 'Zero Rupees Only';
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  const parts: string[] = [];
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return parts.join(' ') + ' Rupees Only';
}

function Logo({ dataUrl }: { dataUrl?: string }) {
  if (dataUrl) return <img src={dataUrl} alt="logo" className="h-12 max-w-[150px] object-contain" />;
  return (
    <div className="w-11 h-11 rounded bg-amber-400 flex items-center justify-center">
      <Factory size={22} className="text-[#1c1204]" strokeWidth={2.2} />
    </div>
  );
}

function Head({ title, no, date, meta }: { title: string; no: string; date: string; meta: [string, string][] }) {
  const { data } = useApp();
  const s = data!.settings;
  return (
    <div className="flex items-start justify-between gap-6 pb-4 border-b-2 border-slate-900">
      <div className="flex items-start gap-3">
        <Logo dataUrl={s.logo} />
        <div>
          <p className="font-display font-bold text-[19px] leading-tight text-slate-900">{s.name}</p>
          <p className="text-[10.5px] text-slate-500 mt-0.5 max-w-[300px]">{s.tagline}</p>
          <p className="text-[10.5px] text-slate-600 mt-1">{s.address}</p>
          <p className="text-[10.5px] text-slate-600">GSTIN: <b>{s.gstin}</b> · {s.phone} · {s.email}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-display font-bold text-[15px] tracking-wide text-slate-900 border border-slate-900 px-3 py-1 inline-block">{title}</p>
        <p className="mono text-[13px] font-semibold text-slate-900 mt-2">{no}</p>
        <p className="text-[11px] text-slate-600">Dated: {fmtDate(date)}</p>
        {meta.map(([k, v]) => <p key={k} className="text-[11px] text-slate-600">{k}: <b>{v}</b></p>)}
      </div>
    </div>
  );
}

const PartyBlock = ({ label, lines }: { label: string; lines: string[] }) => (
  <div className="flex-1 border border-slate-300 rounded p-3">
    <p className="text-[9.5px] font-bold uppercase tracking-[.12em] text-slate-400 mb-1">{label}</p>
    {lines.filter(Boolean).map((l, i) => (
      <p key={i} className={`text-[11.5px] text-slate-700 ${i === 0 ? 'font-bold text-slate-900 text-[12.5px]' : ''}`}>{l}</p>
    ))}
  </div>
);

function InvoiceSheet() {
  const { printDoc, data } = useApp();
  if (printDoc?.kind !== 'invoice' || !data) return null;
  const { invoice: inv, client } = printDoc;
  const s = data.settings;
  return (
    <div className="print-sheet p-[13mm] flex flex-col">
      <Head title="TAX INVOICE" no={inv.invoiceNo} date={inv.date}
        meta={[['Payment Due', fmtDate(inv.dueDate)], ['Terms', inv.terms]]} />
      <div className="flex gap-3 mt-4">
        <PartyBlock label="Bill To" lines={[client.name, client.address + ', ' + client.city + ', ' + client.state, 'GSTIN: ' + client.gstin, client.phone]} />
        <PartyBlock label="Dispatch / Transport" lines={['Ex-Factory, Bahadurgarh', 'Mode: Road (consignee request)', 'Risk: On account of buyer']} />
      </div>
      <table className="ptbl mt-4">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th><th>Item Description</th><th>HSN</th><th>Batch No.</th>
            <th className="text-right">Qty</th><th>Unit</th><th className="text-right">Rate (₹)</th>
            <th className="text-right">Disc %</th><th className="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((it, i) => (
            <tr key={i}>
              <td className="mono">{i + 1}</td>
              <td><b>{it.name}</b><br /><span className="text-slate-500 text-[10.5px]">{it.sku}</span></td>
              <td className="mono">{it.hsn}</td>
              <td className="mono">{it.batchNo || '—'}</td>
              <td className="mono text-right">{it.qty.toLocaleString('en-IN')}</td>
              <td>{it.unit}</td>
              <td className="mono text-right">{it.unitPrice.toLocaleString('en-IN')}</td>
              <td className="mono text-right">{it.discountPct ? it.discountPct + '%' : '—'}</td>
              <td className="mono text-right font-semibold">{(it.qty * it.unitPrice * (1 - it.discountPct / 100)).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-4 mt-4">
        <div className="flex-1 space-y-3">
          <div className="border border-slate-300 rounded p-3">
            <p className="text-[9.5px] font-bold uppercase tracking-[.12em] text-slate-400 mb-1.5">Bank Transfer Details</p>
            <p className="text-[11.5px] text-slate-700"><b>{s.bankName}</b>, {s.bankBranch}</p>
            <p className="text-[11.5px] text-slate-700">A/c No: <span className="mono font-semibold">{s.bankAccount}</span> · IFSC: <span className="mono font-semibold">{s.ifsc}</span></p>
          </div>
          <p className="text-[10.5px] text-slate-500 italic leading-relaxed">{inv.notes || s.invoiceFooter}</p>
        </div>
        <div className="w-[260px] shrink-0">
          <table className="w-full text-[12px]">
            <tbody>
              <tr><td className="py-1 text-slate-600">Taxable value</td><td className="py-1 text-right mono font-semibold">{inr(inv.subTotal)}</td></tr>
              {inv.discountAmt > 0 && <tr><td className="py-1 text-slate-600">Discount</td><td className="py-1 text-right mono">− {inr(inv.discountAmt)}</td></tr>}
              <tr><td className="py-1 text-slate-600">CGST</td><td className="py-1 text-right mono">{inr(inv.cgst)}</td></tr>
              <tr><td className="py-1 text-slate-600">SGST</td><td className="py-1 text-right mono">{inr(inv.sgst)}</td></tr>
              {inv.roundOff !== 0 && <tr><td className="py-1 text-slate-600">Round off</td><td className="py-1 text-right mono">{inv.roundOff >= 0 ? '+' : ''}{inr(inv.roundOff).replace('−', '−')}</td></tr>}
              <tr><td className="pt-2 border-t-2 border-slate-900 font-bold text-[13px]">GRAND TOTAL</td>
                <td className="pt-2 border-t-2 border-slate-900 text-right mono font-bold text-[14px]">{inr(inv.total)}</td></tr>
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 mt-2 italic">{amountInWords(inv.total)}</p>
        </div>
      </div>
      <div className="mt-auto pt-8 flex items-end justify-between">
        <p className="text-[10px] text-slate-400 max-w-[380px]">{s.invoiceFooter}</p>
        <div className="text-center">
          <p className="text-[11px] text-slate-700">For <b>{s.name}</b></p>
          <div className="h-14" />
          <p className="text-[10.5px] text-slate-500 border-t border-slate-300 pt-1 px-6">Authorised Signatory</p>
        </div>
      </div>
    </div>
  );
}

function ChallanSheet() {
  const { printDoc, data } = useApp();
  if (printDoc?.kind !== 'challan' || !data) return null;
  const { order, client, challanNo } = printDoc;
  const s = data.settings;
  return (
    <div className="print-sheet p-[13mm] flex flex-col">
      <Head title="DELIVERY CHALLAN" no={challanNo} date={order.date}
        meta={[['Against Order', order.orderNo], ['Due Date', fmtDate(order.dueDate)]]} />
      <div className="flex gap-3 mt-4">
        <PartyBlock label="Consignee" lines={[client.name, client.address + ', ' + client.city + ', ' + client.state, client.phone, 'Contact: ' + client.contact]} />
        <PartyBlock label="Carrier / Driver" lines={['Transporter: ____________________', 'LR No: ____________________', 'Driver name & mobile: ____________________', 'Vehicle No: ____________________']} />
      </div>
      <table className="ptbl mt-4">
        <thead>
          <tr>
            <th style={{ width: 28 }}>#</th><th>Item Description</th><th>Batch No.</th>
            <th className="text-right">Qty</th><th>Unit</th><th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={i}>
              <td className="mono">{i + 1}</td>
              <td><b>{it.name}</b><br /><span className="text-slate-500 text-[10.5px]">{it.sku} · HSN {it.hsn}</span></td>
              <td className="mono">{it.batchNo || '—'}</td>
              <td className="mono text-right font-semibold">{it.qty.toLocaleString('en-IN')}</td>
              <td>{it.unit}</td>
              <td className="text-slate-500">Sealed carton</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10.5px] text-slate-500 mt-3 italic">
        This is a non-negotiable dispatch document and is NOT a demand for payment. Invoice to follow.
        {order.notes ? ' Note: ' + order.notes : ''}
      </p>
      <div className="mt-auto pt-10 grid grid-cols-3 gap-6 text-center">
        {['Prepared By', 'In-charge / Gate Pass', 'Receiver’s Signature & Stamp'].map((t) => (
          <div key={t}>
            <div className="h-12 border-b border-slate-400" />
            <p className="text-[10.5px] text-slate-500 mt-1.5">{t}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatementSheet() {
  const { printDoc } = useApp();
  if (printDoc?.kind !== 'statement') return null;
  const { client, rows, totals } = printDoc;
  return (
    <div className="print-sheet p-[13mm] flex flex-col">
      <Head title="ACCOUNT STATEMENT" no={client.name.toUpperCase()} date={new Date().toISOString()}
        meta={[['Period', 'All records to date'], ['GSTIN', client.gstin]]} />
      <div className="flex gap-3 mt-4">
        {[
          ['Total Invoiced', inr(totals.billed)],
          ['Payments Received', inr(totals.received)],
          [totals.outstanding >= 0 ? 'Balance Receivable' : 'Advance Held', inr(Math.abs(totals.outstanding))],
        ].map(([k, v]) => (
          <div key={k} className="flex-1 border border-slate-300 rounded p-3 text-center">
            <p className="text-[9.5px] font-bold uppercase tracking-[.1em] text-slate-400">{k}</p>
            <p className="mono font-bold text-[15px] text-slate-900 mt-1">{v}</p>
          </div>
        ))}
      </div>
      <table className="ptbl mt-4">
        <thead>
          <tr><th>Date</th><th>Particulars</th><th>Reference</th>
            <th className="text-right">Debit (₹)</th><th className="text-right">Credit (₹)</th><th className="text-right">Balance (₹)</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono whitespace-nowrap">{fmtDate(r.date, false)}</td>
              <td>{r.detail}</td>
              <td className="mono text-[11px]">{r.ref}</td>
              <td className="mono text-right">{r.debit ? r.debit.toLocaleString('en-IN') : '—'}</td>
              <td className="mono text-right">{r.credit ? r.credit.toLocaleString('en-IN') : '—'}</td>
              <td className="mono text-right font-semibold">{r.balance.toLocaleString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-auto pt-8 text-[10px] text-slate-400 italic">
        This is a system-generated statement from FactoryCore ERP and does not require a physical signature. Kindly reconcile and confirm within 7 days.
      </p>
    </div>
  );
}

export function PrintOverlay() {
  const { printDoc, setPrintDoc, data, toast } = useApp();
  const shareText = useMemo(() => {
    if (printDoc?.kind !== 'invoice' || !data) return '';
    const inv = printDoc.invoice;
    const s = data.settings;
    const dear = encodeURIComponent(printDoc.client.contact || 'Sir/Madam');
    return `Dear ${dear},%0A%0AGreetings from ${encodeURIComponent(s.name)}.%0A%0AYour Tax Invoice ${encodeURIComponent(inv.invoiceNo)} dated ${encodeURIComponent(fmtDate(inv.date))} is ready.%0AInvoice value: ${encodeURIComponent(inr(inv.total))}%0APayment due: ${encodeURIComponent(fmtDate(inv.dueDate))}%0A%0ABank: ${encodeURIComponent(s.bankName)}%0AA/c: ${encodeURIComponent(s.bankAccount)}%0AIFSC: ${encodeURIComponent(s.ifsc)}%0A%0AThank you for your business!`;
  }, [printDoc, data]);

  return (
    <AnimatePresence>
      {printDoc && (
        <motion.div className="print-overlay fixed inset-0 z-[60] bg-black/78 overflow-y-auto py-6 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="no-print sticky top-0 z-10 flex items-center justify-center gap-2 pb-4 max-w-[820px] mx-auto">
            <button className="btn-primary" onClick={() => window.print()}>
              <Printer size={15} /> Print / Save as PDF
            </button>
            {printDoc.kind === 'invoice' && printDoc.client.phone && (
              <>
                <a className="btn bg-emerald-600/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/25"
                  href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer"
                  onClick={() => toast('Opening WhatsApp share…', 'info')}>
                  <MessageCircle size={15} /> WhatsApp
                </a>
                <a className="btn-outline"
                  href={`mailto:${printDoc.client.email}?subject=${encodeURIComponent('Tax Invoice ' + printDoc.invoice.invoiceNo + ' — ' + (data?.settings.name ?? ''))}&body=${shareText}`}
                  onClick={() => toast('Opening email draft…', 'info')}>
                  <Mail size={15} /> Email
                </a>
              </>
            )}
            <button className="btn-outline" onClick={() => setPrintDoc(null)}><X size={15} /> Close</button>
          </div>
          <InvoiceSheet />
          <ChallanSheet />
          <StatementSheet />
        </motion.div>
      )}
    </AnimatePresence>
  );
}


