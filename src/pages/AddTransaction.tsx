import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import { categoryService, Category } from '../services/categoryService';
import { theme } from '../theme';
import AppHeader from '../components/layout/AppHeader';
import { PlusCircle } from 'lucide-react';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.radius.md,
  fontSize: theme.fontSizes.body,
  fontFamily: theme.fontFamily.base,
  color: theme.colors.textPrimary,
  background: '#fff',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: theme.fontSizes.label,
  fontWeight: theme.fontWeights.semibold,
  color: theme.colors.textSecondary,
  marginBottom: '6px',
};

const AddTransaction: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    accountId: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'debit' as 'debit' | 'credit',
    amount: '',
    categoryId: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  const loadData = useCallback(async () => {
    try {
      // Auth check + display name in one call
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setUserEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');

      const [accs, cats] = await Promise.all([
        accountService.getAccounts(),
        categoryService.getCategories(),
      ]);
      setAccounts(accs);
      setCategories(cats);
      if (accs.length > 0) setFormData(prev => ({ ...prev, accountId: accs[0].id }));
    } catch (err: any) {
      setError(err.message);
    }
  }, [navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (!formData.accountId || !formData.description || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please fill all required fields with valid values'); return;
    }
    try {
      setLoading(true); setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const account = accounts.find(a => a.id === formData.accountId);
      if (!account) throw new Error('Account not found');

      let newBalance = Number(account.balance) || 0;
      if (formData.type === 'debit') newBalance -= parsedAmount;
      else newBalance += parsedAmount;

      const selectedCat = categories.find(c => c.id === formData.categoryId);

      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: formData.accountId,
        transaction_date: formData.date,
        description: formData.description,
        transaction_type: formData.type,
        amount: parsedAmount,
        balance: newBalance,
        category: selectedCat?.name || 'Uncategorized',
        category_id: formData.categoryId || null,
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('accounts').update({ balance: newBalance }).eq('id', formData.accountId);
      if (updateError) throw updateError;

      navigate('/transactions-list');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ backgroundColor: theme.colors.background, minHeight: '100vh', fontFamily: theme.fontFamily.base }}>
      <AppHeader title="Add Transaction" userEmail={userEmail} displayName={displayName} activePage="add-transaction" />

      <div style={{ padding: '24px 16px 80px', maxWidth: '560px', margin: '0 auto' }}>

        {/* Page Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: theme.radius.md, background: theme.colors.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlusCircle size={18} color={theme.colors.primary} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: theme.fontSizes.heading1, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>Add Transaction</h1>
            <p style={{ margin: 0, fontSize: theme.fontSizes.caption, color: theme.colors.textMuted }}>Record a new income or expense</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" style={{ padding: '12px 16px', background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: theme.radius.md, fontSize: theme.fontSizes.label, marginBottom: '16px' }}>
            &#9888;&#65039; {error}
          </div>
        )}

        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: theme.colors.card, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border}` }}>
            <p style={{ color: theme.colors.textSecondary, marginBottom: '16px' }}>You need to create an account first</p>
            <button
              onClick={() => navigate('/accounts')}
              style={{ padding: '10px 24px', background: theme.colors.btnPrimary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontWeight: theme.fontWeights.semibold, cursor: 'pointer', fontFamily: theme.fontFamily.base }}
            >
              Create Account
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: theme.colors.card, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.card, padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Account */}
            <div>
              <label htmlFor="txn-account" style={labelStyle}>Account *</label>
              <select id="txn-account" value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })} style={inputStyle} required>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type.replace('_', ' ')})</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label htmlFor="txn-date" style={labelStyle}>Date *</label>
              <input id="txn-date" type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inputStyle} required />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="txn-desc" style={labelStyle}>Description *</label>
              <input id="txn-desc" type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g., Grocery shopping, Salary credit" style={inputStyle} required />
            </div>

            {/* Type */}
            <div>
              <span style={labelStyle}>Type *</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }} role="group" aria-label="Transaction type">
                {(['debit', 'credit'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    aria-pressed={formData.type === t}
                    style={{
                      padding: '10px', border: '2px solid',
                      borderColor: formData.type === t ? (t === 'debit' ? '#DC2626' : '#16A34A') : theme.colors.border,
                      borderRadius: theme.radius.md,
                      background: formData.type === t ? (t === 'debit' ? '#FEF2F2' : '#F0FDF4') : '#fff',
                      color: formData.type === t ? (t === 'debit' ? '#DC2626' : '#16A34A') : theme.colors.textSecondary,
                      fontWeight: formData.type === t ? theme.fontWeights.semibold : theme.fontWeights.regular,
                      fontSize: theme.fontSizes.label,
                      cursor: 'pointer',
                      fontFamily: theme.fontFamily.base,
                      transition: 'all 0.15s',
                    }}
                  >
                    {t === 'debit' ? '\u2191 Expense (Debit)' : '\u2193 Income (Credit)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="txn-amount" style={labelStyle}>Amount *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.textMuted, fontSize: theme.fontSizes.body }}>&#8377;</span>
                <input
                  id="txn-amount"
                  type="number" step="0.01" min="0.01"
                  value={formData.amount}
                  onChange={e => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  style={{ ...inputStyle, paddingLeft: '26px' }}
                  required
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="txn-category" style={labelStyle}>Category</label>
              <select id="txn-category" value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} style={inputStyle}>
                <option value="">Uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '4px' }}>
              <button
                type="button" onClick={() => navigate('/transactions-list')}
                style={{ padding: '12px', background: '#fff', color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.medium, cursor: 'pointer', fontFamily: theme.fontFamily.base }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                style={{ padding: '12px', background: loading ? '#94A3B8' : theme.colors.btnPrimary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.semibold, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: theme.fontFamily.base }}
              >
                {loading ? 'Adding...' : 'Add Transaction'}
              </button>
            </div>

          </form>
        )}
      </div>
    </div>
  );
};

export default AddTransaction;
