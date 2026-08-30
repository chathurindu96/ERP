import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Moon, Sun, RotateCcw, HardDrive } from 'lucide-react';
import { useApp } from '../state/AppStore';
import { Field, Confirm, PageHead, Seg } from '../components/ui';
import { TERMS_OPTIONS } from '../lib/utils';
import type { FactorySettings } from '../db/schema';

export function SettingsPage() {
  const { data, saveSettings, theme, toggleTheme, resetDemo } = useApp();
  const [f, setF] = useState<FactorySettings | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [storage, setStorage] = useState<{ used: number; quota: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data && !f) setF({ ...data.settings });
  }, [data, f]);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setStorage({ used: e.usage ?? 0, quota: e.quota ?? 0 })).catch(() => {});
  }, []);

  if (!data || !f) return null;
  const set = (k: keyof FactorySettings, v: string) => setF((x) => (x ? { ...x, [k]: v } : x));

  const onLogo = (file: File | null) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setF((x) => (x ? { ...x, logo: String(r.result) } : x));
    r.readAsDataURL(file);
  };

  const kb = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

  return (
    <div className="max-w-[900px]">
      <PageHead kicker="Configuration" title="Factory setup"
        right={<button className="btn-primary btn-sm" onClick={() => saveSettings(f)}>Save profile</button>} />

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4 space-y-3.5">
          <h2 className="font-display font-semibold text-[14px] text-ink">Identity & invoice header</h2>
          <Field label="Factory name"><input className="input" value={f.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <Field label="Tagline / line of business"><input className="input" value={f.tagline} onChange={(e) => set('tagline', e.target.value)} /></Field>
          <Field label="GSTIN"><input className="input mono" value={f.gstin} onChange={(e) => set('gstin', e.target.value)} /></Field>
          <Field label="Registered address"><input className="input" value={f.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><input className="input mono" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            <Field label="Email"><input className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
          </div>
          <Field label="Factory logo (prints on invoices & challans)">
            <div className="flex items-center gap-3">
              {f.logo ? (
                <img src={f.logo} alt="logo" className="h-12 max-w-[140px] object-contain rounded border border-line bg-white p-1" />
              ) : (
                <div className="h-12 px-4 rounded border border-dashed border-line flex items-center text-[11px] text-mut">No logo uploaded</div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0] ?? null)} />
              <button className="btn-outline btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Upload</button>
              {f.logo && <button className="btn-ghost btn-sm text-rose-500 hover:text-rose-400" onClick={() => setF((x) => (x ? { ...x, logo: undefined } : x))}><Trash2 size={13} /></button>}
            </div>
          </Field>
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3.5">
            <h2 className="font-display font-semibold text-[14px] text-ink">Billing defaults</h2>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Invoice prefix"><input className="input mono" value={f.invoicePrefix} onChange={(e) => set('invoicePrefix', e.target.value)} /></Field>
              <Field label="Challan prefix"><input className="input mono" value={f.challanPrefix} onChange={(e) => set('challanPrefix', e.target.value)} /></Field>
              <Field label="Default terms">
                <select className="input" value={f.defaultTerms} onChange={(e) => set('defaultTerms', e.target.value)}>
                  {TERMS_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Bank transfer details">
              <div className="space-y-2.5">
                <input className="input" placeholder="Bank name" value={f.bankName} onChange={(e) => set('bankName', e.target.value)} />
                <div className="grid grid-cols-2 gap-2.5">
                  <input className="input mono" placeholder="Account no." value={f.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} />
                  <input className="input mono" placeholder="IFSC" value={f.ifsc} onChange={(e) => set('ifsc', e.target.value)} />
                </div>
                <input className="input" placeholder="Branch" value={f.bankBranch} onChange={(e) => set('bankBranch', e.target.value)} />
              </div>
            </Field>
            <Field label="Invoice footer / terms note">
              <textarea className="input" rows={3} value={f.invoiceFooter} onChange={(e) => set('invoiceFooter', e.target.value)} />
            </Field>
          </div>

          <div className="card p-4 space-y-3">
            <h2 className="font-display font-semibold text-[14px] text-ink">Workspace</h2>
            <Field label="Interface theme">
              <Seg options={[{ id: 'dark', label: 'Dark floor' }, { id: 'light', label: 'Light office' }]}
                value={theme} onChange={(v) => { if (v !== theme) toggleTheme(); }} />
            </Field>
            <div className="flex items-center gap-2.5 text-[12px] text-mut">
              <HardDrive size={14} className="text-accent" />
              <span>
                IndexedDB usage: <b className="mono text-ink">{storage ? kb(storage.used) : '…'}</b>
                {storage?.quota ? ` of ${kb(storage.quota)}` : ''} — every record lives on this device.
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-md border border-rose-500/25 bg-rose-500/6 px-3 py-2.5">
              <p className="text-[11.5px] text-mut">Wipe all records and restore the sample factory dataset.</p>
              <button className="btn-danger btn-sm" onClick={() => setConfirmReset(true)}><RotateCcw size={13} /> Reset demo</button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button className="btn-primary" onClick={() => saveSettings(f)}>Save profile</button>
      </div>

      <Confirm open={confirmReset} onClose={() => setConfirmReset(false)} danger yesLabel="Wipe & reseed"
        title="Reset all FactoryCore data?"
        body="Every order, invoice, payment, client and vendor record on this device will be permanently deleted and replaced with the demo dataset. Export anything you need first."
        onYes={() => resetDemo()} />
    </div>
  );
}
