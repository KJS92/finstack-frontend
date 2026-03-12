import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './config/supabase';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import Profile from './pages/Profile';
import Transactions from './pages/Transactions';
import TransactionPreview from './pages/TransactionPreview';
import TransactionsList from './pages/TransactionsList';
import PasswordReset from './pages/PasswordReset';
import UpdatePassword from './pages/UpdatePassword';
import AuthHandler from './components/AuthHandler';
import AddTransaction from './pages/AddTransaction';
import Categories from './pages/Categories';
import Budgets from './pages/Budgets';
import Reports from './pages/Reports';
import ReceivablesPayables from './pages/ReceivablesPayables';
import Assets from './pages/Assets';
import AdminPanel from './pages/AdminPanel';
import BottomNav from './components/layout/BottomNav';
import './App.css';

function RootRedirect() {
  const hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) return null;
  return <Navigate to="/auth" replace />;
}

// Route guard: only renders children if user has is_admin in user_metadata
function AdminRoute({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ok' | 'denied'>('loading');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setStatus('denied'); return; }
      setStatus(user.user_metadata?.is_admin === true ? 'ok' : 'denied');
    });
  }, []);

  if (status === 'loading') return null;
  if (status === 'denied') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function App() {
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(() => setLoading(false));
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => setLoading(false));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowInstallBanner(true);
    });
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', fontSize: '20px' }}>
      Loading...
    </div>
  );

  if (!isOnline) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb', color: '#374151', textAlign: 'center', padding: '24px' }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>\uD83D\uDCE1</div>
      <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>You're Offline</h2>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '280px' }}>No internet connection. Please check your network and try again.</p>
      <button onClick={() => window.location.reload()} style={{ marginTop: '24px', padding: '12px 24px', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' }}>Retry</button>
    </div>
  );

  return (
    <Router>
      <div className="App">
        <AuthHandler />

        {showInstallBanner && (
          <div style={{ position: 'fixed', bottom: '70px', left: '16px', right: '16px', background: '#1f2937', color: 'white', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>\uD83D\uDCF2 Install FinStack</div>
              <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>Add to home screen for the best experience</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowInstallBanner(false)} style={{ background: 'transparent', color: '#9ca3af', border: 'none', fontSize: '13px', cursor: 'pointer' }}>Later</button>
              <button onClick={handleInstall} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Install</button>
            </div>
          </div>
        )}

        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/add-transaction" element={<AddTransaction />} />
          <Route path="/transaction-preview" element={<TransactionPreview />} />
          <Route path="/transactions-list" element={<TransactionsList />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/budgets" element={<Budgets />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/receivables" element={<ReceivablesPayables />} />
          <Route path="/assets" element={<Assets />} />
          <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        </Routes>

        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
