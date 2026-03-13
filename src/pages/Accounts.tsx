import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account, CreateAccountInput } from '../services/accountService';
import { X } from 'lucide-react';
import './Accounts.css';
import AppHeader from '../components/layout/AppHeader';

const Accounts: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form state — balance kept as string to prevent NaN mid-typing
  const [formData, setFormData] = useState<Omit<CreateAccountInput, 'balance'> & { balance: string }>({
    name: '',
    type: 'bank',
    balance: '',
    account_number: '',
    bank_name: '',
    color: '#3B82F6',
  });

  useEffect(() => {
    checkUser();
    loadAccounts();
  }, []);

  // Close modal on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { setShowModal(false); setConfirmDeleteId(null); }
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    setUserEmail(user.email || '');
    setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
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

  const openCreateModal = () => {
    setEditingAccount(null);
    setFormData({ name: '', type: 'bank', balance: '', account_number: '', bank_name: '', color: '#3B82F6' });
    setError('');
    setShowModal(true);
  };

  const openEditModal = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance.toString(),
      account_number: account.account_number || '',
      bank_name: account.bank_name || '',
      color: account.color,
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBalance = parseFloat(formData.balance);
    if (isNaN(parsedBalance)) {
      setError('Please enter a valid balance');
      return;
    }
    setError('');
    try {
      const payload: CreateAccountInput = { ...formData, balance: parsedBalance };
      if (editingAccount) {
        await accountService.updateAccount(editingAccount.id, payload);
      } else {
        await accountService.createAccount(payload);
      }
      setShowModal(false);
      await loadAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    // Inline confirmation — window.confirm is blocked in PWA standalone mode
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await accountService.deleteAccount(id);
      setConfirmDeleteId(null);
      await loadAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getAccountIcon = (type: string) => {
    const icons: Record<string, string> = {
      bank: '\uD83C\uDFE6',
      credit_card: '\uD83D\uDCB3',
      savings: '\uD83D\uDCB0',
      investment: '\uD83D\uDCC8',
      wallet: '\uD83D\uDC5B',
    };
    return icons[type] || '\uD83D\uDCBC';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);

  const totalBalance = accounts
    .filter(a => a.type !== 'credit_card')
    .reduce((sum, acc) => sum + Number(acc.balance), 0);

  if (loading) return (
    <div className="accounts-container">
      <p style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>Loading accounts...</p>
    </div>
  );

  return (
    <div className="accounts-container">
      <AppHeader title="Accounts" userEmail={userEmail} displayName={displayName} activePage="accounts" />

      <div className="accounts-body">
        {error && <div className="error-message" role="alert">{error}</div>}

        {/* Summary bar */}
        <div className="accounts-summary">
          <div>
            <p className="summary-label">Net Balance</p>
            <p className="summary-value">{formatCurrency(totalBalance)}</p>
          </div>
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
                  <button onClick={() => openEditModal(account)} className="btn-edit">Edit</button>
                  {confirmDeleteId === account.id ? (
                    <div className="confirm-delete">
                      <span>Sure?</span>
                      <button onClick={() => handleDelete(account.id)} className="btn-confirm-yes">Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="btn-confirm-no">No</button>
                    </div>
                  ) : (
                    <button onClick={() => handleDelete(account.id)} className="btn-delete">Delete</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)} role="presentation">
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-modal-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 id="account-modal-title">{editingAccount ? 'Edit Account' : 'Add New Account'}</h2>
              <button onClick={() => setShowModal(false)} className="modal-close" aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            {error && <div className="error-message modal-error" role="alert">{error}</div>}

            <form onSubmit={handleSubmit} className="account-form">
              <div className="form-group">
                <label htmlFor="acc-name">Account Name *</label>
                <input id="acc-name" type="text" value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HDFC Savings" required />
              </div>

              <div className="form-group">
                <label htmlFor="acc-type">Account Type *</label>
                <select id="acc-type" value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })} required>
                  <option value="bank">Bank Account</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="savings">Savings</option>
                  <option value="investment">Investment</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="acc-bank">Bank Name</label>
                <input id="acc-bank" type="text" value={formData.bank_name}
                  onChange={e => setFormData({ ...formData, bank_name: e.target.value })}
                  placeholder="e.g., HDFC Bank" />
              </div>

              <div className="form-group">
                <label htmlFor="acc-number">Account Number (last 4 digits)</label>
                <input id="acc-number" type="text" value={formData.account_number}
                  onChange={e => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g., 1234" maxLength={20} />
              </div>

              <div className="form-group">
                <label htmlFor="acc-balance">Current Balance (&#8377;)</label>
                <input id="acc-balance" type="number" step="0.01"
                  value={formData.balance}
                  onChange={e => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="0.00" />
              </div>

              <div className="form-group">
                <label htmlFor="acc-color">Card Color</label>
                <input id="acc-color" type="color" value={formData.color}
                  onChange={e => setFormData({ ...formData, color: e.target.value })} />
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary">{editingAccount ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounts;
