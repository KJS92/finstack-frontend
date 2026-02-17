import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import AppHeader from '../components/layout/AppHeader';
import { reportsService, MonthlySummary, CategoryBreakdown, AccountSummary, DailySpending } from '../services/reportsService';
import { TrendingUp, Calendar, PieChart, Wallet, TrendingDown } from 'lucide-react';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import SpendingTrendChart from '../components/charts/SpendingTrendChart';
import './Reports.css';

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([]);
  const [dailySpending, setDailySpending] = useState<DailySpending[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Load user
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  useEffect(() => {
    loadReports();
  }, [selectedMonth, selectedYear]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Calculate date range for selected month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      const [summary, categories, accounts, spending] = await Promise.all([
        reportsService.getMonthlySummary(selectedYear, selectedMonth),
        reportsService.getCategoryBreakdown(startDate, endDate),
        reportsService.getAccountSummary(startDate, endDate),
        reportsService.getDailySpending(startDate, endDate)
      ]);

      setMonthlySummary(summary);
      setCategoryBreakdown(categories);
      setAccountSummary(accounts);
      setDailySpending(spending);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Transform category data for pie chart
  const categoryChartData = categoryBreakdown.map(cat => ({
    name: cat.category_name,
    value: cat.total_amount,
    color: cat.category_color
  }));

  if (!user) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <div>
      <AppHeader title="Reports" userEmail={user.email || ''} activePage="reports" />
      
      <div className="reports-container">
        {loading ? (
          <div className="loading-container">
            <div>Loading reports...</div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="reports-header">
              <div className="reports-title">
                <h1>Financial Reports</h1>
                <p>Detailed insights into your spending and income</p>
              </div>
              
              {/* Month Selector */}
              <div className="month-selector">
                <Calendar className="w-5 h-5" style={{ color: '#999' }} />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <option key={i} value={new Date().getFullYear() - i}>
                      {new Date().getFullYear() - i}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Monthly Summary Cards */}
            {monthlySummary && (
              <div className="summary-cards">
                {/* Income Card */}
                <div className="summary-card income">
                  <div className="summary-card-header">
                    <span className="summary-card-label">Total Income</span>
                    <TrendingUp size={20} color="#16a34a" />
                  </div>
                  <div className="summary-card-amount">
                    ₹{monthlySummary.totalIncome.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Expense Card */}
                <div className="summary-card expense">
                  <div className="summary-card-header">
                    <span className="summary-card-label">Total Expense</span>
                    <TrendingUp size={20} color="#dc2626" style={{ transform: 'rotate(180deg)' }} />
                  </div>
                  <div className="summary-card-amount">
                    ₹{monthlySummary.totalExpense.toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Net Amount Card */}
                <div className={`summary-card ${monthlySummary.netAmount >= 0 ? 'net-positive' : 'net-negative'}`}>
                  <div className="summary-card-header">
                    <span className="summary-card-label">Net Amount</span>
                    <Wallet size={20} color={monthlySummary.netAmount >= 0 ? '#2563eb' : '#ea580c'} />
                  </div>
                  <div className="summary-card-amount">
                    ₹{Math.abs(monthlySummary.netAmount).toLocaleString('en-IN')}
                  </div>
                  <div className="summary-card-info">
                    {monthlySummary.transactionCount} transactions
                  </div>
                </div>
              </div>
            )}

            {/* Spending Trend Chart */}
            <div className="section-card">
              <div className="section-header">
                <TrendingDown size={20} />
                <h2>Spending Trend</h2>
              </div>
              <SpendingTrendChart data={dailySpending} />
            </div>

            {/* Category Pie Chart */}
            <div className="section-card">
              <div className="section-header">
                <PieChart size={20} />
                <h2>Category Distribution</h2>
              </div>
              <CategoryPieChart data={categoryChartData} />
            </div>

            {/* Category Breakdown List */}
            <div className="section-card">
              <div className="section-header">
                <PieChart size={20} />
                <h2>Category Breakdown</h2>
              </div>
              
              {categoryBreakdown.length === 0 ? (
                <p className="empty-state">No expense data for this period</p>
              ) : (
                <div className="category-list">
                  {categoryBreakdown.map((category) => (
                    <div key={category.category_id} className="category-item">
                      <span className="category-icon">{category.category_icon}</span>
                      <div className="category-details">
                        <div className="category-header">
                          <span className="category-name">{category.category_name}</span>
                          <span className="category-amount">
                            ₹{category.total_amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="category-progress">
                          <div className="progress-bar-container">
                            <div
                              className="progress-bar"
                              style={{
                                width: `${category.percentage}%`,
                                backgroundColor: category.category_color
                              }}
                            />
                          </div>
                          <span className="category-percentage">
                            {category.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <div className="category-count">
                          {category.transaction_count} transactions
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
                        <th className="text-right">Transactions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountSummary.map((account) => (
                        <tr key={account.account_id}>
                          <td>
                            <div className="account-name">{account.account_name}</div>
                            <div className="account-type">{account.account_type}</div>
                          </td>
                          <td className="text-right amount-income">
                            ₹{account.total_income.toLocaleString('en-IN')}
                          </td>
                          <td className="text-right amount-expense">
                            ₹{account.total_expense.toLocaleString('en-IN')}
                          </td>
                          <td className={`text-right ${account.net_change >= 0 ? 'amount-net-positive' : 'amount-net-negative'}`}>
                            ₹{Math.abs(account.net_change).toLocaleString('en-IN')}
                          </td>
                          <td className="text-right">
                            {account.transaction_count}
                          </td>
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
