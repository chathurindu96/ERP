import { type ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle, CheckCircle2, Info, Inbox } from 'lucide-react';
import type { Tone } from '../lib/utils';
import { useApp } from '../state/AppStore';

export const TONE_CLASS: Record<Tone, string> = {
  slate: 'b-slate', amber: 'b-amber', blue: 'b-blue', emerald: 'b-emerald', rose: 'b-rose',
};

export function StatusBadge({ tone, children, pulse }: { tone: Tone; children: ReactNode; pulse?: boolean }) {
  return (
    <span className={TONE_CLASS[tone]}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${pulse ? 'pulse-dot' : ''}`} />
      {children}
    </span>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, subtitle, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode;
  children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8 no-print"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} my-auto shadow-2xl`}
          >
            <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-line">
              <div>
                <h3 className="font-display font-semibold text-[15px] text-ink">{title}</h3>
                {subtitle && <p className="text-xs text-mut mt-0.5">{subtitle}</p>}
              </div>
              <button className="btn-ghost btn-xs -mr-1.5 mt-0.5" onClick={onClose} aria-label="Close">
                <X size={15} />
              </button>
            </div>
            <div className="px-5 py-4">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-panel2/50 rounded-b-lg">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Drawer ---------------- */

export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-xl' }: {
  open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode;
  children: ReactNode; footer?: ReactNode; width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/55 no-print"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            className={`absolute right-0 top-0 bottom-0 w-full ${width} bg-panel border-l border-line shadow-2xl flex flex-col`}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line shrink-0">
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-[15px] text-ink truncate">{title}</h3>
                {subtitle && <div className="text-xs text-mut mt-0.5">{subtitle}</div>}
              </div>
              <button className="btn-ghost btn-xs shrink-0" onClick={onClose} aria-label="Close drawer">
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="shrink-0 border-t border-line px-5 py-3.5 bg-panel2/50">{footer}</div>}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Form ---------------- */

export const Field = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={className}>
    <span className="lbl">{label}</span>
    {children}
  </div>
);

export function Seg({ options, value, onChange }: {
  options: { id: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 p-1 rounded-md border border-line bg-canvas">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)}
          className={`h-7 px-2 rounded text-xs font-semibold transition-all cursor-pointer ${
            value === o.id ? 'bg-accent text-accent-ink shadow-sm' : 'text-mut hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Empty state ---------------- */

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center">
      <div className="w-12 h-12 rounded-lg bg-panel2 border border-line flex items-center justify-center text-mut mb-3">
        <Inbox size={20} />
      </div>
      <p className="font-display font-semibold text-[14px] text-ink">{title}</p>
      {hint && <p className="text-xs text-mut mt-1 max-w-[300px]">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Confirm ---------------- */

export function Confirm({ open, onClose, onYes, title, body, yesLabel = 'Confirm', danger }: {
  open: boolean; onClose: () => void; onYes: () => void; title: string; body: string; yesLabel?: string; danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} className={danger ? 'text-rose-500' : 'text-accent'} />{title}
      </span>}
      footer={<>
        <button className="btn-outline" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={() => { onYes(); onClose(); }}>{yesLabel}</button>
      </>}>
      <p className="text-[13px] text-mut leading-relaxed">{body}</p>
    </Modal>
  );
}

/* ---------------- Toasts ---------------- */

export function ToastHost() {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col gap-2 no-print">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="card flex items-center gap-2.5 pl-3 pr-4 py-2.5 shadow-xl min-w-[260px] max-w-[380px] border-l-2"
            style={{ borderLeftColor: t.tone === 'err' ? '#f43f5e' : t.tone === 'info' ? '#38bdf8' : '#10b981' }}
          >
            {t.tone === 'err' ? <AlertTriangle size={15} className="text-rose-500 shrink-0" />
              : t.tone === 'info' ? <Info size={15} className="text-sky-500 shrink-0" />
              : <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />}
            <span className="text-[12.5px] font-medium text-ink">{t.msg}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Misc ---------------- */

export const PageHead = ({ title, kicker, right }: { title: string; kicker?: string; right?: ReactNode }) => (
  <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
    <div>
      {kicker && <p className="text-[10.5px] font-bold uppercase tracking-[.14em] text-accent mb-1">{kicker}</p>}
      <h1 className="font-display font-bold text-[22px] leading-tight text-ink">{title}</h1>
    </div>
    {right && <div className="flex items-center gap-2">{right}</div>}
  </div>
);
