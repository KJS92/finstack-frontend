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
import './App.css';


function App() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait for Supabase to restore session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
      </div>
    </Router>
  );
}

// Custom component to handle root route
function RootRedirect() {
  const hash = window.location.hash;
  
  // If there's a recovery token in the hash, don't redirect
  if (hash && hash.includes('type=recovery')) {
    return null; // AuthHandler will take care of navigation
  }
  
  // Otherwise redirect to auth
  return <Navigate to="/auth" replace />;
}

export default App;
