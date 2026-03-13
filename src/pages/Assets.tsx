import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import AppHeader from '../components/layout/AppHeader';
import { assetsService, Asset } from '../services/assetsService';
import { Plus, Edit, Trash2, TrendingUp, Shield, AlertCircle, Landmark, ArrowDownLeft, ArrowUpRight, Briefcase, Gem, PiggyBank, LineChart, BarChart2, Building2, Coins, UserCheck, HeartPulse, Car, FileText, Calendar, Tag, Clock, StickyNote } from 'lucide-react';
import { theme } from '../theme';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #ddd', borderRadius: '8px',
  fontSize: '14px', boxSizing: 'border-box',
  fontFamily: theme.fontFamily.base,
};

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  fd: <Landmark size={15} color="#2563eb" />,
  sip: <TrendingUp size={15} color="#16a34a" />,
  stocks: <BarChart2 size={15} color="#16a34a" />,
  mutual_fund: <LineChart size={15} color="#16a34a" />,
  ppf: <Building2 size={15} color="#7c3aed" />,
  nps: <UserCheck size={15} color="#7c3aed" />,
  gold: <Coins size={15} color="#ca8a04" />,
  real_estate: <Building2 size={15} color="#ea580c" />,
  other_investment: <PiggyBank size={15} color="#6b7280" />,
  life_insurance: <HeartPulse size={15} color="#dc2626" />,
  health_insurance: <Shield size={15} color="#2563eb" />,
  vehicle_insurance: <Car size={15} color="#ea580c" />,
  term_insurance: <Shield size={15} color="#7c3aed" />,
  other_insurance: <FileText size={15} color="#6b7280" />,
};

const Assets: React.FC = () => {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'investment' | 'insurance'>('investment');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [summary, setSummary] = useState({
    totalInvestments: 0, totalInsurance: 0, totalBankBalance: 0,
    totalReceivables: 0, totalPayables: 0, totalAssets: 0,
    totalLiabilities: 0, totalNetWorth: 0, totalGainLoss: 0,
    upcomingMaturities: [] as Asset[]
  });
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [formError, setFormError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const investmentCategories = [
    { value: 'fd', label: 'Fixed Deposit' }, { value: 'sip', label: 'SIP' },
    { value: 'stocks', label: 'Stocks' }, { value: 'mutual_fund', label: 'Mutual Fund' },
    { value: 'ppf', label: 'PPF' }, { value: 'nps', label: 'NPS' },
    { value: 'gold', label: 'Gold' }, { value: 'real_estate', label: 'Real Estate' },
    { value: 'other_investment', label: 'Other Investment' },
  ];
  const insuranceCategories = [
    { value: 'life_insurance', label: 'Life Insurance' },
    { value: 'health_insurance', label: 'Health Insurance' },
    { value: 'vehicle_insurance', label: 'Vehicle Insurance' },
    { value: 'term_insurance', label: 'Term Insurance' },
    { value: 'other_insurance', label: 'Other Insurance' },
  ];

  const [formData, setFormData] = useState({
    name: '', category: 'fd' as Asset['category'],
    current_value: '', invested_amount: '',
    purchase_date: '', maturity_date: '',
    interest_rate: '', institution_name: '',
    policy_number: '', notes: '',
    reminder_days: '30', is_active: true
  });

  const loadData = useCallback(async () => {
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
  }, [activeTab]);

  // Single auth call on mount
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setUserEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      setAuthReady(true);
    };
    init();
  }, [navigate]);

  useEffect(() => {
    if (authReady) loadData();
  }, [authReady, loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const currentVal = parseFloat(formData.current_value);
    if (isNaN(currentVal) || currentVal < 0) { setFormError('Enter a valid current value'); return; }
    try {
      const assetData = {
        name: formData.name, type: activeTab, category: formData.category,
        current_value: currentVal,
        invested_amount: formData.invested_amount ? parseFloat(formData.invested_amount) : undefined,
        purchase_date: formData.purchase_date || undefined,
        maturity_date: formData.maturity_date || undefined,
        interest_rate: formData.interest_rate ? parseFloat(formData.interest_rate) : undefined,
        institution_name: formData.institution_name || undefined,
        policy_number: formData.policy_number || undefined,
        notes: formData.notes || undefined,
        reminder_days: parseInt(formData.reminder_days), is_active: true
      };
      if (editMode && selectedAsset) await assetsService.update(selectedAsset.id, assetData);
      else await assetsService.create(assetData);
      setShowModal(false); setEditMode(false); setSelectedAsset(null); resetForm();
      await loadData();
    } catch (error: any) {
      setFormError(error.message || 'Failed to save asset');
    }
  };

  const handleEdit = (asset: Asset) => {
    setFormData({
      name: asset.name, category: asset.category,
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
    setFormError('');
    setSelectedAsset(asset); setEditMode(true); setShowModal(true);
  };

  // Inline two-tap delete — window.confirm blocked in PWA standalone mode
  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); return; }
    try {
      await assetsService.delete(id);
      setConfirmDeleteId(null);
      await loadData();
    } catch (error: any) {
      console.error('Error deleting asset:', error);
    }
  };

  const resetForm = () => setFormData({
    name: '', category: activeTab === 'investment' ? 'fd' : 'life_insurance',
    current_value: '', invested_amount: '', purchase_date: '', maturity_date: '',
    interest_rate: '', institution_name: '', policy_number: '', notes: '',
    reminder_days: '30', is_active: true
  });

  const getDaysToMaturity = (maturityDate: string) =>
    Math.ceil((new Date(maturityDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const getGainLossColor = (current: number, invested?: number) => {
    if (!invested) return '#666';
    return current >= invested ? '#16a34a' : '#dc2626';
  };

  const currentCategories = activeTab === 'investment' ? investmentCategories : insuranceCategories;

  const row1 = [
    { label: 'Investments', value: summary.totalInvestments, accent: '#16a34a', bg: '#f0fdf4', textColor: '#14532d', Icon: TrendingUp },
    { label: 'Insurance', value: summary.totalInsurance, accent: '#2563eb', bg: '#eff6ff', textColor: '#1e3a8a', Icon: Shield },
    { label: 'Bank Balance', value: summary.totalBankBalance, accent: '#16a34a', bg: '#f0fdf4', textColor: '#14532d', Icon: Landmark },
    { label: 'Receivables', value: summary.totalReceivables, accent: '#16a34a', bg: '#f0fdf4', textColor: '#14532d', Icon: ArrowDownLeft },
  ];
  const row2 = [
    { label: 'Payables', value: summary.totalPayables, accent: '#dc2626', bg: '#fef2f2', textColor: '#7f1d1d', Icon: ArrowUpRight },
    { label: 'Total Liabilities', value: summary.totalLiabilities, accent: '#dc2626', bg: '#fef2f2', textColor: '#7f1d1d', Icon: AlertCircle },
    { label: 'Total Assets', value: summary.totalAssets, accent: '#7c3aed', bg: '#faf5ff', textColor: '#581c87', Icon: Briefcase },
    {
      label: 'Net Worth', value: summary.totalNetWorth,
      accent: summary.totalNetWorth >= 0 ? '#7c3aed' : '#dc2626',
      bg: summary.totalNetWorth >= 0 ? '#faf5ff' : '#fef2f2',
      textColor: summary.totalNetWorth >= 0 ? '#581c87' : '#7f1d1d',
      Icon: Gem, sub: 'Assets \u2212 Liabilities'
    },
  ];

  const SummaryCard = ({ label, value, accent, bg, textColor, Icon, sub }: any) => (
    <div style={{ background: bg, border: `1px solid ${accent}30`, borderTop: `3px solid ${accent}`, borderRadius: '12px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: textColor, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.4px', fontFamily: theme.fontFamily.base }}>{label}</span>
        <Icon size={16} color={accent} />
      </div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: textColor, fontFamily: theme.fontFamily.base }}>
        &#8377;{value.toLocaleString('en-IN')}
      </div>
      {sub && <div style={{ fontSize: '11px', color: textColor, opacity: 0.6, marginTop: '3px', fontFamily: theme.fontFamily.base }}>{sub}</div>}
    </div>
  );

  // Auth-pending: consistent spinner instead of bare <div>Loading...</div>
  if (!authReady) return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.fontFamily.base, color: '#9ca3af', fontSize: '15px' }}>
      Loading...
    </div>
  );

  return (
    <div style={{ backgroundColor: '#f9fafb', minHeight: '100vh', fontFamily: theme.fontFamily.base }}>
      <AppHeader title="Assets & Investments" userEmail={userEmail} displayName={displayName} activePage="assets" />

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 16px 80px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
          {row1.map(c => <SummaryCard key={c.label} {...c} />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {row2.map(c => <SummaryCard key={c.label} {...c} />)}
        </div>

        {/* Upcoming Maturities */}
        {summary.upcomingMaturities.length > 0 && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderTop: '3px solid #ea580c', borderRadius: '12px', padding: '16px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <AlertCircle size={18} color="#ea580c" />
              <span style={{ fontWeight: 700, color: '#c2410c', fontSize: '14px', fontFamily: theme.fontFamily.base }}>Upcoming Maturities (Next 30 Days)</span>
            </div>
            {summary.upcomingMaturities.map(asset => (
              <div key={asset.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid #fed7aa', fontSize: '14px', fontFamily: theme.fontFamily.base }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {CATEGORY_ICON_MAP[asset.category] || <Briefcase size={15} color="#6b7280" />}
                  {asset.name}
                </span>
                <span style={{ color: '#c2410c', fontWeight: 600 }}>{getDaysToMaturity(asset.maturity_date!)} days left</span>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb' }}>
          {(['investment', 'insurance'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 20px', background: 'none', border: 'none',
              borderBottom: activeTab === tab ? `3px solid ${theme.colors.primary}` : '3px solid transparent',
              color: activeTab === tab ? theme.colors.primary : '#6b7280',
              fontWeight: activeTab === tab ? 700 : 400,
              cursor: 'pointer', fontSize: '15px', fontFamily: theme.fontFamily.base,
              transition: 'all 0.15s', display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              {tab === 'investment' ? <><TrendingUp size={15} /> Investments</> : <><Shield size={15} /> Insurance</>}
            </button>
          ))}
        </div>

        {/* Add Button */}
        <button
          onClick={() => { setEditMode(false); setSelectedAsset(null); resetForm(); setFormError(''); setShowModal(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', background: theme.colors.primary,
            color: '#fff', border: 'none', borderRadius: '8px',
            cursor: 'pointer', fontSize: '14px', fontWeight: 600,
            marginBottom: '20px', fontFamily: theme.fontFamily.base,
          }}
        >
          <Plus size={18} />
          Add {activeTab === 'investment' ? 'Investment' : 'Insurance'}
        </button>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontFamily: theme.fontFamily.base }}>Loading...</div>
        ) : assets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', color: '#9ca3af' }}>
            <p style={{ margin: '0 0 12px', fontSize: '15px', fontFamily: theme.fontFamily.base }}>No {activeTab === 'investment' ? 'investments' : 'insurance'} yet</p>
            <button onClick={() => setShowModal(true)} style={{ padding: '10px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: theme.fontFamily.base }}>
              + Add {activeTab === 'investment' ? 'Investment' : 'Insurance'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {assets.map(asset => (
              <div key={asset.id} style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px',
                padding: '20px', borderLeft: `3px solid ${activeTab === 'investment' ? '#16a34a' : '#2563eb'}`,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: theme.fontFamily.base }}>
                      {CATEGORY_ICON_MAP[asset.category] || <Briefcase size={15} color="#6b7280" />}
                      {asset.name}
                    </h3>
                    <span style={{ fontSize: '11px', background: '#f3f4f6', color: '#374151', padding: '2px 8px', borderRadius: '12px', fontWeight: 500, fontFamily: theme.fontFamily.base }}>
                      {assetsService.getCategoryLabel(asset.category)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button onClick={() => handleEdit(asset)} style={{ padding: '6px 10px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Edit size={14} />
                    </button>
                    {confirmDeleteId === asset.id ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151', fontFamily: theme.fontFamily.base }}>
                        Sure?
                        <button onClick={() => handleDelete(asset.id)} style={{ padding: '5px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: theme.fontFamily.base }}>Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={{ padding: '5px 10px', background: 'none', border: '1px solid #e5e7eb', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', color: '#64748B', fontFamily: theme.fontFamily.base }}>No</button>
                      </span>
                    ) : (
                      <button onClick={() => handleDelete(asset.id)} style={{ padding: '6px 10px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: theme.fontFamily.base }}>Current Value</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#111', fontFamily: theme.fontFamily.base }}>&#8377;{asset.current_value.toLocaleString('en-IN')}</div>
                  </div>
                  {asset.invested_amount && (
                    <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: theme.fontFamily.base }}>Invested</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#111', fontFamily: theme.fontFamily.base }}>&#8377;{asset.invested_amount.toLocaleString('en-IN')}</div>
                    </div>
                  )}
                  {asset.invested_amount && (
                    <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: theme.fontFamily.base }}>Gain / Loss</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: getGainLossColor(asset.current_value, asset.invested_amount), fontFamily: theme.fontFamily.base }}>
                        {asset.current_value >= asset.invested_amount ? '+' : ''}&#8377;{(asset.current_value - asset.invested_amount).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )}
                  {asset.interest_rate && (
                    <div style={{ background: '#f9fafb', padding: '10px 12px', borderRadius: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.3px', fontFamily: theme.fontFamily.base }}>Interest Rate</div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#111', fontFamily: theme.fontFamily.base }}>{asset.interest_rate}%</div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#6b7280', fontFamily: theme.fontFamily.base }}>
                  {asset.institution_name && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Landmark size={13} />{asset.institution_name}</span>}
                  {asset.policy_number && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Tag size={13} />{asset.policy_number}</span>}
                  {asset.purchase_date && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><Calendar size={13} />Purchased: {new Date(asset.purchase_date).toLocaleDateString('en-IN')}</span>}
                  {asset.maturity_date && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: getDaysToMaturity(asset.maturity_date) <= 30 ? '#ea580c' : '#6b7280', fontWeight: getDaysToMaturity(asset.maturity_date) <= 30 ? 600 : 400 }}>
                      <Clock size={13} />Matures: {new Date(asset.maturity_date).toLocaleDateString('en-IN')}
                      {getDaysToMaturity(asset.maturity_date) <= 30 && ` (${getDaysToMaturity(asset.maturity_date)} days left!)`}
                    </span>
                  )}
                  {asset.notes && <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><StickyNote size={13} />{asset.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)} role="presentation">
            <div role="dialog" aria-modal="true" aria-labelledby="asset-modal-title" style={{ background: '#fff', borderRadius: '12px', padding: '24px', maxWidth: '520px', width: '90%', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <h2 id="asset-modal-title" style={{ marginTop: 0, fontSize: '18px', fontFamily: theme.fontFamily.base }}>{editMode ? 'Edit' : 'Add'} {activeTab === 'investment' ? 'Investment' : 'Insurance'}</h2>
              {formError && <div role="alert" style={{ padding: '10px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', marginBottom: '14px', fontFamily: theme.fontFamily.base }}>{formError}</div>}
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Name *</label><input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder={activeTab === 'investment' ? 'e.g. SBI FD, HDFC SIP' : 'e.g. LIC Policy'} style={inputStyle} /></div>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Category *</label><select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value as Asset['category'] })} style={inputStyle}>{currentCategories.map(cat => <option key={cat.value} value={cat.value}>{cat.label}</option>)}</select></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Current Value *</label><input type="number" value={formData.current_value} onChange={e => setFormData({ ...formData, current_value: e.target.value })} required min="0" step="0.01" style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>{activeTab === 'investment' ? 'Invested Amount' : 'Premium Amount'}</label><input type="number" value={formData.invested_amount} onChange={e => setFormData({ ...formData, invested_amount: e.target.value })} min="0" step="0.01" style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Purchase Date</label><input type="date" value={formData.purchase_date} onChange={e => setFormData({ ...formData, purchase_date: e.target.value })} style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Maturity / Expiry Date</label><input type="date" value={formData.maturity_date} onChange={e => setFormData({ ...formData, maturity_date: e.target.value })} style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Interest Rate (%)</label><input type="number" value={formData.interest_rate} onChange={e => setFormData({ ...formData, interest_rate: e.target.value })} min="0" step="0.01" placeholder="e.g. 7.5" style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Institution Name</label><input type="text" value={formData.institution_name} onChange={e => setFormData({ ...formData, institution_name: e.target.value })} placeholder="e.g. SBI, LIC, HDFC" style={inputStyle} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Policy / Account Number</label><input type="text" value={formData.policy_number} onChange={e => setFormData({ ...formData, policy_number: e.target.value })} placeholder="Optional" style={inputStyle} /></div>
                  <div><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Reminder (days before)</label><input type="number" value={formData.reminder_days} onChange={e => setFormData({ ...formData, reminder_days: e.target.value })} min="1" max="365" style={inputStyle} /></div>
                </div>
                <div style={{ marginBottom: '14px' }}><label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: theme.fontFamily.base }}>Notes</label><textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                  <button type="button" onClick={() => { setShowModal(false); setEditMode(false); setSelectedAsset(null); resetForm(); setFormError(''); }} style={{ padding: '10px 20px', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', fontFamily: theme.fontFamily.base, fontWeight: 500 }}>Cancel</button>
                  <button type="submit" style={{ padding: '10px 20px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: theme.fontFamily.base, fontWeight: 600 }}>{editMode ? 'Update' : 'Create'}</button>
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
