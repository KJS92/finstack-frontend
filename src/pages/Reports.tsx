import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../config/supabase';
import AppHeader from '../components/layout/AppHeader';
import { reportsService, MonthlySummary, CategoryBreakdown, AccountSummary, DailySpending } from '../services/reportsService';
import { budgetService, BudgetWithSpending } from '../services/budgetService';
import { TrendingUp, TrendingDown, Calendar, PieChart, Wallet, BarChart2, Download, ArrowDownRight, ArrowUpRight, Minus, Package } from 'lucide-react';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import SpendingTrendChart from '../components/charts/SpendingTrendChart';
import './Reports.css';

type RangeOption = 'this_month' | 'last_3m' | 'last_6m' | 'custom';

interface MonthlyBarData { month: string; income: number; expense: number; }
interface TopExpense { description: string; amount: number; category: string; transaction_date: string; }

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const formatINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userReady, setUserReady] = useState(false);
  const [rangeOption, setRangeOption] = useState<RangeOption>('this_month');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([]);
  const [dailySpending, setDailySpending] = useState<DailySpending[]>([]);
  const [monthlyBarData, setMonthlyBarData] = useState<MonthlyBarData[]>([]);
  const [topExpenses, setTopExpenses] = useState<TopExpense[]>([]);
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);

  // Resolve user once on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setUserReady(true);
    });
  }, []);

  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    const now = new Date();
    if (rangeOption === 'this_month') {
      return {
        startDate: new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0],
        endDate: new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0],
      };
    } else if (rangeOption === 'last_3m') {
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
      };
    } else if (rangeOption === 'last_6m') {
      return {
        startDate: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0],
        endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0],
      };
    } else {
      return { startDate: customStart, endDate: customEnd };
    }
  }, [rangeOption, selectedMonth, selectedYear, customStart, customEnd]);

  // Only run after user is confirmed
  useEffect(() => {
    if (!userReady || !user) return;
    if (rangeOption === 'custom' && (!customStart || !customEnd)) return;
    loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userReady, rangeOption, selectedMonth, selectedYear, customStart, customEnd]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = getDateRange();
      const [summary, categories, accounts, spending, topExp, budgetData, barData] = await Promise.all([
        reportsService.getMonthlySummary(selectedYear, selectedMonth),
        reportsService.getCategoryBreakdown(startDate, endDate),
        reportsService.getAccountSummary(startDate, endDate),
        reportsService.getDailySpending(startDate, endDate),
        loadTopExpenses(startDate, endDate),
        budgetService.getBudgetsWithSpending(startDate, endDate),
        loadMonthlyBarData(),
      ]);
      setMonthlySummary(summary);
      setCategoryBreakdown(categories);
      setAccountSummary(accounts);
      setDailySpending(spending);
      setTopExpenses(topExp);
      setBudgets(budgetData);
      setMonthlyBarData(barData);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTopExpenses = async (startDate: string, endDate: string): Promise<TopExpense[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase
      .from('transactions').select('description, amount, category, transaction_date')
      .eq('user_id', user.id).eq('transaction_type', 'debit')
      .gte('transaction_date', startDate).lte('transaction_date', endDate)
      .order('amount', { ascending: false }).limit(5);
    return data || [];
  };

  // Single query for all 6 months — no more serial loop
  const loadMonthlyBarData = async (): Promise<MonthlyBarData[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().split('T')[0];
    const endOfThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const { data } = await supabase
      .from('transactions')
      .select('transaction_date, transaction_type, amount')
      .eq('user_id', user.id)
      .gte('transaction_date', sixMonthsAgo)
      .lte('transaction_date', endOfThisMonth);

    if (!data) return [];

    // Build 6-month buckets client-side
    const buckets: Record<string, MonthlyBarData> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets[key] = { month: MONTH_NAMES[d.getMonth()], income: 0, expense: 0 };
    }

    data.forEach(t => {
      const key = t.transaction_date.slice(0, 7);
      if (buckets[key]) {
        if (t.transaction_type === 'credit') buckets[key].income += t.amount;
        else buckets[key].expense += t.amount;
      }
    });

    return Object.values(buckets);
  };

  const handleExportCSV = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { startDate, endDate } = getDateRange();
    const { data } = await supabase
      .from('transactions').select('transaction_date, description, category, amount, transaction_type, notes')
      .eq('user_id', user.id).gte('transaction_date', startDate).lte('transaction_date', endDate)
      .order('transaction_date', { ascending: false });
    if (!data || data.length === 0) { alert('No transactions found for the selected period.'); return; }
    const headers = ['Date', 'Description', 'Category', 'Type', 'Amount (Rs.)', 'Notes'];
    const rows = data.map(t => [
      t.transaction_date,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.category || '',
      t.transaction_type === 'credit' ? 'Income' : 'Expense',
      t.amount,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finstack-transactions-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const categoryChartData = categoryBreakdown.map(cat => ({
    name: cat.category_name, value: cat.total_amount, color: cat.category_color,
  }));

  const maxBarValue = Math.max(...monthlyBarData.flatMap(m => [m.income, m.expense]), 1);
  const BAR_HEIGHT = 150;
  const getBarPx = (val: number) => {
    if (val <= 0) return 0;
    return Math.max(6, Math.round((val / maxBarValue) * BAR_HEIGHT));
  };

  if (!userReady) return <div className="loading-container">Loading...</div>;
  if (!user) return <div className="loading-container">Not authenticated</div>;

  return (
    <div>
      <AppHeader title="Reports" userEmail={user.email || ''} activePage="reports" />
      <div className="reports-container">
        {loading ? (
          <div className="loading-container"><div>Loading reports...</div></div>
        ) : (
          <>
            {/* Header */}
            <div className="reports-header">
              <div className="reports-title">
                <h1>Financial Reports</h1>
                <p>Detailed insights into your spending and income</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="month-selector">
                  <Calendar className="w-5 h-5" style={{ color: '#999' }} />
                  <select value={rangeOption} onChange={e => setRangeOption(e.target.value as RangeOption)}>
                    <option value="this_month">This Month</option>
                    <option value="last_3m">Last 3 Months</option>
                    <option value="last_6m">Last 6 Months</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {rangeOption === 'this_month' && (
                  <div className="month-selector">
                    <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                        </option>
                      ))}
                    </select>
                    <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <option key={i} value={new Date().getFullYear() - i}>{new Date().getFullYear() - i}</option>
                      ))}
                    </select>
                  </div>
                )}
                {rangeOption === 'custom' && (
                  <div className="month-selector">
                    <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }} />
                    <span style={{ color: '#666' }}>to</span>
                    <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }} />
                  </div>
                )}
                <button onClick={handleExportCSV} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', backgroundColor: '#16a34a', color: '#fff',
                  border: 'none', borderRadius: '8px', fontSize: '14px',
                  cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                }}>
                  <Download size={14} />
                  Export CSV
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            {monthlySummary && (
              <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px', marginBottom: '24px',
              }}>
                {[
                  { label: 'Total Income', value: monthlySummary.totalIncome, accent: '#16a34a', bg: '#f0fdf4', textColor: '#14532d', Icon: ArrowDownRight },
                  { label: 'Total Expense', value: monthlySummary.totalExpense, accent: '#dc2626', bg: '#fef2f2', textColor: '#7f1d1d', Icon: ArrowUpRight },
                  { label: 'Net Amount', value: monthlySummary.netAmount, accent: '#2563eb', bg: '#eff6ff', textColor: '#1e3a8a', Icon: Minus, sub: `${monthlySummary.transactionCount} transactions` },
                ].map(({ label, value, accent, bg, textColor, Icon, sub }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${accent}30`, borderTop: `3px solid ${accent}`, borderRadius: '12px', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', color: textColor, fontWeight: 600, opacity: 0.8 }}>{label}</span>
                      <Icon size={18} color={accent} />
                    </div>
                    <div style={{ fontSize: '22px', fontWeight: 700, color: textColor }}>
                      {formatINR(Math.abs(value))}
                    </div>
                    {sub && <div style={{ fontSize: '12px', color: textColor, opacity: 0.7, marginTop: '4px' }}>{sub}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Income vs Expense Bar Chart */}
            {monthlyBarData.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <BarChart2 size={20} />
                  <h2>Income vs Expense (Last 6 Months)</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '180px', padding: '0 8px' }}>
                  {monthlyBarData.map(m => (
                    <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', width: '100%', height: `${BAR_HEIGHT}px`, justifyContent: 'center' }}>
                        <div style={{ width: '42%', height: `${getBarPx(m.income)}px`, backgroundColor: '#16a34a', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease' }} title={`Income: ${formatINR(m.income)}`} />
                        <div style={{ width: '42%', height: `${getBarPx(m.expense)}px`, backgroundColor: '#dc2626', borderRadius: '3px 3px 0 0', transition: 'height 0.4s ease' }} title={`Expense: ${formatINR(m.expense)}`} />
                      </div>
                      <span style={{ fontSize: '11px', color: '#666' }}>{m.month}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '12px', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#16a34a', borderRadius: '2px' }} />
                    <span style={{ fontSize: '12px', color: '#666' }}>Income</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '12px', backgroundColor: '#dc2626', borderRadius: '2px' }} />
                    <span style={{ fontSize: '12px', color: '#666' }}>Expense</span>
                  </div>
                </div>
              </div>
            )}

            {/* Daily Spending Trend */}
            <div className="section-card">
              <div className="section-header">
                <TrendingDown size={20} />
                <h2>Daily Spending Trend</h2>
              </div>
              {dailySpending.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9ca3af' }}>
                  <TrendingDown size={32} color="#d1d5db" style={{ marginBottom: '8px' }} />
                  <p style={{ margin: 0, fontSize: '14px' }}>No spending data for this period</p>
                </div>
              ) : (
                <SpendingTrendChart data={dailySpending} />
              )}
            </div>

            {/* Category Pie Chart */}
            <div className="section-card">
              <div className="section-header">
                <PieChart size={20} />
                <h2>Category Distribution</h2>
              </div>
              <CategoryPieChart data={categoryChartData} />
            </div>

            {/* Category Breakdown */}
            <div className="section-card">
              <div className="section-header">
                <PieChart size={20} />
                <h2>Category Breakdown</h2>
              </div>
              {categoryBreakdown.length === 0 ? (
                <p className="empty-state">No expense data for this period</p>
              ) : (
                <div className="category-list">
                  {categoryBreakdown.map(category => (
                    <div key={category.category_id} className="category-item">
                      <span className="category-icon">{category.category_icon}</span>
                      <div className="category-details">
                        <div className="category-header">
                          <span className="category-name">{category.category_name}</span>
                          <span className="category-amount">₹{category.total_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="category-progress">
                          <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${category.percentage}%`, backgroundColor: category.category_color }} />
                          </div>
                          <span className="category-percentage">{category.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="category-count">{category.transaction_count} transactions</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Expenses */}
            {topExpenses.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <TrendingDown size={20} color="#dc2626" />
                  <h2>Top Expenses</h2>
                </div>
                <div className="category-list">
                  {topExpenses.map((exp, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < topExpenses.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#dc2626', flexShrink: 0 }}>{i + 1}</div>
                        <div>
                          <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, color: '#111' }}>{exp.description}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: '#666', textTransform: 'capitalize' }}>{exp.category} · {new Date(exp.transaction_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 700, color: '#dc2626' }}>₹{exp.amount.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Budget vs Actual */}
            {budgets.length > 0 && (
              <div className="section-card">
                <div className="section-header">
                  <BarChart2 size={20} />
                  <h2>Budget vs Actual</h2>
                </div>
                <div className="category-list">
                  {budgets.map(budget => (
                    <div key={budget.id} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {budget.category_icon
                            ? <span style={{ fontSize: '14px' }}>{budget.category_icon}</span>
                            : <Package size={14} color="#9ca3af" />}
                          <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>{budget.category_name || 'Budget'}</span>
                        </div>
                        <span style={{ fontSize: '13px', color: budget.percentage >= 100 ? '#dc2626' : budget.percentage >= 80 ? '#d97706' : '#16a34a', fontWeight: 600 }}>
                          ₹{budget.spent.toLocaleString('en-IN')} / ₹{budget.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="progress-bar-container">
                        <div className="progress-bar" style={{ width: `${Math.min(budget.percentage, 100)}%`, backgroundColor: budget.percentage >= 100 ? '#dc2626' : budget.percentage >= 80 ? '#d97706' : '#16a34a' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#666' }}>{budget.percentage.toFixed(0)}% used</span>
                        <span style={{ fontSize: '11px', color: '#666' }}>₹{budget.remaining.toLocaleString('en-IN')} left</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Account Summary */}
            <div className="section-card">
              <div className="section-header">
                <Wallet size={20} />
                <h2>Account Summary</h2>
              </div>
              {accountSummary.length === 0 ? (
                <p className="empty-state">No account data for this period</p>
              ) : (
                <div className="account-table-container">
                  <table className="account-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th className="text-right">Income</th>
                        <th className="text-right">Expense</th>
                        <th className="text-right">Net</th>
                        <th className="text-right">Txns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountSummary.map(account => (
                        <tr key={account.account_id}>
                          <td>
                            <div className="account-name">{account.account_name}</div>
                            <div className="account-type">{account.account_type}</div>
                          </td>
                          <td className="text-right amount-income">₹{account.total_income.toLocaleString('en-IN')}</td>
                          <td className="text-right amount-expense">₹{account.total_expense.toLocaleString('en-IN')}</td>
                          <td className={`text-right ${account.net_change >= 0 ? 'amount-net-positive' : 'amount-net-negative'}`}>₹{Math.abs(account.net_change).toLocaleString('en-IN')}</td>
                          <td className="text-right">{account.transaction_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
