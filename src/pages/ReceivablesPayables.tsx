import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import AppHeader from '../components/layout/AppHeader';
import { receivablesPayablesService, ReceivablePayable } from '../services/receivablesPayablesService';
import { Plus, TrendingUp, TrendingDown, AlertCircle, Calendar, User, Phone, Edit, Trash2, Repeat } from 'lucide-react';
import { theme } from '../theme';

const ReceivablesPayables: React.FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [entries, setEntries] = useState<ReceivablePayable[]>([]);
  const [summary, setSummary] = useState({ totalReceivable: 0, totalPayable: 0, pendingReceivable: 0, pendingPayable: 0, overdueReceivable: 0, overduePayable: 0 });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ReceivablePayable | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '', description: '', contact_name: '', contact_phone: '',
    total_amount: '', paid_amount: '0', due_date: '', category: '',
    is_recurring: false, recurring_frequency: 'monthly' as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    recurring_day: '', recurring_end_date: ''
  });

  const [paymentData, setPaymentData] = useState({
    amount: '', payment_date: new Date().toISOString().split('T')[0], notes: ''
  });

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #ddd', borderRadius: '8px',
    fontSize: '14px', boxSizing: 'border-box',
    fontFamily: theme.fontFamily.base,
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      await receivablesPayablesService.updateOverdueStatus();
      await receivablesPayablesService.generateRecurringEntries();
      const [entriesData, summaryData] = await Promise.all([
        receivablesPayablesService.getByType(activeTab),
        receivablesPayablesService.getSummary()
      ]);
      setEntries(entriesData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Single auth call on mount — no separate checkUser
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setUserEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      await loadData();
    };
    init();
  }, [navigate, loadData]);

  // Reload when tab changes (after initial mount)
  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const totalAmount = parseFloat(formData.total_amount);
    const paidAmount = parseFloat(formData.paid_amount);
    if (isNaN(totalAmount) || totalAmount <= 0) { setFormError('Enter a valid total amount'); return; }
    try {
      const entryData = {
        type: activeTab, title: formData.title, description: formData.description || undefined,
        contact_name: formData.contact_name || undefined, contact_phone: formData.contact_phone || undefined,
        total_amount: totalAmount, paid_amount: isNaN(paidAmount) ? 0 : paidAmount,
        remaining_amount: totalAmount - (isNaN(paidAmount) ? 0 : paidAmount),
        due_date: formData.due_date || undefined, category: formData.category || undefined,
        status: ((isNaN(paidAmount) ? 0 : paidAmount) >= totalAmount ? 'completed' : (isNaN(paidAmount) ? 0 : paidAmount) > 0 ? 'partial' : 'pending') as 'completed' | 'partial' | 'pending',
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.is_recurring ? formData.recurring_frequency : undefined,
        recurring_day: formData.is_recurring && formData.recurring_day ? parseInt(formData.recurring_day) : undefined,
        recurring_end_date: formData.is_recurring && formData.recurring_end_date ? formData.recurring_end_date : undefined,
        last_generated_date: undefined, parent_recurring_id: undefined
      };
      if (editMode && selectedEntry) await receivablesPayablesService.update(selectedEntry.id, entryData);
      else await receivablesPayablesService.create(entryData);
      setShowAddModal(false); setSelectedEntry(null); setEditMode(false); resetForm();
      await loadData();
    } catch (error: any) {
      setFormError(error.message || 'Failed to save entry');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setFormError('');
    try {
      await receivablesPayablesService.addPayment(
        selectedEntry.id, parseFloat(paymentData.amount),
        paymentData.payment_date, paymentData.notes || undefined
      );
      setShowPaymentModal(false); setSelectedEntry(null); resetPaymentForm();
      await loadData();
    } catch (error: any) {
      setFormError(error.message || 'Failed to add payment');
    }
  };

  const handleEdit = (entry: ReceivablePayable) => {
    setFormData({
      title: entry.title, description: entry.description || '', contact_name: entry.contact_name || '',
      contact_phone: entry.contact_phone || '', total_amount: entry.total_amount.toString(),
      paid_amount: entry.paid_amount.toString(), due_date: entry.due_date ? entry.due_date.split('T')[0] : '',
      category: entry.category || '', is_recurring: entry.is_recurring || false,
      recurring_frequency: entry.recurring_frequency || 'monthly',
      recurring_day: entry.recurring_day?.toString() || '',
      recurring_end_date: entry.recurring_end_date ? entry.recurring_end_date.split('T')[0] : ''
    });
    setFormError('');
    setSelectedEntry(entry); setEditMode(true); setShowAddModal(true);
  };

  // Inline two-tap delete — window.confirm blocked in PWA standalone mode
  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await receivablesPayablesService.delete(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (error: any) {
      console.error('Error deleting entry:', error);
    }
  };

  const resetForm = () => setFormData({
    title: '', description: '', contact_name: '', contact_phone: '',
    total_amount: '', paid_amount: '0', due_date: '', category: '',
    is_recurring: false, recurring_frequency: 'monthly', recurring_day: '', recurring_end_date: ''
  });
  const resetPaymentForm = () => setPaymentData({
    amount: '', payment_date: new Date().toISOString().split('T')[0], notes: ''
  });

  const getStatusColor = (status: string) =>
    ({ completed: '#16a34a', partial: '#ea580c', overdue: '#dc2626' }[status] || '#2563eb');
  const getStatusLabel = (status: string) =>
    ({ completed: 'Paid', partial: 'Partial', overdue: 'Overdue' }[status] || 'Pending');

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: theme.fontFamily.base }}>
      <AppHeader title="Receivables & Payables" userEmail={userEmail} displayName={displayName} activePage="receivables" />

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderTop: '3px solid #16a34a', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>To Receive</span>
              <TrendingUp size={16} color="#16a34a" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#14532d' }}>&#8377;{summary.pendingReceivable.toLocaleString('en-IN')}</div>
            {summary.overdueReceivable > 0 && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>&#8377;{summary.overdueReceivable.toLocaleString('en-IN')} overdue</div>}
          </div>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderTop: '3px solid #dc2626', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#b91c1c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>To Pay</span>
              <TrendingDown size={16} color="#dc2626" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#7f1d1d' }}>&#8377;{summary.pendingPayable.toLocaleString('en-IN')}</div>
            {summary.overduePayable > 0 && <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>&#8377;{summary.overduePayable.toLocaleString('en-IN')} overdue</div>}
          </div>
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderTop: '3px solid #ea580c', borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Overdue</span>
              <AlertCircle size={16} color="#ea580c" />
            </div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#9a3412' }}>&#8377;{(summary.overdueReceivable + summary.overduePayable).toLocaleString('en-IN')}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
          {(['receivable', 'payable'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              color: activeTab === tab ? theme.colors.primary : '#6b7280',
              fontWeight: activeTab === tab ? 700 : 400,
              cursor: 'pointer', fontSize: '15px', fontFamily: theme.fontFamily.base,
              transition: 'all 0.15s',
            }}>
              {tab === 'receivable' ? 'Receivables (Money to Collect)' : 'Payables (Money to Pay)'}
            </button>
          ))}
        </div>

        {/* Add Button */}
        <button
          onClick={() => { setEditMode(false); setSelectedEntry(null); resetForm(); setFormError(''); setShowAddModal(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', background: theme.colors.primary,
            color: '#fff', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            marginBottom: '20px', fontFamily: theme.fontFamily.base,
          }}
        >
          <Plus size={18} />
          Add {activeTab === 'receivable' ? 'Receivable' : 'Payable'}
        </button>

        {/* Entries */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontFamily: theme.fontFamily.base }}>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#9ca3af', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 12px', fontSize: '15px' }}>No {activeTab}s yet</p>
            <button onClick={() => setShowAddModal(true)} style={{ padding: '10px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: theme.fontFamily.base }}>
              + Add {activeTab === 'receivable' ? 'Receivable' : 'Payable'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {entries.map(entry => (
              <div key={entry.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', borderLeft: `3px solid ${getStatusColor(entry.status)}`, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {entry.title}
                      {entry.is_recurring && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                          <Repeat size={10} /> Recurring
                        </span>
                      )}
                    </h3>
                    {entry.description && <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>{entry.description}</p>}
                  </div>
                  <span style={{ padding: '3px 10px', background: `${getStatusColor(entry.status)}18`, color: getStatusColor(entry.status), borderRadius: '20px', fontSize: '12px', fontWeight: 600, flexShrink: 0 }}>
                    {getStatusLabel(entry.status)}
                  </span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '14px' }}>
                  {entry.contact_name && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#6b7280' }}><User size={13} />{entry.contact_name}</span>}
                  {entry.contact_phone && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#6b7280' }}><Phone size={13} />{entry.contact_phone}</span>}
                  {entry.due_date && <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#6b7280' }}><Calendar size={13} />{new Date(entry.due_date).toLocaleDateString('en-IN')}</span>}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '14px' }}>
                  {[{ label: 'Total Amount', val: entry.total_amount, color: '#111' }, { label: 'Paid', val: entry.paid_amount, color: '#16a34a' }, { label: 'Remaining', val: entry.remaining_amount, color: '#dc2626' }].map(({ label, val, color }) => (
                    <div key={label}>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color }}>&#8377;{val.toLocaleString('en-IN')}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {entry.status !== 'completed' && (
                    <button onClick={() => { setSelectedEntry(entry); setFormError(''); setShowPaymentModal(true); }}
                      style={{ padding: '8px 16px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px', fontFamily: theme.fontFamily.base }}>
                      <span style={{ fontWeight: 'bold' }}>&#8377;</span> Add Payment
                    </button>
                  )}
                  <button onClick={() => handleEdit(entry)}
                    style={{ padding: '8px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Edit size={15} />
                  </button>
                  {confirmDeleteId === entry.id ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', fontFamily: theme.fontFamily.base }}>
                      Sure?
                      <button onClick={() => handleDelete(entry.id)} style={{ padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: theme.fontFamily.base }}>Yes</button>
                      <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '6px 12px', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#64748B', fontFamily: theme.fontFamily.base }}>No</button>
                    </span>
                  ) : (
                    <button onClick={() => handleDelete(entry.id)}
                      style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAddModal(false)} role="presentation">
            <div role="dialog" aria-modal="true" aria-labelledby="rp-modal-title" style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <h2 id="rp-modal-title" style={{ marginTop: 0, fontSize: '18px', fontFamily: theme.fontFamily.base }}>{editMode ? 'Edit' : 'Add'} {activeTab === 'receivable' ? 'Receivable' : 'Payable'}</h2>
              {formError && <div role="alert" style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', fontFamily: theme.fontFamily.base }}>{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Title *</label><input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required style={inputStyle} /></div>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Description</label><textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Contact Name</label><input type="text" value={formData.contact_name} onChange={e => setFormData({ ...formData, contact_name: e.target.value })} style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Contact Phone</label><input type="tel" value={formData.contact_phone} onChange={e => setFormData({ ...formData, contact_phone: e.target.value })} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Total Amount *</label><input type="number" value={formData.total_amount} onChange={e => setFormData({ ...formData, total_amount: e.target.value })} required min="0.01" step="0.01" style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Paid Amount</label><input type="number" value={formData.paid_amount} onChange={e => setFormData({ ...formData, paid_amount: e.target.value })} min="0" step="0.01" style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Due Date</label><input type="date" value={formData.due_date} onChange={e => setFormData({ ...formData, due_date: e.target.value })} style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Category</label><input type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. Loan, Rent" style={inputStyle} /></div>
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, fontFamily: theme.fontFamily.base }}>
                    <input type="checkbox" checked={formData.is_recurring} onChange={e => setFormData({ ...formData, is_recurring: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                    <Repeat size={14} color={theme.colors.primary} /> Recurring Entry
                  </label>
                </div>
                {formData.is_recurring && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '14px', marginBottom: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                      <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Frequency *</label>
                        <select value={formData.recurring_frequency} onChange={e => setFormData({ ...formData, recurring_frequency: e.target.value as any })} style={inputStyle}>
                          <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option>
                        </select>
                      </div>
                      {(formData.recurring_frequency === 'monthly' || formData.recurring_frequency === 'quarterly') && (
                        <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Day of Month</label><input type="number" value={formData.recurring_day} onChange={e => setFormData({ ...formData, recurring_day: e.target.value })} min="1" max="31" placeholder="e.g. 5" style={inputStyle} /></div>
                      )}
                    </div>
                    <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>End Date (Optional)</label><input type="date" value={formData.recurring_end_date} onChange={e => setFormData({ ...formData, recurring_end_date: e.target.value })} style={inputStyle} /></div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                  <button type="button" onClick={() => { setShowAddModal(false); setSelectedEntry(null); setEditMode(false); resetForm(); setFormError(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontFamily: theme.fontFamily.base, fontWeight: 500 }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: theme.fontFamily.base, fontWeight: 600 }}>{editMode ? 'Update' : 'Create'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedEntry && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowPaymentModal(false)} role="presentation">
            <div role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '400px', width: '90%' }} onClick={e => e.stopPropagation()}>
              <h2 id="payment-modal-title" style={{ marginTop: 0, fontSize: '18px', fontFamily: theme.fontFamily.base }}>Add Payment</h2>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '16px' }}>Remaining: &#8377;{selectedEntry.remaining_amount.toLocaleString('en-IN')}</p>
              {formError && <div role="alert" style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', fontFamily: theme.fontFamily.base }}>{formError}</div>}
              <form onSubmit={handleAddPayment}>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Amount *</label><input type="number" value={paymentData.amount} onChange={e => setPaymentData({ ...paymentData, amount: e.target.value })} required min="0.01" max={selectedEntry.remaining_amount} step="0.01" style={inputStyle} /></div>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Payment Date *</label><input type="date" value={paymentData.payment_date} onChange={e => setPaymentData({ ...paymentData, payment_date: e.target.value })} required style={inputStyle} /></div>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Notes</label><textarea value={paymentData.notes} onChange={e => setPaymentData({ ...paymentData, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={() => { setShowPaymentModal(false); setSelectedEntry(null); resetPaymentForm(); setFormError(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontFamily: theme.fontFamily.base, fontWeight: 500 }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: theme.fontFamily.base, fontWeight: 600 }}>Add Payment</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceivablesPayables;
