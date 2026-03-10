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
import BottomNav from './components/layout/BottomNav';
import './App.css';

// ✅ Moved OUTSIDE App — defined before it's used
function RootRedirect() {
  const hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    return null;
  }
  return <Navigate to="/auth" replace />;
}

function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  
const [isOnline, setIsOnline] = useState(navigator.onLine);

useEffect(() => {
  const handleOnline = () => setIsOnline(true);
  const handleOffline = () => setIsOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '20px'
      }}>
        Loading...
      </div>
    );
  }

if (!isOnline) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: '#f9fafb',
      color: '#374151',
      textAlign: 'center',
      padding: '24px'
    }}>
      <div style={{ fontSize: '64px', marginBottom: '16px' }}>📡</div>
      <h2 style={{ fontSize: '22px', fontWeight: '700', marginBottom: '8px' }}>
        You're Offline
      </h2>
      <p style={{ fontSize: '15px', color: '#6b7280', maxWidth: '280px' }}>
        No internet connection. Please check your network and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '24px',
          padding: '12px 24px',
          background: '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        Retry
      </button>
    </div>
  );
}
  
  return (
    <Router>
      <div className="App">
        <AuthHandler />
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
        </Routes>
        <BottomNav />
      </div>
    </Router>
  );
} // ✅ App's closing brace is now correct

export default App;
