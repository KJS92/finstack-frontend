import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import { receivablesPayablesService } from '../services/receivablesPayablesService';
import { theme } from '../theme';
import AppHeader from '../components/layout/AppHeader';
import { AlertCircle, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

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

interface RPSummary {
  totalReceivable: number;
  totalPayable: number;
  overdueReceivable: number;
  overduePayable: number;
}

interface UpcomingDue {
  id: string;
  title: string;
  type: 'receivable' | 'payable';
  remaining_amount: number;
  due_date: string;
  status: string;
  contact_name?: string;
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
  const [rpSummary, setRpSummary] = useState<RPSummary | null>(null);
  const [upcomingDues, setUpcomingDues] = useState<UpcomingDue[]>([]);
  const [loading, setLoading] = useState(true);
  const lastLoadTime = useRef<number>(0);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    checkUser();
    loadDashboardData().then(() => {
      setInitialLoaded(true);
      lastLoadTime.current = Date.now();
    });
  }, []);

  useEffect(() => {
    if (initialLoaded) {
      loadDashboardData();
      lastLoadTime.current = Date.now();
    }
  }, [location.pathname]);

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

      // ── Accounts ──
      const accountsData = await accountService.getAccounts();
      setAccounts(accountsData);

      // ── Net Worth ──
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

      // ── This Month's Stats (FIXED: actual current month range) ──
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString().split('T')[0];

      const [{ data: incomeData }, { data: expenseData }] = await Promise.all([
        supabase.from('transactions').select('amount')
          .eq('user_id', user.id).eq('transaction_type', 'credit')
          .gte('transaction_date', monthStart).lte('transaction_date', monthEnd),
        supabase.from('transactions').select('amount')
          .eq('user_id', user.id).eq('transaction_type', 'debit')
          .gte('transaction_date', monthStart).lte('transaction_date', monthEnd)
      ]);
      const income = incomeData?.reduce((s, t) => s + Number(t.amount), 0) || 0;
      const expenses = expenseData?.reduce((s, t) => s + Number(t.amount), 0) || 0;
      setMonthStats({ income, expenses, savings: income - expenses });

      // ── Recent Transactions ──
      const { data: txns } = await supabase
        .from('transactions')
        .select('id, description, amount, transaction_type, transaction_date, category')
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false })
        .limit(5);
      setRecentTxns(txns || []);

      // ── Category Spending ──
      const { data: catData } = await supabase
        .from('category_spending')
        .select('category, total')
        .eq('user_id', user.id)
        .order('total', { ascending: false })
        .limit(4);
      setCategorySpend(catData || []);

      // ── Receivables / Payables Summary ──
      try {
        const rp = await receivablesPayablesService.getSummary();
        setRpSummary({
          totalReceivable: rp.pendingReceivable,
          totalPayable: rp.pendingPayable,
          overdueReceivable: rp.overdueReceivable,
          overduePayable: rp.overduePayable,
        });
      } catch (_) {}

      // ── Upcoming Dues (next 7 days) ──
      try {
        const sevenDaysLater = new Date();
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
        const today = new Date().toISOString().split('T')[0];
        const futureDate = sevenDaysLater.toISOString().split('T')[0];

        const { data: dueData } = await supabase
          .from('receivables_payables')
          .select('id, title, type, remaining_amount, due_date, status, contact_name')
          .eq('user_id', user.id)
          .neq('status', 'completed')
          .gte('due_date', today)
          .lte('due_date', futureDate)
          .order('due_date', { ascending: true })
          .limit(5);
        setUpcomingDues(dueData || []);
      } catch (_) {}

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
      <AppHeader title="Dashboard" userEmail={userEmail} activePage="dashboard" />

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

        {/* ── Net Worth Hero ── */}
        <Card style={{ marginBottom: '16px', padding: '20px' }}>
          <p style={{ color: theme.colors.textSecondary, fontSize: theme.fontSizes.label, margin: '0 0 6px' }}>
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

        {/* ── Month Stats ── */}
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
              <p style={{ color: theme.colors.textSecondary, fontSize: '11px', margin: '0 0 4px' }}>
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

        {/* ── Receivables / Payables Summary ── */}
        {rpSummary && (rpSummary.totalReceivable > 0 || rpSummary.totalPayable > 0) && (
          <Card style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <p style={{
                color: theme.colors.textPrimary,
                fontSize: theme.fontSizes.heading2,
                fontWeight: theme.fontWeights.semibold,
                margin: 0,
              }}>
                Receivables & Payables
              </p>
              <button
                onClick={() => navigate('/receivables')}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{
                background: '#f0fdf4',
                borderRadius: theme.radius.md,
                padding: '12px',
                border: '1px solid #bbf7d0',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <TrendingUp size={14} color="#16a34a" />
                  <span style={{ fontSize: '11px', color: '#15803d', fontWeight: 500 }}>To Receive</span>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#14532d', margin: 0 }}>
                  {formatINR(rpSummary.totalReceivable)}
                </p>
                {rpSummary.overdueReceivable > 0 && (
                  <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>
                    {formatINR(rpSummary.overdueReceivable)} overdue
                  </p>
                )}
              </div>
              <div style={{
                background: '#fef2f2',
                borderRadius: theme.radius.md,
                padding: '12px',
                border: '1px solid #fecaca',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <TrendingDown size={14} color="#dc2626" />
                  <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 500 }}>To Pay</span>
                </div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#7f1d1d', margin: 0 }}>
                  {formatINR(rpSummary.totalPayable)}
                </p>
                {rpSummary.overduePayable > 0 && (
                  <p style={{ fontSize: '11px', color: '#dc2626', margin: '4px 0 0' }}>
                    {formatINR(rpSummary.overduePayable)} overdue
                  </p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── Upcoming Dues (next 7 days) ── */}
        {upcomingDues.length > 0 && (
          <Card style={{ marginBottom: '16px', padding: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color={theme.colors.primary} />
                <p style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.fontSizes.heading2,
                  fontWeight: theme.fontWeights.semibold,
                  margin: 0,
                }}>
                  Due This Week
                </p>
              </div>
              <button
                onClick={() => navigate('/receivables')}
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
            {upcomingDues.map((due, i) => (
              <div key={due.id}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      backgroundColor: due.type === 'receivable' ? '#16a34a' : '#dc2626',
                      flexShrink: 0,
                    }} />
                    <div>
                      <p style={{
                        color: theme.colors.textPrimary,
                        fontSize: theme.fontSizes.body,
                        fontWeight: theme.fontWeights.medium,
                        margin: '0 0 2px',
                      }}>
                        {due.title}
                      </p>
                      <p style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption, margin: 0 }}>
                        {due.contact_name && `${due.contact_name} · `}
                        {new Date(due.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      color: due.type === 'receivable' ? '#16a34a' : '#dc2626',
                      fontSize: theme.fontSizes.body,
                      fontWeight: theme.fontWeights.semibold,
                      margin: '0 0 2px',
                    }}>
                      {formatINR(due.remaining_amount)}
                    </p>
                    {due.status === 'overdue' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end' }}>
                        <AlertCircle size={10} color="#dc2626" />
                        <span style={{ fontSize: '10px', color: '#dc2626' }}>Overdue</span>
                      </div>
                    )}
                  </div>
                </div>
                {i < upcomingDues.length - 1 && (
                  <div style={{ height: '1px', backgroundColor: theme.colors.borderSubtle }} />
                )}
              </div>
            ))}
          </Card>
        )}

        {/* ── Accounts ── */}
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
              <p style={{ color: theme.colors.textSecondary, marginBottom: '12px' }}>No accounts yet</p>
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
                  <div style={{ height: '1px', backgroundColor: theme.colors.borderSubtle }} />
                )}
              </div>
            ))
          )}
        </Card>

        {/* ── Category Spending ── */}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
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

        {/* ── Recent Transactions ── */}
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
                        .toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
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
                  <div style={{ height: '1px', backgroundColor: theme.colors.borderSubtle }} />
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
