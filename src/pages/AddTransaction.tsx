import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import './AddTransaction.css';
import AppHeader from '../components/layout/AppHeader';


const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formData, setFormData] = useState({
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'debit' as 'debit' | 'credit',
    amount: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');


  useEffect(() => {
    checkUser();
    loadAccounts();
  }, []);

  const checkUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    navigate('/auth');
  } else {
    setUserEmail(session.user.email || '');
  }
};

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAccounts();
      setAccounts(data);
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, accountId: data[0].id }));
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountId || !formData.description || !formData.amount) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get current account balance
      const account = accounts.find(a => a.id === formData.accountId);
      if (!account) throw new Error('Account not found');

      const amount = parseFloat(formData.amount);
      
      // Calculate new balance
      let newBalance = account.balance || 0;
      if (formData.type === 'debit') {
        newBalance -= amount;
      } else {
        newBalance += amount;
      }

      // Insert transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          account_id: formData.accountId,
          transaction_date: formData.date,
          description: formData.description,
          transaction_type: formData.type,
          amount: amount,
          balance: newBalance,
          category: 'Uncategorized'
        });

      if (insertError) throw insertError;

      // Update account balance
      const { error: updateError } = await supabase
        .from('accounts')
        .update({ balance: newBalance })
        .eq('id', formData.accountId);

      if (updateError) throw updateError;

      alert('Transaction added successfully!');
      navigate('/transactions-list');

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  return (
    <div className="add-transaction-container">
      <AppHeader 
  title="Add Transaction" 
  userEmail={userEmail} 
  activePage="add-transaction"
/>

      {error && <div className="error-message">{error}</div>}

      {accounts.length === 0 ? (
        <div className="empty-state">
          <p>You need to create an account first</p>
          <button onClick={() => navigate('/accounts')} className="btn-primary">
            Create Account
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="transaction-form">
          <div className="form-group">
            <label>Account *</label>
            <select
              value={formData.accountId}
              onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
              required
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.type})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="e.g., Grocery shopping, Salary credit"
              required
            />
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debit' | 'credit' })}
              required
            >
              <option value="debit">Debit (Money Out / Expense)</option>
              <option value="credit">Credit (Money In / Income)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Amount *</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Transaction'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default AddTransaction;
