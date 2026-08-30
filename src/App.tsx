import { AnimatePresence, motion } from 'framer-motion';
import { Factory } from 'lucide-react';
import { AppProvider, useApp } from './state/AppStore';
import { Layout } from './components/Layout';
import { PrintOverlay } from './components/PrintSheet';
import { ToastHost } from './components/ui';
import { Dashboard } from './features/Dashboard';
import { OrdersPage } from './features/OrdersPage';
import { InvoicesPage } from './features/InvoicesPage';
import { ClientsPage } from './features/ClientsPage';
import { VendorsPage } from './features/VendorsPage';
import { SettingsPage } from './features/SettingsPage';

function Splash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center shadow-[0_0_50px_rgba(245,165,36,.35)]">
        <Factory size={26} className="text-accent-ink" strokeWidth={2.3} />
      </motion.div>
      <div className="text-center">
        <p className="font-display font-bold text-[17px] text-ink">FactoryCore</p>
        <p className="text-xs text-mut mt-1 flex items-center gap-2 justify-center">
          Opening local vault
          <span className="flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="w-1 h-1 rounded-full bg-accent"
                animate={{ opacity: [.2, 1, .2] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.18 }} />
            ))}
          </span>
        </p>
      </div>
    </div>
  );
}

function Shell() {
  const { ready, view } = useApp();
  if (!ready) return <Splash />;
  return (
    <>
      <div className="app-shell">
        <Layout>
          <AnimatePresence mode="wait">
            <motion.div key={view.page}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
              {view.page === 'dashboard' && <Dashboard />}
              {view.page === 'orders' && <OrdersPage />}
              {view.page === 'invoices' && <InvoicesPage />}
              {view.page === 'clients' && <ClientsPage />}
              {view.page === 'vendors' && <VendorsPage />}
              {view.page === 'settings' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </Layout>
      </div>
      <PrintOverlay />
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
