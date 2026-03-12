import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { profileService } from '../services/profileService';
import { theme } from '../theme';
import AppHeader from '../components/layout/AppHeader';
import { User, Lock, Bell, Palette, Trash2, ChevronRight, Check, ShieldCheck } from 'lucide-react';

const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ backgroundColor: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.lg, boxShadow: theme.shadows.card, overflow: 'hidden', ...style }}>
    {children}
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; color?: string }> = ({ icon, title, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm}`, borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
    <span style={{ color: color || theme.colors.primary }}>{icon}</span>
    <h3 style={{ margin: 0, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.semibold, color: color || theme.colors.textPrimary }}>{title}</h3>
  </div>
);

const SettingRow: React.FC<{ label: string; value?: string; onClick?: () => void; disabled?: boolean; danger?: boolean; children?: React.ReactNode }> = ({ label, value, onClick, disabled, danger, children }) => (
  <div
    style={{ padding: `14px ${theme.spacing.md}`, borderBottom: `1px solid ${theme.colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: onClick && !disabled ? 'pointer' : 'default', opacity: disabled ? 0.5 : 1, transition: 'background 0.15s' }}
    onClick={!disabled ? onClick : undefined}
    onMouseEnter={e => { if (onClick && !disabled) (e.currentTarget as HTMLDivElement).style.background = theme.colors.borderSubtle; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
  >
    <div>
      <p style={{ margin: 0, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.medium, color: danger ? '#E11D48' : theme.colors.textPrimary }}>{label}</p>
      {value && <p style={{ margin: '2px 0 0', fontSize: theme.fontSizes.label, color: theme.colors.textMuted }}>{value}</p>}
      {children}
    </div>
    {onClick && !disabled && <ChevronRight size={16} color={danger ? '#E11D48' : theme.colors.textMuted} />}
  </div>
);

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ accountCount: 0, transactionCount: 0, netWorth: 0, memberSince: '' });
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedback, setFeedback] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNameForm, setShowNameForm] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('INR');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => { loadAll(); }, []);

  const showFeedback = (msg: string, type: 'success' | 'error') => {
    setFeedback({ msg, type });
    setTimeout(() => setFeedback(null), 3500);
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setUserEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      setIsAdmin(user.user_metadata?.is_admin === true);

      const statsData = await profileService.getAccountStats();
      const [{ count: txnCount }, { data: accounts }, { data: assets }] = await Promise.all([
        supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('accounts').select('balance, type').eq('user_id', user.id),
        supabase.from('assets').select('current_value').eq('user_id', user.id).eq('is_active', true),
      ]);
      const bankBalance = accounts?.filter(a => a.type !== 'credit_card').reduce((s, a) => s + Number(a.balance), 0) || 0;
      const creditLiability = accounts?.filter(a => a.type === 'credit_card').reduce((s, a) => s + Number(a.balance), 0) || 0;
      const totalAssets = assets?.reduce((s, a) => s + Number(a.current_value), 0) || 0;
      setStats({ accountCount: statsData.accountCount, transactionCount: txnCount || 0, netWorth: bankBalance + totalAssets - creditLiability, memberSince: statsData.memberSince });
    } catch (err: any) {
      showFeedback(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { showFeedback('Passwords do not match', 'error'); return; }
    if (newPassword.length < 6) { showFeedback('Password must be at least 6 characters', 'error'); return; }
    try {
      setSavingPassword(true);
      await profileService.updatePassword(newPassword);
      showFeedback('Password updated successfully!', 'success');
      setShowPasswordForm(false); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) { showFeedback(err.message, 'error'); }
    finally { setSavingPassword(false); }
  };

  const handleNameSave = async () => {
    if (!displayName.trim()) return;
    try {
      setSavingName(true);
      await supabase.auth.updateUser({ data: { full_name: displayName } });
      showFeedback('Display name updated!', 'success');
      setShowNameForm(false);
    } catch (err: any) { showFeedback(err.message, 'error'); }
    finally { setSavingName(false); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/auth'); };

  const formatINR = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const initials = (displayName || userEmail).slice(0, 2).toUpperCase();

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Inter, sans-serif', color: theme.colors.textSecondary }}>Loading...</div>
  );

  return (
    <div style={{ backgroundColor: theme.colors.background, minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      <AppHeader title="Profile & Settings" userEmail={userEmail} activePage="profile" />

      <div style={{ padding: '20px 16px 80px', maxWidth: '640px', margin: '0 auto' }}>

        {/* Feedback */}
        {feedback && (
          <div style={{ padding: '12px 16px', borderRadius: theme.radius.md, marginBottom: '16px', fontSize: theme.fontSizes.label, fontWeight: theme.fontWeights.medium, background: feedback.type === 'success' ? '#DCFCE7' : '#FFF1F2', color: feedback.type === 'success' ? '#15803D' : '#E11D48', border: `1px solid ${feedback.type === 'success' ? '#BBF7D0' : '#FECDD3'}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <Check size={14} /> : '⚠️'} {feedback.msg}
          </div>
        )}

        {/* Avatar */}
        <Card style={{ marginBottom: '16px', padding: '24px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
            <span style={{ fontSize: '26px', fontWeight: 700, color: '#fff' }}>{initials}</span>
          </div>
          <h2 style={{ margin: '0 0 4px', fontSize: theme.fontSizes.heading2, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>{displayName || userEmail.split('@')[0]}</h2>
          <p style={{ margin: '0 0 4px', fontSize: theme.fontSizes.label, color: theme.colors.textMuted }}>{userEmail}</p>
          {isAdmin && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px', padding: '3px 10px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '999px', fontSize: '11px', fontWeight: 600 }}>
              <ShieldCheck size={11} /> Admin
            </span>
          )}
          {stats.memberSince && (
            <p style={{ margin: '6px 0 0', fontSize: theme.fontSizes.caption, color: theme.colors.textMuted }}>Member since {formatDate(stats.memberSince)}</p>
          )}
        </Card>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'Accounts', value: stats.accountCount.toString() },
            { label: 'Transactions', value: stats.transactionCount.toLocaleString('en-IN') },
            { label: 'Net Worth', value: formatINR(stats.netWorth) },
          ].map(stat => (
            <Card key={stat.label} style={{ padding: '14px', textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: theme.fontSizes.caption, color: theme.colors.textSecondary }}>{stat.label}</p>
              <p style={{ margin: 0, fontSize: stat.label === 'Net Worth' ? '13px' : theme.fontSizes.heading2, fontWeight: theme.fontWeights.bold, color: theme.colors.textPrimary }}>{stat.value}</p>
            </Card>
          ))}
        </div>

        {/* Account Settings */}
        <Card style={{ marginBottom: '16px' }}>
          <SectionHeader icon={<User size={16} />} title="Account" />
          <SettingRow label="Display Name" value={displayName || 'Not set'} onClick={() => setShowNameForm(v => !v)} />
          {showNameForm && (
            <div style={{ padding: '12px 16px', background: theme.colors.borderSubtle }}>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your display name" style={{ width: '100%', padding: '9px 12px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, marginBottom: '10px', boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={handleNameSave} disabled={savingName} style={{ flex: 1, padding: '10px', background: theme.colors.btnPrimary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontWeight: theme.fontWeights.semibold, fontSize: theme.fontSizes.label, cursor: 'pointer' }}>{savingName ? 'Saving...' : 'Save Name'}</button>
                <button onClick={() => setShowNameForm(false)} style={{ padding: '10px 16px', background: 'transparent', color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.label, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
          <SettingRow label="Email Address" value={userEmail} disabled />
        </Card>

        {/* Security */}
        <Card style={{ marginBottom: '16px' }}>
          <SectionHeader icon={<Lock size={16} />} title="Security" />
          <SettingRow label="Change Password" value="Update your account password" onClick={() => setShowPasswordForm(v => !v)} />
          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} style={{ padding: '14px 16px', background: theme.colors.borderSubtle, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[{ label: 'New Password', val: newPassword, set: setNewPassword }, { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword }].map(f => (
                <div key={f.label}>
                  <label style={{ display: 'block', fontSize: theme.fontSizes.caption, fontWeight: theme.fontWeights.semibold, color: theme.colors.textSecondary, marginBottom: '5px' }}>{f.label}</label>
                  <input type="password" value={f.val} onChange={e => f.set(e.target.value)} placeholder="••••••••" required minLength={6} style={{ width: '100%', padding: '9px 12px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.body, boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="submit" disabled={savingPassword} style={{ flex: 1, padding: '10px', background: theme.colors.btnPrimary, color: '#fff', border: 'none', borderRadius: theme.radius.md, fontWeight: theme.fontWeights.semibold, fontSize: theme.fontSizes.label, cursor: 'pointer' }}>{savingPassword ? 'Updating...' : 'Update Password'}</button>
                <button type="button" onClick={() => setShowPasswordForm(false)} style={{ padding: '10px 16px', background: 'transparent', color: theme.colors.textSecondary, border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.label, cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          )}
        </Card>

        {/* Preferences */}
        <Card style={{ marginBottom: '16px' }}>
          <SectionHeader icon={<Palette size={16} />} title="Preferences" />
          <div style={{ padding: `14px ${theme.spacing.md}`, borderBottom: `1px solid ${theme.colors.borderSubtle}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.medium, color: theme.colors.textPrimary }}>Currency</p>
              <p style={{ margin: '2px 0 0', fontSize: theme.fontSizes.label, color: theme.colors.textMuted }}>Display currency for amounts</p>
            </div>
            <select value={currency} onChange={e => setCurrency(e.target.value as any)} style={{ padding: '7px 10px', border: `1px solid ${theme.colors.border}`, borderRadius: theme.radius.md, fontSize: theme.fontSizes.label, background: '#fff', color: theme.colors.textPrimary, cursor: 'pointer' }}>
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
          <div style={{ padding: `14px ${theme.spacing.md}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.medium, color: theme.colors.textPrimary }}>Notifications</p>
              <p style={{ margin: '2px 0 0', fontSize: theme.fontSizes.label, color: theme.colors.textMuted }}>Due-date reminders & alerts</p>
            </div>
            <button onClick={() => setNotificationsEnabled(v => !v)} style={{ width: '44px', height: '24px', borderRadius: '999px', background: notificationsEnabled ? theme.colors.primary : '#D1D5DB', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <span style={{ position: 'absolute', top: '3px', left: notificationsEnabled ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        </Card>

        {/* Account Actions */}
        <Card style={{ marginBottom: '16px' }}>
          <SectionHeader icon={<Bell size={16} />} title="Account Actions" />
          <SettingRow label="Sign Out" value="Sign out of your account" onClick={handleLogout} />
        </Card>

        {/* Admin Panel — only visible to admins */}
        {isAdmin && (
          <Card style={{ marginBottom: '16px', border: '1px solid #C7D2FE' }}>
            <SectionHeader icon={<ShieldCheck size={16} />} title="Admin" color="#4F46E5" />
            <SettingRow label="Admin Dashboard" value="View app-wide statistics and user overview" onClick={() => navigate('/admin')} />
          </Card>
        )}

        {/* Danger Zone */}
        <Card style={{ marginBottom: '16px', border: '1px solid #FECDD3' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.sm}`, borderBottom: '1px solid #FFF1F2' }}>
            <Trash2 size={16} color="#E11D48" />
            <h3 style={{ margin: 0, fontSize: theme.fontSizes.body, fontWeight: theme.fontWeights.semibold, color: '#E11D48' }}>Danger Zone</h3>
          </div>
          <SettingRow label="Delete Account" value="Permanently delete your account and all data" danger disabled />
        </Card>

      </div>
    </div>
  );
};

export default Profile;
