import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import { theme } from '../theme';
import AppHeader from '../components/layout/AppHeader';

// ── Types ──────────────────────────────────────────────
interface MonthStats {
  income: number;
  expenses: number;
  savings: number;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_type: 'credit' | 'debit';
  transaction_date: string;
  category: string;
}

interface CategorySpend {
  category: string;
  total: number;
}

// ── Helpers ────────────────────────────────────────────
const formatINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

// ── Reusable Card ──────────────────────────────────────
const Card: React.FC<{
  children: React.ReactNode;
  padding?: string;
  accentColor?: string;
  style?: React.CSSProperties;
}> = ({ children, padding = theme.spacing.md, accentColor, style }) => (
  <div style={{
    backgroundColor: theme.colors.card,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.radius.lg,
    borderTop: accentColor ? `3px solid ${accentColor}` : undefined,
    padding,
    boxShadow: theme.shadows.card,
    ...style,
  }}>
    {children}
  </div>
);

// ── Dashboard ──────────────────────────────────────────
const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userEmail, setUserEmail] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [netWorth, setNetWorth] = useState(0);
  const [monthStats, setMonthStats] = useState<MonthStats>({
    income: 0, expenses: 0, savings: 0,
  });
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [categorySpend, setCategorySpend] = useState<CategorySpend[]>([]);
  const [loading, setLoading] = useState(true);
  const lastLoadTime = useRef<number>(0);
  const [initialLoaded, setInitialLoaded] = useState(false); // ← Add this

// Run once on mount
useEffect(() => {
  checkUser();
  loadDashboardData().then(() => {
    setInitialLoaded(true);
    lastLoadTime.current = Date.now();
  });
}, []);

// Re-fetch when navigating back to /dashboard
useEffect(() => {
  if (initialLoaded) {
    loadDashboardData();
    lastLoadTime.current = Date.now();
  }
}, [location.pathname]);

// Focus listener — only reload if last load was 5+ minutes ago
useEffect(() => {
  const handleFocus = () => {
    const fiveMinutes = 5 * 60 * 1000;
    if (Date.now() - lastLoadTime.current > fiveMinutes) {
      loadDashboardData();
      lastLoadTime.current = Date.now();
    }
  };
  window.addEventListener('focus', handleFocus);
  return () => window.removeEventListener('focus', handleFocus);
}, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate('/auth');
    else setUserEmail(session.user.email || '');
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // ── Accounts (your existing service — preserved) ──
      const accountsData = await accountService.getAccounts();
      setAccounts(accountsData);

      // ── Net Worth ──────────────────────────────────────
      const bankBalance = accountsData
        .filter(a => a.type !== 'credit_card')
        .reduce((s, a) => s + Number(a.balance), 0);

      const creditLiability = accountsData
        .filter(a => a.type === 'credit_card')
        .reduce((s, a) => s + Number(a.balance), 0);

      const { data: assets } = await supabase
        .from('assets')
        .select('current_value')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const totalAssets = assets?.reduce((s, a) => s + Number(a.current_value), 0) || 0;
      setNetWorth(bankBalance + totalAssets - creditLiability);

      // ── This Month's Stats ─────────────────────────────
      const now = new Date();
      const monthEnd = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];
      
      // 🔍 ADD THESE DEBUG LINES TEMPORARILY
console.log('Date range:', monthStart, '→', monthEnd);
console.log('User ID:', user.id);

      const { data: incomeData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('transaction_type', 'credit')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd);

      const { data: expenseData } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', user.id)
        .eq('transaction_type', 'debit')
        .gte('transaction_date', monthStart)
        .lte('transaction_date', monthEnd);

      // 🔍 ADD THESE TOO
console.log('Income data:', incomeData, 'Error:', incomeError);
console.log('Expense data:', expenseData, 'Error:', expenseError);

      const income = incomeData?.reduce((s, t) => s + Number(t.amount), 0) || 0;
      const expenses = expenseData?.reduce((s, t) => s + Number(t.amount), 0) || 0;
      setMonthStats({ income, expenses, savings: income - expenses });

      // ── Recent Transactions ────────────────────────────
      const { data: txns } = await supabase
        .from('transactions')
        .select('id, description, amount, transaction_type, transaction_date, category')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(5);
      setRecentTxns(txns || []);

      // ── Category Spending ──────────────────────────────
      const { data: catData } = await supabase
        .from('category_spending')
        .select('category, total')
        .eq('user_id', user.id)
        .order('total', { ascending: false })
        .limit(4);
      setCategorySpend(catData || []);

    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountClick = (account: Account) => {
    navigate('/transactions-list', {
      state: { accountId: account.id, accountName: account.name }
    });
  };

  const maxSpend = Math.max(...categorySpend.map(c => c.total), 1);
  const firstName = userEmail.split('@')[0];

  if (loading) return (
    <div style={{
      display: 'flex', justifyContent: 'center',
      alignItems: 'center', height: '100vh',
      fontFamily: 'Inter, sans-serif',
      color: theme.colors.textSecondary,
    }}>
      Loading...
    </div>
  );

  return (
    <div style={{
      backgroundColor: theme.colors.background,
      minHeight: '100vh',
      fontFamily: 'Inter, sans-serif',
    }}>
      <AppHeader
        title="Dashboard"
        userEmail={userEmail}
        activePage="dashboard"
      />

      <div style={{
        padding: '20px 16px 80px',
        maxWidth: '640px',
        margin: '0 auto',
      }}>

        {/* Greeting */}
        <p style={{
          color: theme.colors.textSecondary,
          fontSize: theme.fontSizes.label,
          margin: '0 0 4px',
        }}>
          {getGreeting()}, {firstName}
        </p>

        {/* ── Net Worth Hero ─────────────────────────── */}
        <Card style={{ marginBottom: '16px', padding: '20px' }}>
          <p style={{
            color: theme.colors.textSecondary,
            fontSize: theme.fontSizes.label,
            margin: '0 0 6px',
          }}>
            Net Worth
          </p>
          <h1 style={{
            color: theme.colors.textPrimary,
            fontSize: theme.fontSizes.display,
            fontWeight: theme.fontWeights.bold,
            margin: '0 0 4px',
            letterSpacing: '-0.5px',
          }}>
            {formatINR(netWorth)}
          </h1>
        </Card>

        {/* ── Month Stats ────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          marginBottom: '16px',
        }}>
          {[
            { label: 'Income', value: monthStats.income, color: theme.colors.income },
            { label: 'Expenses', value: monthStats.expenses, color: theme.colors.expense },
            { label: 'Savings', value: monthStats.savings, color: theme.colors.info },
          ].map(stat => (
            <Card key={stat.label} accentColor={stat.color} padding="12px">
              <p style={{
                color: theme.colors.textSecondary,
                fontSize: '11px',
                margin: '0 0 4px',
              }}>
                {stat.label}
              </p>
              <p style={{
                color: theme.colors.textPrimary,
                fontSize: '14px',
                fontWeight: theme.fontWeights.semibold,
                margin: 0,
              }}>
                {formatINR(stat.value)}
              </p>
            </Card>
          ))}
        </div>

        {/* ── Accounts ───────────────────────────────── */}
        <Card style={{ marginBottom: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
          }}>
            <p style={{
              color: theme.colors.textPrimary,
              fontSize: theme.fontSizes.heading2,
              fontWeight: theme.fontWeights.semibold,
              margin: 0,
            }}>
              Accounts
            </p>
            <button
              onClick={() => navigate('/accounts')}
              style={{
                background: 'none', border: 'none',
                color: theme.colors.primary,
                fontSize: theme.fontSizes.label,
                cursor: 'pointer',
                fontWeight: theme.fontWeights.medium,
              }}
            >
              View all →
            </button>
          </div>

          {accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ color: theme.colors.textSecondary, marginBottom: '12px' }}>
                No accounts yet
              </p>
              <button
                onClick={() => navigate('/accounts')}
                style={{
                  backgroundColor: theme.colors.btnPrimary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: theme.radius.md,
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontWeight: theme.fontWeights.semibold,
                }}
              >
                Add First Account
              </button>
            </div>
          ) : (
            accounts.slice(0, 4).map((account, i) => (
              <div key={account.id}>
                <div
                  onClick={() => handleAccountClick(account)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    cursor: 'pointer',
                    borderLeft: `3px solid ${account.color || theme.colors.primary}`,
                    paddingLeft: '12px',
                  }}
                >
                  <div>
                    <p style={{
                      color: theme.colors.textPrimary,
                      fontWeight: theme.fontWeights.medium,
                      fontSize: theme.fontSizes.body,
                      margin: '0 0 2px',
                    }}>
                      {account.name}
                    </p>
                    <p style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption,
                      margin: 0,
                      textTransform: 'capitalize',
                    }}>
                      {account.type.replace('_', ' ')}
                    </p>
                  </div>
                  <p style={{
                    color: theme.colors.textPrimary,
                    fontWeight: theme.fontWeights.semibold,
                    fontSize: theme.fontSizes.body,
                    margin: 0,
                  }}>
                    {formatINR(Number(account.balance))}
                  </p>
                </div>
                {i < Math.min(accounts.length, 4) - 1 && (
                  <div style={{
                    height: '1px',
                    backgroundColor: theme.colors.borderSubtle,
                  }} />
                )}
              </div>
            ))
          )}
        </Card>

        {/* ── Category Spending ──────────────────────── */}
        {categorySpend.length > 0 && (
          <Card style={{ marginBottom: '16px' }}>
            <p style={{
              color: theme.colors.textPrimary,
              fontSize: theme.fontSizes.heading2,
              fontWeight: theme.fontWeights.semibold,
              margin: '0 0 16px',
            }}>
              Spending by Category
            </p>
            {categorySpend.map(cat => (
              <div key={cat.category} style={{ marginBottom: '14px' }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '5px',
                }}>
                  <span style={{
                    color: theme.colors.textSecondary,
                    fontSize: theme.fontSizes.label,
                    textTransform: 'capitalize',
                  }}>
                    {cat.category}
                  </span>
                  <span style={{
                    color: theme.colors.textPrimary,
                    fontSize: theme.fontSizes.label,
                    fontWeight: theme.fontWeights.medium,
                  }}>
                    {formatINR(cat.total)}
                  </span>
                </div>
                <div style={{
                  backgroundColor: theme.colors.borderSubtle,
                  borderRadius: theme.radius.pill,
                  height: '6px',
                }}>
                  <div style={{
                    backgroundColor: theme.colors.primary,
                    borderRadius: theme.radius.pill,
                    height: '6px',
                    width: `${(cat.total / maxSpend) * 100}%`,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>
            ))}
          </Card>
        )}

        {/* ── Recent Transactions ────────────────────── */}
        {recentTxns.length > 0 && (
          <Card>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <p style={{
                color: theme.colors.textPrimary,
                fontSize: theme.fontSizes.heading2,
                fontWeight: theme.fontWeights.semibold,
                margin: 0,
              }}>
                Recent Transactions
              </p>
              <button
                onClick={() => navigate('/transactions')}
                style={{
                  background: 'none', border: 'none',
                  color: theme.colors.primary,
                  fontSize: theme.fontSizes.label,
                  cursor: 'pointer',
                  fontWeight: theme.fontWeights.medium,
                }}
              >
                View all →
              </button>
            </div>
            {recentTxns.map((txn, i) => (
              <div key={txn.id}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                }}>
                  <div>
                    <p style={{
                      color: theme.colors.textPrimary,
                      fontSize: theme.fontSizes.body,
                      fontWeight: theme.fontWeights.medium,
                      margin: '0 0 2px',
                    }}>
                      {txn.description}
                    </p>
                    <p style={{
                      color: theme.colors.textMuted,
                      fontSize: theme.fontSizes.caption,
                      margin: 0,
                      textTransform: 'capitalize',
                    }}>
                      {txn.category} · {new Date(txn.transaction_date)
                        .toLocaleDateString('en-IN', {
                          day: 'numeric', month: 'short',
                        })}
                    </p>
                  </div>
                  <span style={{
                    color: txn.transaction_type === 'credit'
                      ? theme.colors.income
                      : theme.colors.expense,
                    fontWeight: theme.fontWeights.semibold,
                    fontSize: theme.fontSizes.body,
                  }}>
                    {txn.transaction_type === 'credit' ? '+' : '-'}
                    {formatINR(txn.amount)}
                  </span>
                </div>
                {i < recentTxns.length - 1 && (
                  <div style={{
                    height: '1px',
                    backgroundColor: theme.colors.borderSubtle,
                  }} />
                )}
              </div>
            ))}
          </Card>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
