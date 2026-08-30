import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, FileText, Users, Truck, Settings as SettingsIcon,
  Plus, Search, Sun, Moon, Wifi, WifiOff, Database, Factory, ChevronRight, X,
} from 'lucide-react';
import { useApp, type Page } from '../state/AppStore';
import { invStatus, paidForInvoice } from '../lib/utils';

const NAV: { id: Page; label: string; icon: typeof LayoutDashboard; key: string }[] = [
  { id: 'dashboard', label: 'Command Deck', icon: LayoutDashboard, key: '1' },
  { id: 'orders', label: 'Order Pipeline', icon: ClipboardList, key: '2' },
  { id: 'invoices', label: 'Tax Invoices', icon: FileText, key: '3' },
  { id: 'clients', label: 'Client Khata', icon: Users, key: '4' },
  { id: 'vendors', label: 'Vendor Payables', icon: Truck, key: '5' },
  { id: 'settings', label: 'Factory Setup', icon: SettingsIcon, key: '6' },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-3 h-14 border-b border-white/8">
      <div className="w-8 h-8 rounded-md bg-amber-400 flex items-center justify-center shadow-[0_0_24px_rgba(245,165,36,.35)]">
        <Factory size={17} className="text-[#1c1204]" strokeWidth={2.4} />
      </div>
      <div className="leading-none">
        <p className="font-display font-bold text-[15px] text-slate-100 tracking-tight">FactoryCore</p>
        <p className="text-[9.5px] font-semibold uppercase tracking-[.16em] text-slate-500 mt-1">Industrial ERP</p>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const { data, go } = useApp();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, []);

  const results = useMemo(() => {
    if (!data || q.trim().length < 2) return null;
    const s = q.trim().toLowerCase();
    return {
      orders: data.orders.filter((o) => o.orderNo.toLowerCase().includes(s)).slice(0, 3),
      invoices: data.invoices.filter((i) => i.invoiceNo.toLowerCase().includes(s)).slice(0, 3),
      clients: data.clients.filter((c) => c.name.toLowerCase().includes(s) || c.city.toLowerCase().includes(s)).slice(0, 3),
    };
  }, [data, q]);

  const empty = results && results.orders.length + results.invoices.length + results.clients.length === 0;

  return (
    <div ref={ref} className="relative w-full max-w-[380px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-mut pointer-events-none" />
      <input
        className="input pl-8 h-8.5 pr-16 bg-panel"
        placeholder="Search orders, invoices, clients…"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      <span className="kbd absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex">/</span>
      <AnimatePresence>
        {open && results && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute top-full mt-1.5 left-0 right-0 card shadow-2xl overflow-hidden z-40">
            {empty && <p className="px-3.5 py-3 text-xs text-mut">No records match “{q}”.</p>}
            {results.orders.length > 0 && <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-mut">Orders</p>}
            {results.orders.map((o) => (
              <button key={o.id} className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-panel2 text-left cursor-pointer"
                onClick={() => { go('orders', { orderId: o.id }); setOpen(false); setQ(''); }}>
                <span className="text-[12.5px] font-semibold text-ink">{o.orderNo}</span>
                <span className="text-[11px] text-mut flex items-center gap-1">pipeline <ChevronRight size={12} /></span>
              </button>
            ))}
            {results.invoices.length > 0 && <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-mut">Invoices</p>}
            {results.invoices.map((i) => (
              <button key={i.id} className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-panel2 text-left cursor-pointer"
                onClick={() => { go('invoices', { invoiceId: i.id }); setOpen(false); setQ(''); }}>
                <span className="text-[12.5px] font-semibold text-ink">{i.invoiceNo}</span>
                <span className="text-[11px] text-mut flex items-center gap-1">billing <ChevronRight size={12} /></span>
              </button>
            ))}
            {results.clients.length > 0 && <p className="px-3.5 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-mut">Clients</p>}
            {results.clients.map((c) => (
              <button key={c.id} className="w-full flex items-center justify-between px-3.5 py-2 hover:bg-panel2 text-left cursor-pointer"
                onClick={() => { go('clients', { clientId: c.id }); setOpen(false); setQ(''); }}>
                <span className="text-[12.5px] font-semibold text-ink">{c.name}</span>
                <span className="text-[11px] text-mut flex items-center gap-1">{c.city} <ChevronRight size={12} /></span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { view, go, data, theme, toggleTheme, online, setPrintDoc, printDoc } = useApp();
  const [sideOpen, setSideOpen] = useState(false);

  const openOrders = data?.orders.filter((o) => !['invoiced', 'cancelled'].includes(o.status)).length ?? 0;
  const overdueCount = useMemo(() =>
    data ? data.invoices.filter((i) => invStatus(i, paidForInvoice(i.id, data.payments)) === 'overdue').length : 0,
  [data]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (printDoc) return;
      const nav = NAV.find((n) => n.key === e.key);
      if (nav) { go(nav.id); setSideOpen(false); }
      if (e.key.toLowerCase() === 'n') {
        go('orders');
        window.setTimeout(() => window.dispatchEvent(new CustomEvent('fc-new-order')), 60);
      }
      if (e.key.toLowerCase() === 't') toggleTheme();
      if (e.key === '/') {
        e.preventDefault();
        (document.querySelector('input[placeholder^="Search"]') as HTMLInputElement | null)?.focus();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [go, toggleTheme, printDoc]);

  const newOrder = () => {
    go('orders');
    setSideOpen(false);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent('fc-new-order')), 60);
  };

  const counts: Partial<Record<Page, number>> = { orders: openOrders, invoices: overdueCount };

  return (
    <div className="min-h-screen flex">
      {/* ------- Sidebar (always graphite) ------- */}
      <aside className={`no-print fixed lg:static z-40 top-0 bottom-0 left-0 w-[218px] bg-side border-r border-white/8 flex flex-col transition-transform lg:translate-x-0 ${sideOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <BrandMark />
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          <p className="px-3 pb-1.5 text-[9.5px] font-bold uppercase tracking-[.18em] text-slate-600">Operations</p>
          {NAV.map((n) => {
            const Icon = n.icon;
            const on = view.page === n.id;
            const c = counts[n.id];
            return (
              <button key={n.id} onClick={() => { go(n.id); setSideOpen(false); }}
                className={`side-link ${on ? 'side-link-on' : ''}`}>
                <Icon size={15.5} strokeWidth={on ? 2.3 : 2} />
                <span className="flex-1 text-left">{n.label}</span>
                {typeof c === 'number' && c > 0 && (
                  <span className={`mono text-[10px] font-bold px-1.5 py-0.5 rounded ${n.id === 'invoices' ? 'bg-rose-500/15 text-rose-400' : 'bg-white/8 text-slate-300'}`}>{c}</span>
                )}
                <span className="text-[9px] text-slate-600 font-mono hidden lg:block">{n.key}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3.5 py-3 border-t border-white/8 space-y-2">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold text-slate-500">
            <Database size={12} className="text-amber-500/80" />
            <span>Local-first · IndexedDB</span>
            <span className={`ml-auto w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-rose-400 pulse-dot'}`} />
          </div>
          <p className="text-[9.5px] leading-relaxed text-slate-600">
            {online ? 'Device synced — records persist offline too.' : 'Offline mode — orders keep saving locally.'}
          </p>
        </div>
      </aside>
      {sideOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden no-print" onMouseDown={() => setSideOpen(false)} />}

      {/* ------- Main column ------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-30 h-14 flex items-center gap-3 px-4 lg:px-6 border-b border-line bg-canvas/85 backdrop-blur-sm">
          <button className="btn-ghost btn-sm lg:hidden -ml-1.5" onClick={() => setSideOpen(true)} aria-label="Open menu">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <span className={`hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11px] font-bold ${online ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/8' : 'border-rose-500/40 text-rose-500 bg-rose-500/10'}`}>
              {online ? <Wifi size={12} /> : <WifiOff size={12} className="pulse-dot" />}
              {online ? 'Online' : 'Offline'}
            </span>
            <button className="btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <div className="w-px h-5 bg-line mx-1" />
            <button className="btn-primary btn-sm" onClick={newOrder}>
              <Plus size={14} strokeWidth={2.6} /> <span className="hidden sm:inline">New Order</span>
              <span className="kbd hidden sm:inline-flex text-accent-ink/60 border-accent-ink/25 bg-transparent">N</span>
            </button>
          </div>
        </header>
        <main className="flex-1 px-4 lg:px-6 py-5 lg:py-6 w-full max-w-[1460px] mx-auto">{children}</main>
      </div>
    </div>
  );
}

export function MobileClose({ onClose }: { onClose: () => void }) {
  return <button className="btn-ghost btn-xs" onClick={onClose}><X size={14} /></button>;
}
