import React, { useState, useEffect } from 'react';
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
  fontFamily: 'Inter, sans-serif',
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

  useEffect(() => { checkUser(); loadData(); }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate('/auth');
    else setUserEmail(session.user.email || '');
  };

  const loadData = async () => {
    try {
      const [accs, cats] = await Promise.all([
        accountService.getAccounts(),
        categoryService.getCategories(),
      ]);
      setAccounts(accs);
      setCategories(cats);
      if (accs.length > 0) setFormData(prev => ({ ...prev, accountId: accs[0].id }));
    } catch (err: any) { setError(err.message); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.accountId || !formData.description || !formData.amount) {
      setError('Please fill all required fields'); return;
    }
    try {
      setLoading(true); setError('');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const account = accounts.find(a => a.id === formData.accountId);
      if (!account) throw new Error('Account not found');

      const amount = parseFloat(formData.amount);
      let newBalance = account.balance || 0;
      if (formData.type === 'debit') newBalance -= amount;
      else newBalance += amount;

      const selectedCat = categories.find(c => c.id === formData.categoryId);

      const { error: insertError } = await supabase.from('transactions').insert({
        user_id: user.id,
        account_id: formData.accountId,
        transaction_date: formData.date,
        description: formData.description,
        transaction_type: formData.type,
        amount,
        balance: newBalance,
        category: selectedCat?.name || 'Uncategorized',
        category_id: formData.categoryId || null,
      });
      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('accounts').update({ balance: newBalance }).eq('id', formData.accountId);
      if (updateError) throw updateError;

      navigate('/transactions-list');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ backgroundColor: theme.colors.background, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <AppHeader title="Add Transaction" userEmail={userEmail} activePage="add-transaction" />

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
          <div style={{ padding: '12px 16px', background: '#FFF1F2', color: '#E11D48', border: '1px solid #FECDD3', borderRadius: theme.radius.md, fontSize: theme.fontSizes.label, marginBottom: '16px' }}>
            ⚠️ {error}
          </div>
        )}

        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', background: theme.colors.card, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border}` }}>
            <p style={{ color: theme.colors.textSecondary, marginBottom: '16px' }}>You need to create an account first</p>
            <button onClick={() => navigate('/accounts')} style={{ padding: '10px 24px', background: theme.colors.btnPrimary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontWeight: theme.fontWeights.semibold, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
              Create Account
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ background: theme.colors.card, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border}`, boxShadow: theme.shadows.card, padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Account */}
            <div>
              <label style={labelStyle}>Account *</label>
              <select value={formData.accountId} onChange={e => setFormData({ ...formData, accountId: e.target.value })} style={inputStyle} required>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.type.replace('_', ' ')})</option>)}
              </select>
            </div>

            {/* Date */}
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inputStyle} required />
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description *</label>
              <input type="text" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="e.g., Grocery shopping, Salary credit" style={inputStyle} required />
            </div>

            {/* Type */}
            <div>
              <label style={labelStyle}>Type *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(['debit', 'credit'] as const).map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setFormData({ ...formData, type: t })}
                    style={{
                      padding: '10px', border: `2px solid`,
                      borderColor: formData.type === t ? (t === 'debit' ? '#DC2626' : '#16A34A') : theme.colors.border,
                      borderRadius: theme.radius.md,
                      background: formData.type === t ? (t === 'debit' ? '#FEF2F2' : '#F0FDF4') : '#fff',
                      color: formData.type === t ? (t === 'debit' ? '#DC2626' : '#16A34A') : theme.colors.textSecondary,
                      fontWeight: formData.type === t ? theme.fontWeights.semibold : theme.fontWeights.regular,
                      fontSize: theme.fontSizes.label,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t === 'debit' ? '↑ Expense (Debit)' : '↓ Income (Credit)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label style={labelStyle}>Amount *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: theme.colors.textMuted, fontSize: theme.fontSizes.body }}>₹</span>
                <input type="number" step="0.01" min="0" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" style={{ ...inputStyle, paddingLeft: '26px' }} required />
              </div>
            </div>

            {/* Category */}
            <div>
              <label style={labelStyle}>Category</label>
              <select value={formData.categoryId} onChange={e => setFormData({ ...formData, categoryId: e.target.value })} style={inputStyle}>
                <option value="">Uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '4px' }}>
              <button
                type="button" onClick={() => navigate('/transactions-list')}
                style={{ padding: '12px', background: '#fff', color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.medium, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={loading}
                style={{ padding: '12px', background: loading ? '#94A3B8' : theme.colors.btnPrimary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.semibold, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif' }}
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
