import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import AppHeader from '../components/layout/AppHeader';
import { assetsService, Asset } from '../services/assetsService';
import { Plus, Edit, Trash2, TrendingUp, Shield, AlertCircle } from 'lucide-react';

const Assets: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'investment' | 'insurance'>('investment');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState({
    totalInvestments: 0,
    totalInsurance: 0,
    totalNetWorth: 0,
    totalGainLoss: 0,
    upcomingMaturities: [] as Asset[]
  });
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const investmentCategories = [
    { value: 'fd', label: '🏦 Fixed Deposit' },
    { value: 'sip', label: '📈 SIP' },
    { value: 'stocks', label: '📊 Stocks' },
    { value: 'mutual_fund', label: '💹 Mutual Fund' },
    { value: 'ppf', label: '🏛️ PPF' },
    { value: 'nps', label: '👴 NPS' },
    { value: 'gold', label: '🥇 Gold' },
    { value: 'real_estate', label: '🏠 Real Estate' },
    { value: 'other_investment', label: '💰 Other Investment' }
  ];

  const insuranceCategories = [
    { value: 'life_insurance', label: '❤️ Life Insurance' },
    { value: 'health_insurance', label: '🏥 Health Insurance' },
    { value: 'vehicle_insurance', label: '🚗 Vehicle Insurance' },
    { value: 'term_insurance', label: '🛡️ Term Insurance' },
    { value: 'other_insurance', label: '📋 Other Insurance' }
  ];

  const [formData, setFormData] = useState({
    name: '',
    category: 'fd' as Asset['category'],
    current_value: '',
    invested_amount: '',
    purchase_date: '',
    maturity_date: '',
    interest_rate: '',
    institution_name: '',
    policy_number: '',
    notes: '',
    reminder_days: '30',
    is_active: true
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [assetsData, summaryData] = await Promise.all([
        assetsService.getByType(activeTab),
        assetsService.getSummary()
      ]);
      setAssets(assetsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const assetData = {
        name: formData.name,
        type: activeTab,
        category: formData.category,
        current_value: parseFloat(formData.current_value),
        invested_amount: formData.invested_amount ? parseFloat(formData.invested_amount) : undefined,
        purchase_date: formData.purchase_date || undefined,
        maturity_date: formData.maturity_date || undefined,
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
        institution_name: formData.institution_name || undefined,
        policy_number: formData.policy_number || undefined,
        notes: formData.notes || undefined,
        reminder_days: parseInt(formData.reminder_days),
        is_active: true
      };

      if (editMode && selectedAsset) {
        await assetsService.update(selectedAsset.id, assetData);
      } else {
        await assetsService.create(assetData);
      }

      setShowModal(false);
      setEditMode(false);
      setSelectedAsset(null);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error saving asset:', error);
      alert('Failed to save asset');
    }
  };

  const handleEdit = (asset: Asset) => {
    setFormData({
      name: asset.name,
      category: asset.category,
      current_value: asset.current_value.toString(),
      invested_amount: asset.invested_amount?.toString() || '',
      purchase_date: asset.purchase_date ? asset.purchase_date.split('T')[0] : '',
      maturity_date: asset.maturity_date ? asset.maturity_date.split('T')[0] : '',
      interest_rate: asset.interest_rate?.toString() || '',
      institution_name: asset.institution_name || '',
      policy_number: asset.policy_number || '',
      notes: asset.notes || '',
      reminder_days: asset.reminder_days?.toString() || '30',
      is_active: asset.is_active
    });
    setSelectedAsset(asset);
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;
    try {
      await assetsService.delete(id);
      loadData();
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: activeTab === 'investment' ? 'fd' : 'life_insurance',
      current_value: '',
      invested_amount: '',
      purchase_date: '',
      maturity_date: '',
      interest_rate: '',
      institution_name: '',
      policy_number: '',
      notes: '',
      reminder_days: '30',
      is_active: true
    });
  };

  const getDaysToMaturity = (maturityDate: string): number => {
    const today = new Date();
    const maturity = new Date(maturityDate);
    const diff = maturity.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getGainLossColor = (current: number, invested?: number) => {
    if (!invested) return '#666';
    return current >= invested ? '#16a34a' : '#dc2626';
  };

  const currentCategories = activeTab === 'investment' ? investmentCategories : insuranceCategories;

  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <AppHeader title="Assets & Investments" userEmail={user.email || ''} activePage="assets" />

      <div className="page-container">

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#15803d', fontWeight: 500 }}>Total Investments</span>
              <TrendingUp size={20} color="#16a34a" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#14532d' }}>
              ₹{summary.totalInvestments.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#1d4ed8', fontWeight: 500 }}>Total Insurance</span>
              <Shield size={20} color="#2563eb" />
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a' }}>
              ₹{summary.totalInsurance.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: '#7e22ce', fontWeight: 500 }}>Net Worth</span>
              <span style={{ fontSize: '20px' }}>💎</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#581c87' }}>
              ₹{summary.totalNetWorth.toLocaleString('en-IN')}
            </div>
          </div>

          <div style={{
            background: summary.totalGainLoss >= 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${summary.totalGainLoss >= 0 ? '#bbf7d0' : '#fecaca'}`,
            borderRadius: '12px',
            padding: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px', color: summary.totalGainLoss >= 0 ? '#15803d' : '#b91c1c', fontWeight: 500 }}>
                Total Gain / Loss
              </span>
              <span style={{ fontSize: '20px' }}>{summary.totalGainLoss >= 0 ? '📈' : '📉'}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: summary.totalGainLoss >= 0 ? '#14532d' : '#7f1d1d' }}>
              {summary.totalGainLoss >= 0 ? '+' : ''}₹{summary.totalGainLoss.toLocaleString('en-IN')}
            </div>
          </div>
        </div>

        {/* Upcoming Maturities Alert */}
        {summary.upcomingMaturities.length > 0 && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertCircle size={20} color="#ea580c" />
              <span style={{ fontWeight: 600, color: '#c2410c' }}>Upcoming Maturities (Next 30 Days)</span>
            </div>
            {summary.upcomingMaturities.map(asset => (
              <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #fed7aa' }}>
                <span style={{ fontSize: '14px' }}>{assetsService.getCategoryIcon(asset.category)} {asset.name}</span>
                <span style={{ fontSize: '14px', color: '#c2410c', fontWeight: 500 }}>
                  {getDaysToMaturity(asset.maturity_date!)} days left
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('investment')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'investment' ? '3px solid #2563eb' : 'none',
              color: activeTab === 'investment' ? '#2563eb' : '#666',
              fontWeight: activeTab === 'investment' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            📈 Investments
          </button>
          <button
            onClick={() => setActiveTab('insurance')}
            style={{
              padding: '12px 24px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'insurance' ? '3px solid #2563eb' : 'none',
              color: activeTab === 'insurance' ? '#2563eb' : '#666',
              fontWeight: activeTab === 'insurance' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            🛡️ Insurance
          </button>
        </div>

        {/* Add Button */}
        <button
          onClick={() => {
            setEditMode(false);
            setSelectedAsset(null);
            resetForm();
            setShowModal(true);
          }}
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
          Add {activeTab === 'investment' ? 'Investment' : 'Insurance'}
        </button>

        {/* Assets List */}
        {loading ? (
          <div>Loading...</div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#666' }}>
            No {activeTab === 'investment' ? 'investments' : 'insurance'} found. Click "Add" to create one.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {assets.map(asset => (
              <div
                key={asset.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  borderLeft: `4px solid ${activeTab === 'investment' ? '#16a34a' : '#2563eb'}`
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 4px 0' }}>
                      {assetsService.getCategoryIcon(asset.category)} {asset.name}
                    </h3>
                    <span style={{
                      fontSize: '12px',
                      background: '#f3f4f6',
                      color: '#374151',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      {assetsService.getCategoryLabel(asset.category)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleEdit(asset)}
                      style={{ padding: '6px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id)}
                      style={{ padding: '6px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Current Value</div>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>
                      ₹{asset.current_value.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {asset.invested_amount && (
                    <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Invested</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>
                        ₹{asset.invested_amount.toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}

                  {asset.invested_amount && (
                    <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Gain / Loss</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: getGainLossColor(asset.current_value, asset.invested_amount) }}>
                        {asset.current_value >= asset.invested_amount ? '+' : ''}
                        ₹{(asset.current_value - asset.invested_amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}

                  {asset.interest_rate && (
                    <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Interest Rate</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: '#111' }}>
                        {asset.interest_rate}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Extra Info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#666' }}>
                  {asset.institution_name && (
                    <span>🏦 {asset.institution_name}</span>
                  )}
                  {asset.policy_number && (
                    <span>🔖 {asset.policy_number}</span>
                  )}
                  {asset.purchase_date && (
                    <span>📅 Purchased: {new Date(asset.purchase_date).toLocaleDateString('en-IN')}</span>
                  )}
                  {asset.maturity_date && (
                    <span style={{ color: getDaysToMaturity(asset.maturity_date) <= 30 ? '#ea580c' : '#666' }}>
                      ⏳ Matures: {new Date(asset.maturity_date).toLocaleDateString('en-IN')}
                      {getDaysToMaturity(asset.maturity_date) <= 30 && (
                        <span style={{ color: '#ea580c', fontWeight: 600 }}>
                          {' '}({getDaysToMaturity(asset.maturity_date)} days left!)
                        </span>
                      )}
                    </span>
                  )}
                  {asset.notes && (
                    <span>📝 {asset.notes}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
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
              maxWidth: '520px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <h2 style={{ marginTop: 0 }}>
                {editMode ? 'Edit' : 'Add'} {activeTab === 'investment' ? 'Investment' : 'Insurance'}
              </h2>

              <form onSubmit={handleSubmit}>
                {/* Name */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder={activeTab === 'investment' ? 'e.g. SBI FD, HDFC SIP' : 'e.g. LIC Policy, Star Health'}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                {/* Category */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Category *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as Asset['category'] })}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  >
                    {currentCategories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                {/* Values */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Current Value *</label>
                    <input
                      type="number"
                      value={formData.current_value}
                      onChange={(e) => setFormData({ ...formData, current_value: e.target.value })}
                      required
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
                      {activeTab === 'investment' ? 'Invested Amount' : 'Premium Amount'}
                    </label>
                    <input
                      type="number"
                      value={formData.invested_amount}
                      onChange={(e) => setFormData({ ...formData, invested_amount: e.target.value })}
                      min="0"
                      step="0.01"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Purchase Date</label>
                    <input
                      type="date"
                      value={formData.purchase_date}
                      onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Maturity / Expiry Date</label>
                    <input
                      type="date"
                      value={formData.maturity_date}
                      onChange={(e) => setFormData({ ...formData, maturity_date: e.target.value })}
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {/* Interest Rate & Institution */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Interest Rate (%)</label>
                    <input
                      type="number"
                      value={formData.interest_rate}
                      onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                      min="0"
                      step="0.01"
                      placeholder="e.g. 7.5"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Institution Name</label>
                    <input
                      type="text"
                      value={formData.institution_name}
                      onChange={(e) => setFormData({ ...formData, institution_name: e.target.value })}
                      placeholder="e.g. SBI, LIC, HDFC"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {/* Policy Number & Reminder */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Policy / Account Number</label>
                    <input
                      type="text"
                      value={formData.policy_number}
                      onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                      placeholder="Optional"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Reminder (days before)</label>
                    <input
                      type="number"
                      value={formData.reminder_days}
                      onChange={(e) => setFormData({ ...formData, reminder_days: e.target.value })}
                      min="1"
                      max="365"
                      style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '6px' }}
                  />
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      setEditMode(false);
                      setSelectedAsset(null);
                      resetForm();
                    }}
                    style={{ padding: '10px 20px', background: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                  >
                    {editMode ? 'Update' : 'Create'}
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

export default Assets;
