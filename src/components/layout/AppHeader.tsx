import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { Bell, LogOut, User, ShieldCheck } from 'lucide-react';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { theme } from '../../theme';

interface AppHeaderProps {
  title: string;
  userEmail: string;
  activePage?: string;
}

const navItems = [
  { label: 'Dashboard',       path: '/dashboard',       key: 'dashboard' },
  { label: 'Transactions',    path: '/transactions',    key: 'transactions' },
  { label: 'Add Transaction', path: '/add-transaction', key: 'add-transaction' },
  { label: 'Budgets',         path: '/budgets',         key: 'budgets' },
  { label: 'Receivables',     path: '/receivables',     key: 'receivables' },
  { label: 'Reports',         path: '/reports',         key: 'reports' },
  { label: 'Categories',      path: '/categories',      key: 'categories' },
  { label: 'Assets',          path: '/assets',          key: 'assets' },
];

const AppHeader: React.FC<AppHeaderProps> = ({ title, userEmail, activePage }) => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(user?.user_metadata?.is_admin === true);
    });
  }, []);

  const firstName = userEmail
    ? userEmail.split('@')[0].charAt(0).toUpperCase() + userEmail.split('@')[0].slice(1)
    : '';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <>
      <header style={{
        backgroundColor: theme.colors.card,
        borderBottom: `1px solid ${theme.colors.border}`,
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        fontFamily: 'Inter, sans-serif',
      }}>

        {/* Logo */}
        <div onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <div style={{ width: '28px', height: '28px', backgroundColor: theme.colors.primary, borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: theme.fontWeights.bold }}>F</span>
          </div>
          <span style={{ color: theme.colors.textPrimary, fontSize: theme.fontSizes.heading2, fontWeight: theme.fontWeights.bold, letterSpacing: '-0.3px' }}>FinStack</span>
        </div>

        {/* Desktop Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px' }} className="desktop-nav">
          {navItems.map(item => {
            const isActive = activePage === item.key;
            return (
              <button key={item.key} onClick={() => navigate(item.path)} style={{
                backgroundColor: isActive ? theme.colors.primaryLight : 'transparent',
                color: isActive ? theme.colors.primary : theme.colors.textSecondary,
                border: 'none', borderRadius: theme.radius.md,
                padding: '6px 12px', fontSize: theme.fontSizes.label,
                fontWeight: isActive ? theme.fontWeights.semibold : theme.fontWeights.regular,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                whiteSpace: 'nowrap', transition: 'all 0.15s',
              }}>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right — Notifications + User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <NotificationDropdown />

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(prev => !prev)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.pill,
                padding: '5px 12px 5px 8px',
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              <div style={{ width: '24px', height: '24px', backgroundColor: theme.colors.primaryLight, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: theme.colors.primary, fontSize: '11px', fontWeight: theme.fontWeights.bold }}>
                  {firstName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span style={{ color: theme.colors.textPrimary, fontSize: theme.fontSizes.label, fontWeight: theme.fontWeights.medium }}>
                {firstName}
              </span>
              {/* Admin badge dot */}
              {isAdmin && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4F46E5', marginLeft: '2px', flexShrink: 0 }} title="Admin" />
              )}
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <div style={{
                position: 'absolute', top: '42px', right: 0,
                backgroundColor: theme.colors.card,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.radius.lg,
                boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                minWidth: '190px', zIndex: 200, overflow: 'hidden',
              }}>
                {/* User info */}
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.colors.borderSubtle}` }}>
                  <p style={{ color: theme.colors.textPrimary, fontSize: theme.fontSizes.label, fontWeight: theme.fontWeights.semibold, margin: '0 0 2px' }}>{firstName}</p>
                  <p style={{ color: theme.colors.textMuted, fontSize: '11px', margin: 0 }}>{userEmail}</p>
                  {isAdmin && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '5px', padding: '2px 8px', background: '#EEF2FF', color: '#4F46E5', borderRadius: '999px', fontSize: '10px', fontWeight: 600 }}>
                      <ShieldCheck size={9} /> Admin
                    </span>
                  )}
                </div>

                {/* Profile */}
                <button onClick={() => { navigate('/profile'); setShowUserMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: theme.fontSizes.label, color: theme.colors.textSecondary }}>
                  <User size={15} color={theme.colors.textSecondary} />
                  Profile &amp; Settings
                </button>

                {/* Admin link — only for admins */}
                {isAdmin && (
                  <>
                    <div style={{ height: '1px', backgroundColor: theme.colors.borderSubtle }} />
                    <button onClick={() => { navigate('/admin'); setShowUserMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', backgroundColor: '#F5F3FF', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: theme.fontSizes.label, color: '#4F46E5', fontWeight: 600 }}>
                      <ShieldCheck size={15} color="#4F46E5" />
                      Admin Dashboard
                    </button>
                  </>
                )}

                <div style={{ height: '1px', backgroundColor: theme.colors.borderSubtle }} />

                {/* Logout */}
                <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 16px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: theme.fontSizes.label, color: theme.colors.expense }}>
                  <LogOut size={15} color={theme.colors.expense} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {showUserMenu && (
        <div onClick={() => setShowUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .desktop-nav { display: flex; }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } }
      `}</style>
    </>
  );
};

export default AppHeader;
