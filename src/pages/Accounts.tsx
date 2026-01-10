import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account, CreateAccountInput } from '../services/accountService';
import './Accounts.css';

const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState<CreateAccountInput>({
    name: '',
    type: 'bank',
    balance: 0,
    account_number: '',
    bank_name: '',
    color: '#3B82F6'
  });

  useEffect(() => {
    checkUser();
    loadAccounts();
  }, []);

  const checkUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    navigate('/auth');
  }
};

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await accountService.getAccounts();
      setAccounts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData({
      name: '',
      type: 'bank',
      balance: 0,
      account_number: '',
      bank_name: '',
      color: '#3B82F6'
    });
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance,
      account_number: account.account_number || '',
      bank_name: account.bank_name || '',
      color: account.color
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingAccount) {
        await accountService.updateAccount(editingAccount.id, formData);
      } else {
        await accountService.createAccount(formData);
      }
      setShowModal(false);
      loadAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;

    try {
      await accountService.deleteAccount(id);
      loadAccounts();
    } catch (err: any) {
      setError(err.message);
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0);

  if (loading) {
    return <div className="accounts-container"><p>Loading accounts...</p></div>;
  }

  return (
    <div className="accounts-container">
      <header className="accounts-header">
        <div>
          <h1>My Accounts</h1>
          <p className="total-balance">Total Balance: {formatCurrency(totalBalance)}</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Dashboard
          </button>
          <button onClick={() => navigate('/categories')} className="btn-secondary">
            Categories
          </button>
          <button onClick={() => navigate('/profile')} className="btn-secondary">
            Profile
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="accounts-actions">
        <button onClick={openCreateModal} className="btn-primary">
          + Add Account
        </button>
      </div>

      <div className="accounts-grid">
        {accounts.length === 0 ? (
          <div className="empty-state">
            <p>No accounts yet. Create your first account to get started!</p>
          </div>
        ) : (
          accounts.map(account => (
            <div key={account.id} className="account-card" style={{ borderLeftColor: account.color }}>
              <div className="account-header">
                <span className="account-icon">{getAccountIcon(account.type)}</span>
                <h3>{account.name}</h3>
              </div>
              <p className="account-type">{account.type.replace('_', ' ').toUpperCase()}</p>
              {account.bank_name && <p className="account-bank">{account.bank_name}</p>}
              {account.account_number && (
                <p className="account-number">****{account.account_number.slice(-4)}</p>
              )}
              <p className="account-balance">{formatCurrency(account.balance)}</p>
              <div className="account-actions">
                <button onClick={() => openEditModal(account)} className="btn-edit">
                  Edit
                </button>
                <button onClick={() => handleDelete(account.id)} className="btn-delete">
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>{editingAccount ? 'Edit Account' : 'Add New Account'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HDFC Savings"
                  required
                />
              </div>

              <div className="form-group">
                <label>Account Type *</label>
                <select
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                  required
                >
                  <option value="bank">Bank Account</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>

              <div className="form-group">
                <label>Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name}
                  onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="e.g., HDFC Bank"
                />
              </div>

              <div className="form-group">
                <label>Account Number (Last 4 digits)</label>
                <input
                  type="text"
                  value={formData.account_number}
                  onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g., 1234"
                  maxLength={20}
                />
              </div>

              <div className="form-group">
                <label>Current Balance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={e => setFormData({ ...formData, balance: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label>Color</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingAccount ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
