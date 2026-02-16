import React, { useState, useEffect } from 'react';
import { reportsService, MonthlySummary, CategoryBreakdown, AccountSummary } from '../services/reportsService';
import { TrendingUp, Calendar, PieChart, Wallet } from 'lucide-react';

const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown[]>([]);
  const [accountSummary, setAccountSummary] = useState<AccountSummary[]>([]);
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadReports();
  }, [selectedMonth, selectedYear]);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Calculate date range for selected month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      const [summary, categories, accounts] = await Promise.all([
        reportsService.getMonthlySummary(selectedYear, selectedMonth),
        reportsService.getCategoryBreakdown(startDate, endDate),
        reportsService.getAccountSummary(startDate, endDate)
      ]);

      setMonthlySummary(summary);
      setCategoryBreakdown(categories);
      setAccountSummary(accounts);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
          <p className="text-sm text-gray-500 mt-1">
            Detailed insights into your spending and income
          </p>
        </div>
        
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-gray-400" />
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700">Total Income</span>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-green-900">
              ₹{monthlySummary.totalIncome.toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-700">Total Expense</span>
              <TrendingUp className="w-5 h-5 text-red-600 transform rotate-180" />
            </div>
            <div className="text-2xl font-bold text-red-900">
              ₹{monthlySummary.totalExpense.toLocaleString('en-IN')}
            </div>
          </div>

          <div className={`${monthlySummary.netAmount >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-6`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-medium ${monthlySummary.netAmount >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                Net Amount
              </span>
              <Wallet className={`w-5 h-5 ${monthlySummary.netAmount >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
            </div>
            <div className={`text-2xl font-bold ${monthlySummary.netAmount >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
              ₹{Math.abs(monthlySummary.netAmount).toLocaleString('en-IN')}
            </div>
            <div className="text-xs mt-1 text-gray-600">
              {monthlySummary.transactionCount} transactions
            </div>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Category Breakdown</h2>
        </div>
        
        {categoryBreakdown.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No expense data for this period</p>
        ) : (
          <div className="space-y-3">
            {categoryBreakdown.map((category) => (
              <div key={category.category_id} className="flex items-center gap-3">
                <span className="text-2xl">{category.category_icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {category.category_name}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      ₹{category.total_amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${category.percentage}%`,
                          backgroundColor: category.category_color
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 w-12 text-right">
                      {category.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {category.transaction_count} transactions
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Account Summary */}
      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">Account Summary</h2>
        </div>
        
        {accountSummary.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No account data for this period</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Account</th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-700">Income</th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-700">Expense</th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-700">Net</th>
                  <th className="text-right py-2 px-2 text-sm font-medium text-gray-700">Transactions</th>
                </tr>
              </thead>
              <tbody>
                {accountSummary.map((account) => (
                  <tr key={account.account_id} className="border-b last:border-0">
                    <td className="py-3 px-2">
                      <div className="font-medium text-gray-900">{account.account_name}</div>
                      <div className="text-xs text-gray-500 capitalize">{account.account_type}</div>
                    </td>
                    <td className="py-3 px-2 text-right text-green-600 font-medium">
                      ₹{account.total_income.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-2 text-right text-red-600 font-medium">
                      ₹{account.total_expense.toLocaleString('en-IN')}
                    </td>
                    <td className={`py-3 px-2 text-right font-bold ${account.net_change >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      ₹{Math.abs(account.net_change).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-600">
                      {account.transaction_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
