import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
    loadDashboardData();
  }, []);

  const checkUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    navigate('/auth');
  } else {
    setUserEmail(session.user.email || '');
  }
};


  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const accountsData = await accountService.getAccounts();
      setAccounts(accountsData);
      
      const total = accountsData.reduce((sum, acc) => sum + Number(acc.balance), 0);
      setTotalBalance(total);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getAccountIcon = (type: string) => {
    const icons: Record<string, string> = {
      bank: '🏦',
      credit_card: '💳',
      savings: '💰',
      investment: '📈',
      wallet: '👛'
    };
    return icons[type] || '💼';
  };

  if (loading) {
    return <div className="dashboard-container"><p>Loading...</p></div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1>Welcome to FinStack</h1>
          <p className="user-email">{userEmail}</p>
        </div>
        <div className="header-actions">
        <button onClick={() => navigate('/transactions')} className="btn-primary">
          Upload Transactions
        </button>
        <button onClick={() => navigate('/profile')} className="btn-secondary">
          Profile
        </button>
        <button onClick={() => navigate('/accounts')} className="btn-secondary">
          Manage Accounts
        </button>
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>
      </header>

      <div className="dashboard-summary">
        <div className="summary-card total-balance-card">
          <h3>Total Balance</h3>
          <p className="amount">{formatCurrency(totalBalance)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Accounts</h3>
          <p className="amount">{accounts.length}</p>
        </div>
      </div>

      <div className="dashboard-section">
        <div className="section-header">
          <h2>Your Accounts</h2>
          <button onClick={() => navigate('/accounts')} className="btn-link">
            View All →
          </button>
        </div>
        
        {accounts.length === 0 ? (
          <div className="empty-state">
            <p>No accounts yet</p>
            <button onClick={() => navigate('/accounts')} className="btn-primary">
              Add Your First Account
            </button>
          </div>
        ) : (
          <div className="accounts-list">
            {accounts.slice(0, 4).map(account => (
              <div key={account.id} className="account-item" style={{ borderLeftColor: account.color }}>
                <div className="account-info">
                  <span className="account-icon">{getAccountIcon(account.type)}</span>
                  <div>
                    <h4>{account.name}</h4>
                    <p className="account-type">{account.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <p className="account-balance">{formatCurrency(account.balance)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
