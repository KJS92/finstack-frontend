import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import './Accounts.css';

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
}

interface AccountSummary {
  total_balance: number;
  by_type: {
    [key: string]: {
      count: number;
      total_balance: number;
    };
  };
}

const Accounts: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [message, setMessage] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'bank',
    balance: 0,
    currency: 'INR'
  });

  useEffect(() => {
    fetchAccounts();
    fetchSummary();
  }, []);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchAccounts = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/accounts/`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      setMessage('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/accounts/summary/all`, {
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    try {
      const headers = await getAuthHeaders();
      
      if (editingAccount) {
        // Update existing account
        const response = await fetch(
          `${process.env.REACT_APP_BACKEND_URL}/api/accounts/${editingAccount.id}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              name: formData.name,
              balance: formData.balance
            })
          }
        );

        if (response.ok) {
          setMessage('Account updated successfully!');
          setEditingAccount(null);
        } else {
          const error = await response.json();
          setMessage(error.detail || 'Failed to update account');
        }
      } else {
        // Create new account
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/accounts/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(formData)
        });

        if (response.ok) {
          setMessage('Account created successfully!');
          setShowAddModal(false);
        } else {
          const error = await response.json();
          setMessage(error.detail || 'Failed to create account');
        }
      }

      // Refresh data
      fetchAccounts();
      fetchSummary();
      resetForm();
    } catch (error) {
      setMessage('An error occurred');
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!window.confirm('Are you sure you want to delete this account?')) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/accounts/${accountId}`,
        {
          method: 'DELETE',
          headers
        }
      );

      if (response.ok) {
        setMessage('Account deleted successfully!');
        fetchAccounts();
        fetchSummary();
      } else {
        setMessage('Failed to delete account');
      }
    } catch (error) {
      setMessage('An error occurred');
    }
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance,
      currency: account.currency
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'bank',
      balance: 0,
      currency: 'INR'
    });
    setEditingAccount(null);
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'bank': return '🏦';
      case 'credit_card': return '💳';
      case 'wallet': return '👛';
      case 'upi': return '📱';
      default: return '💰';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return <div className="loading">Loading accounts...</div>;
  }

  return (
    <div className="accounts-container">
      <div className="accounts-header">
        <h1>My Accounts</h1>
        <button
          className="add-button"
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
        >
          + Add Account
        </button>
      </div>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="summary-section">
          <div className="summary-card total">
            <h3>Total Balance</h3>
            <p className="amount">{formatCurrency(summary.total_balance)}</p>
          </div>
          
          {Object.entries(summary.by_type).map(([type, data]) => (
            <div className="summary-card" key={type}>
              <span className="icon">{getAccountIcon(type)}</span>
              <div>
                <h4>{type.replace('_', ' ').toUpperCase()}</h4>
                <p className="count">{data.count} account(s)</p>
                <p className="amount">{formatCurrency(data.total_balance)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accounts List */}
      <div className="accounts-list">
        {accounts.length === 0 ? (
          <div className="empty-state">
            <p>No accounts yet. Add your first account to get started!</p>
          </div>
        ) : (
          accounts.map((account) => (
            <div className="account-card" key={account.id}>
              <div className="account-icon">{getAccountIcon(account.type)}</div>
              <div className="account-info">
                <h3>{account.name}</h3>
                <p className="account-type">{account.type.replace('_', ' ').toUpperCase()}</p>
              </div>
              <div className="account-balance">
                <p className="amount">{formatCurrency(account.balance)}</p>
                <p className="currency">{account.currency}</p>
              </div>
              <div className="account-actions">
                <button
                  className="edit-btn"
                  onClick={() => handleEdit(account)}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  className="delete-btn"
                  onClick={() => handleDelete(account.id)}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => {
          setShowAddModal(false);
          resetForm();
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingAccount ? 'Edit Account' : 'Add New Account'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Account Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., HDFC Savings"
                  required
                />
              </div>

              <div className="form-group">
                <label>Account Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  disabled={!!editingAccount}
                >
                  <option value="bank">Bank Account</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="wallet">Wallet</option>
                  <option value="upi">UPI</option>
                </select>
              </div>

              <div className="form-group">
                <label>Current Balance *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: parseFloat(e.target.value) })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  disabled
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-btn">
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
