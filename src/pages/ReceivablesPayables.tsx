import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import AppHeader from '../components/layout/AppHeader';
import { receivablesPayablesService, ReceivablePayable } from '../services/receivablesPayablesService';
import { Plus, TrendingUp, TrendingDown, AlertCircle, Calendar, User, Phone, Edit, Trash2, DollarSign } from 'lucide-react';

const ReceivablesPayables: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');
  const [entries, setEntries] = useState<ReceivablePayable[]>([]);
  const [summary, setSummary] = useState({
    totalReceivable: 0,
    totalPayable: 0,
    pendingReceivable: 0,
    pendingPayable: 0,
    overdueReceivable: 0,
    overduePayable: 0
  });
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ReceivablePayable | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    contact_name: '',
    contact_phone: '',
    total_amount: '',
    paid_amount: '0',
    due_date: '',
    category: ''
  });

  const [paymentData, setPaymentData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      await receivablesPayablesService.updateOverdueStatus();
      
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAmount = parseFloat(formData.total_amount);
      const paidAmount = parseFloat(formData.paid_amount);
      const remainingAmount = totalAmount - paidAmount;

      await receivablesPayablesService.create({
        type: activeTab,
        title: formData.title,
        description: formData.description || undefined,
        contact_name: formData.contact_name || undefined,
        contact_phone: formData.contact_phone || undefined,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        due_date: formData.due_date || undefined,
        category: formData.category || undefined,
        status: paidAmount >= totalAmount ? 'completed' : paidAmount > 0 ? 'partial' : 'pending'
      });

      setShowAddModal(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('Failed to create entry');
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;

    try {
      const amount = parseFloat(paymentData.amount);
      await receivablesPayablesService.addPayment(
        selectedEntry.id,
        amount,
        paymentData.payment_date,
        paymentData.notes || undefined
      );

      setShowPaymentModal(false);
      setSelectedEntry(null);
      resetPaymentForm();
      loadData();
    } catch (error) {
      console.error('Error adding payment:', error);
      alert('Failed to add payment');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this entry?')) return;
    
    try {
      await receivablesPayablesService.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      contact_name: '',
      contact_phone: '',
      total_amount: '',
      paid_amount: '0',
      due_date: '',
      category: ''
    });
  };

  const resetPaymentForm = () => {
    setPaymentData({
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      notes: ''
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'green';
      case 'partial': return 'orange';
      case 'overdue': return 'red';
      default: return 'blue';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Paid';
      case 'partial': return 'Partial';
      case 'overdue': return 'Overdue';
      default: return 'Pending';
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <AppHeader title="Receivables & Payables" userEmail={user.email || ''} activePage="receivables" />
      
      <div className="page-container">
        {/* Summary Cards */}
        <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 500 }}>To Receive</span>
              <TrendingUp size={20} color="#16a34a" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#14532d' }}>
              ₹{summary.pendingReceivable.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#b91c1c', fontWeight: 500 }}>To Pay</span>
              <TrendingDown size={20} color="#dc2626" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#7f1d1d' }}>
              ₹{summary.pendingPayable.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#c2410c', fontWeight: 500 }}>Overdue</span>
              <AlertCircle size={20} color="#ea580c" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9a3412' }}>
              ₹{(summary.overdueReceivable + summary.overduePayable).toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('receivable')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'receivable' ? '3px solid #2563eb' : 'none',
              color: activeTab === 'receivable' ? '#2563eb' : '#666',
              fontWeight: activeTab === 'receivable' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Receivables (Money to Collect)
          </button>
          <button
            onClick={() => setActiveTab('payable')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'payable' ? '3px solid #2563eb' : 'none',
              color: activeTab === 'payable' ? '#2563eb' : '#666',
              fontWeight: activeTab === 'payable' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Payables (Money to Pay)
          </button>
        </div>

        {/* Add Button */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            marginBottom: '24px'
          }}
        >
          <Plus size={20} />
          Add {activeTab === 'receivable' ? 'Receivable' : 'Payable'}
        </button>

        {/* Entries List */}
        {loading ? (
          <div>Loading...</div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
            No {activeTab}s found. Click "Add" to create one.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {entries.map(entry => (
              <div
                key={entry.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  borderLeft: `4px solid ${getStatusColor(entry.status)}`
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>
                      {entry.title}
                    </h3>
                    {entry.description && (
                      <p style={{ fontSize: '14px', color: '#666', margin: '0 0 8px 0' }}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      padding: '4px 12px',
                      background: `${getStatusColor(entry.status)}20`,
                      color: getStatusColor(entry.status),
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: 500
                    }}
                  >
                    {getStatusLabel(entry.status)}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  {entry.contact_name && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666' }}>
                      <User size={16} />
                      {entry.contact_name}
                    </div>
                  )}
                  {entry.contact_phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666' }}>
                      <Phone size={16} />
                      {entry.contact_phone}
                    </div>
                  )}
                  {entry.due_date && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#666' }}>
                      <Calendar size={16} />
                      {new Date(entry.due_date).toLocaleDateString('en-IN')}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#f9fafb', borderRadius: '8px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Total Amount</div>
                    <div style={{ fontSize: '18px', fontWeight: 600 }}>₹{entry.total_amount.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Paid</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#16a34a' }}>₹{entry.paid_amount.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Remaining</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#dc2626' }}>₹{entry.remaining_amount.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {entry.status !== 'completed' && (
                    <button
                      onClick={() => {
                        setSelectedEntry(entry);
                        setShowPaymentModal(true);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 16px',
                        background: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <DollarSign size={16} />
                      Add Payment
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    style={{
                      padding: '8px 16px',
                      background: '#dc2626',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <h2 style={{ marginTop: 0 }}>Add {activeTab === 'receivable' ? 'Receivable' : 'Payable'}</h2>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Contact Name</label>
                    <input
                      type="text"
                      value={formData.contact_name}
                      onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Contact Phone</label>
                    <input
                      type="tel"
                      value={formData.contact_phone}
                      onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Total Amount *</label>
                    <input
                      type="number"
                      value={formData.total_amount}
                      onChange={(e) => setFormData({ ...formData, total_amount: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Paid Amount</label>
                    <input
                      type="number"
                      value={formData.paid_amount}
                      onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Due Date</label>
                    <input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Category</label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      placeholder="e.g. Loan, Rent"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); resetForm(); }}
                    style={{ padding: '10px 20px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && selectedEntry && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '90%'
            }}>
              <h2 style={{ marginTop: 0 }}>Add Payment</h2>
              <p style={{ color: '#666', fontSize: '14px', marginBottom: '16px' }}>
                Remaining: ₹{selectedEntry.remaining_amount.toLocaleString('en-IN')}
              </p>
              <form onSubmit={handleAddPayment}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Amount *</label>
                  <input
                    type="number"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                    required
                    min="0"
                    max={selectedEntry.remaining_amount}
                    step="0.01"
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentData.payment_date}
                    onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                    required
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Notes</label>
                  <textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                    rows={3}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => { setShowPaymentModal(false); setSelectedEntry(null); resetPaymentForm(); }}
                    style={{ padding: '10px 20px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '10px 20px', background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Add Payment
                  </button>
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
