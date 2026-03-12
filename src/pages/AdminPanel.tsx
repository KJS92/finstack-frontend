import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { adminService, AdminStats, AdminUserRow } from '../services/adminService';
import { theme } from '../theme';
import AppHeader from '../components/layout/AppHeader';
import { Users, Database, ArrowUpDown, TrendingUp, ShieldAlert, RefreshCw } from 'lucide-react';

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = theme.colors.primary }) => (
  <div style={{
    background: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    padding: '20px',
    boxShadow: theme.shadows.card,
    display: 'flex', flexDirection: 'column', gap: '8px',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '34px', height: '34px', borderRadius: '8px', background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <span style={{ color }}>{icon}</span>
      </span>
      <p style={{ margin: 0, fontSize: theme.fontSizes.caption, color: theme.colors.textMuted, fontWeight: theme.fontWeights.medium }}>{label}</p>
    </div>
    <p style={{ margin: 0, fontSize: '26px', fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary, lineHeight: 1 }}>{value}</p>
    {sub && <p style={{ margin: 0, fontSize: theme.fontSizes.caption, color: theme.colors.textMuted }}>{sub}</p>}
  </div>
);

const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [sortField, setSortField] = useState<'email' | 'created_at' | 'accountCount' | 'transactionCount'>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');

  useEffect(() => { init(); }, []);

  const init = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setUserEmail(user.email || '');
      const ok = await adminService.isAdmin();
      setAuthorized(ok);
      if (!ok) return;
      await loadData();
    } finally { setLoading(false); }
  };

  const loadData = async () => {
    const [statsData, userRows] = await Promise.all([adminService.getStats(), adminService.getUserRows()]);
    const totalUsers = userRows.length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newUsersThisMonth = userRows.filter(u => new Date(u.created_at) >= monthStart).length;
    setStats({ ...statsData, totalUsers, newUsersThisMonth });
    setUsers(userRows);
  };

  const handleRefresh = async () => { setRefreshing(true); try { await loadData(); } finally { setRefreshing(false); } };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filteredUsers = users
    .filter(u => u.email.toLowerCase().includes(searchQ.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortField] ?? '';
      const bv = b[sortField] ?? '';
      const cmp = typeof av === 'number' ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';

  const SortIcon = ({ field }: { field: typeof sortField }) => (
    <span style={{ opacity: 0.6 }}>{sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
  );

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: theme.colors.textSecondary }}>Loading...</div>
  );

  if (authorized === false) return (
    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', background: theme.colors.background, textAlign: 'center', padding: '24px' }}>
      <ShieldAlert size={52} color="#E11D48" style={{ marginBottom: '16px' }} />
      <h2 style={{ margin: '0 0 8px', color: theme.colors.textPrimary, fontSize: '22px', fontWeight: 700 }}>Access Denied</h2>
      <p style={{ margin: '0 0 24px', color: theme.colors.textMuted, fontSize: '15px' }}>You do not have admin privileges.</p>
      <button onClick={() => navigate('/dashboard')} style={{ padding: '12px 28px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}>
        Back to Dashboard
      </button>
    </div>
  );

  return (
    <div style={{ backgroundColor: theme.colors.background, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <AppHeader title="Admin Panel" userEmail={userEmail} activePage="profile" />

      <div style={{ padding: '20px 16px 80px', maxWidth: '900px', margin: '0 auto' }}>

        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: theme.colors.textPrimary }}>Admin Dashboard</h1>
            <p style={{ margin: '4px 0 0', fontSize: theme.fontSizes.label, color: theme.colors.textMuted }}>App-wide statistics &mdash; no user financial data exposed</p>
          </div>
          <button onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.label, fontWeight: 600, color: theme.colors.textSecondary, cursor: 'pointer' }}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: theme.colors.borderSubtle, borderRadius: theme.radius.md, padding: '4px', width: 'fit-content' }}>
          {(['overview', 'users'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '8px 20px', background: activeTab === tab ? '#fff' : 'transparent', border: 'none', borderRadius: '8px', fontWeight: activeTab === tab ? 700 : 400, fontSize: theme.fontSizes.label, color: activeTab === tab ? theme.colors.primary : theme.colors.textMuted, cursor: 'pointer', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
              {tab === 'overview' ? <><span role="img" aria-label="chart">&#x1F4CA;</span> Overview</> : <><span role="img" aria-label="users">&#x1F465;</span> Users</>}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && stats && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
              <StatCard icon={<Users size={18} />} label="Total Users" value={stats.totalUsers} sub={`+${stats.newUsersThisMonth} this month`} color="#6366F1" />
              <StatCard icon={<Database size={18} />} label="Total Accounts" value={stats.totalAccounts} color="#0EA5E9" />
              <StatCard icon={<ArrowUpDown size={18} />} label="Total Transactions" value={stats.totalTransactions.toLocaleString('en-IN')} sub={`+${stats.newTransactionsThisMonth} this month`} color="#22C55E" />
              <StatCard icon={<TrendingUp size={18} />} label="Active Assets" value={stats.totalAssets} color="#F59E0B" />
            </div>

            <div style={{ background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, padding: '20px', boxShadow: theme.shadows.card }}>
              <h3 style={{ margin: '0 0 16px', fontSize: theme.fontSizes.body, fontWeight: 600, color: theme.colors.textPrimary }}>
                <span role="img" aria-label="clipboard">&#x1F4CB;</span> Quick Breakdown
              </h3>
              {[
                { label: 'Avg accounts per user', value: stats.totalUsers > 0 ? (stats.totalAccounts / stats.totalUsers).toFixed(1) : '—' },
                { label: 'Avg transactions per user', value: stats.totalUsers > 0 ? Math.round(stats.totalTransactions / stats.totalUsers).toLocaleString('en-IN') : '—' },
                { label: 'New transactions this month', value: stats.newTransactionsThisMonth.toLocaleString('en-IN') },
                { label: 'New users this month', value: stats.newUsersThisMonth },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                  <span style={{ fontSize: theme.fontSizes.body, color: theme.colors.textSecondary }}>{row.label}</span>
                  <span style={{ fontSize: theme.fontSizes.body, fontWeight: 700, color: theme.colors.textPrimary }}>{row.value}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <>
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="text" placeholder="Search by email or user ID..." value={searchQ} onChange={e => setSearchQ(e.target.value)} style={{ flex: 1, padding: '9px 14px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, color: theme.colors.textPrimary, background: theme.colors.card }} />
              <span style={{ fontSize: theme.fontSizes.label, color: theme.colors.textMuted, whiteSpace: 'nowrap' }}>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ background: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, overflow: 'hidden', boxShadow: theme.shadows.card }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: theme.fontSizes.label }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {([
                        { key: 'email' as const, label: 'User' },
                        { key: 'created_at' as const, label: 'Joined' },
                        { key: 'accountCount' as const, label: 'Accounts' },
                        { key: 'transactionCount' as const, label: 'Transactions' },
                      ]).map(col => (
                        <th key={col.key} onClick={() => handleSort(col.key)} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: theme.colors.textSecondary, borderBottom: `1px solid ${theme.colors.border}`, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
                          {col.label}<SortIcon field={col.key} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: theme.colors.textMuted }}>No users found</td></tr>
                    ) : filteredUsers.map((u, i) => (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? '#fff' : '#F9FAFB' }}>
                        <td style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                          <div style={{ fontWeight: 500, color: theme.colors.textPrimary }}>{u.email}</div>
                          <div style={{ fontSize: '11px', color: theme.colors.textMuted, marginTop: '2px', fontFamily: 'monospace' }}>{u.id.slice(0, 16)}&hellip;</div>
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.borderSubtle}`, color: theme.colors.textSecondary, whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</td>
                        <td style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.borderSubtle}`, fontWeight: 600, color: theme.colors.textPrimary }}>{u.accountCount}</td>
                        <td style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.borderSubtle}`, fontWeight: 600, color: theme.colors.textPrimary }}>{u.transactionCount.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default AdminPanel;
