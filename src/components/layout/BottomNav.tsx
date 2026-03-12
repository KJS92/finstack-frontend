import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, ArrowLeftRight,
  Plus, Wallet, MoreHorizontal,
  ReceiptText, BarChart2, Tag,
  Landmark, User, X
} from 'lucide-react';
import { theme } from '../../theme';

const mainNav = [
  { label: 'Home',         path: '/dashboard',       icon: LayoutDashboard },
  { label: 'Transactions', path: '/transactions',     icon: ArrowLeftRight },
  { label: 'Add',          path: '/add-transaction',  icon: Plus },
  { label: 'Budgets',      path: '/budgets',          icon: Wallet },
  { label: 'More',         path: null,                icon: MoreHorizontal },
];

const moreNav = [
  { label: 'Receivables',  path: '/receivables',  icon: ReceiptText },
  { label: 'Reports',      path: '/reports',      icon: BarChart2 },
  { label: 'Categories',   path: '/categories',   icon: Tag },
  { label: 'Assets',       path: '/assets',       icon: Landmark },
  { label: 'Profile',      path: '/profile',      icon: User },
];

const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMore, setShowMore] = useState(false);

  const isActive = (path: string | null) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isMoreActive = moreNav.some(item => location.pathname === item.path);

  const handleNavClick = (path: string | null) => {
    if (!path) {
      setShowMore(prev => !prev);
      return;
    }
    setShowMore(false);
    navigate(path);
  };

  return (
    <>
      {/* ── More Drawer ───────────────────────────────── */}
      {showMore && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowMore(false)}
            role="button"
            aria-label="Close menu"         // ✅ Added
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setShowMore(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.25)',
              zIndex: 149,
            }}
          />

          {/* Drawer */}
          <div
            role="dialog"
            aria-label="More navigation options"   // ✅ Added
            style={{
              position: 'fixed',
              bottom: '64px',
              left: 0,
              right: 0,
              backgroundColor: theme.colors.card,
              borderTop: `1px solid ${theme.colors.border}`,
              borderRadius: '20px 20px 0 0',
              padding: '20px 16px',
              zIndex: 150,
              fontFamily: 'Inter, sans-serif',
            }}>
            {/* Drawer handle */}
            <div style={{
              width: '36px',
              height: '4px',
              backgroundColor: theme.colors.border,
              borderRadius: theme.radius.pill,
              margin: '0 auto 20px',
            }} />

            {/* Close button */}
            <button
              onClick={() => setShowMore(false)}
              aria-label="Close more menu"    // ✅ Added
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                color: theme.colors.textSecondary,
              }}
            >
              <X size={18} />
            </button>

            <p style={{
              color: theme.colors.textSecondary,
              fontSize: theme.fontSizes.caption,
              fontWeight: theme.fontWeights.medium,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              margin: '0 0 16px',
            }}>
              More
            </p>

            {/* More items — 2 column grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '8px',
            }}>
              {moreNav.map(item => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavClick(item.path)}
                    aria-label={`Go to ${item.label}`}    // ✅ Added
                    aria-current={active ? 'page' : undefined}  // ✅ Added
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      backgroundColor: active
                        ? theme.colors.primaryLight
                        : theme.colors.background,
                      border: `1px solid ${active
                        ? theme.colors.primary + '40'
                        : theme.colors.border}`,
                      borderRadius: theme.radius.lg,
                      cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      textAlign: 'left',
                    }}
                  >
                    <Icon
                      size={18}
                      color={active
                        ? theme.colors.primary
                        : theme.colors.textSecondary}
                    />
                    <span style={{
                      color: active
                        ? theme.colors.primary
                        : theme.colors.textPrimary,
                      fontSize: theme.fontSizes.label,
                      fontWeight: active
                        ? theme.fontWeights.semibold
                        : theme.fontWeights.medium,
                    }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Bottom Nav Bar ────────────────────────────── */}
      <nav
        aria-label="Main navigation"    // ✅ Added
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          backgroundColor: theme.colors.card,
          borderTop: `1px solid ${theme.colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 200,
          fontFamily: 'Inter, sans-serif',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        className="bottom-nav"
      >
        {mainNav.map(item => {
          const Icon = item.icon;
          const active = item.path
            ? isActive(item.path)
            : isMoreActive || showMore;
          const isAdd = item.label === 'Add';

          if (isAdd) {
            return (
              <button
                key="add"
                onClick={() => handleNavClick(item.path)}
                aria-label="Add new transaction"   // ✅ Added
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: theme.colors.btnPrimary,
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.20)',
                  flexShrink: 0,
                }}
              >
                <Icon size={22} color="#ffffff" />
              </button>
            );
          }

          return (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.path)}
              aria-label={`Go to ${item.label}`}         // ✅ Added
              aria-current={active ? 'page' : undefined} // ✅ Added
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 12px',
                minWidth: '56px',
                borderRadius: theme.radius.md,
              }}
            >
              <Icon
                size={20}
                color={active
                  ? theme.colors.primary
                  : theme.colors.textSecondary}
                strokeWidth={active ? 2.5 : 1.8}
              />
              <span style={{
                color: active
                  ? theme.colors.primary
                  : theme.colors.textSecondary,
                fontSize: '10px',
                fontWeight: active
                  ? theme.fontWeights.semibold
                  : theme.fontWeights.regular,
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Hide on desktop */}
      <style>{`
        @media (min-width: 769px) {
          .bottom-nav { display: none !important; }
        }
      `}</style>
    </>
  );
};

export default BottomNav;
