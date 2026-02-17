import { supabase } from '../config/supabase';

export interface MonthlySummary {
  month: string;
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  transactionCount: number;
}

export interface CategoryBreakdown {
  category_id: string;
  category_name: string;
  category_icon: string;
  category_color: string;
  total_amount: number;
  transaction_count: number;
  percentage: number;
}

export interface AccountSummary {
  account_id: string;
  account_name: string;
  account_type: string;
  total_income: number;
  total_expense: number;
  net_change: number;
  transaction_count: number;
}

export interface DailySpending {
  date: string;
  amount: number;
}

class ReportsService {
  // Get monthly summary for a specific month
  async getMonthlySummary(year: number, month: number): Promise<MonthlySummary> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select('transaction_type, amount')
      .eq('user_id', user.id)
      .gte('transaction_date', startDateStr)
      .lte('transaction_date', endDateStr);

    if (error) throw error;

    const totalIncome = data
      ?.filter(t => t.transaction_type === 'credit')
      .reduce((sum, t) => sum + t.amount, 0) || 0;

    const totalExpense = data
      ?.filter(t => t.transaction_type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0) || 0;

    return {
      month: `${year}-${String(month).padStart(2, '0')}`,
      totalIncome,
      totalExpense,
      netAmount: totalIncome - totalExpense,
      transactionCount: data?.length || 0
    };
  }

  // Get category breakdown for a date range
  // Get category breakdown for a date range
async getCategoryBreakdown(startDate: string, endDate: string): Promise<CategoryBreakdown[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // First get all transactions
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, category_id')
    .eq('user_id', user.id)
    .eq('transaction_type', 'debit')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (txError) throw txError;

  // Then get all categories
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name, icon, color')
    .eq('user_id', user.id);

  if (catError) throw catError;

  // Create a map of categories
  const categoryMapById = new Map(categories?.map(cat => [cat.id, cat]) || []);

  // Group by category
  const categoryMap = new Map<string, CategoryBreakdown>();
  
  transactions?.forEach((transaction: any) => {
    const categoryId = transaction.category_id || 'uncategorized';
    const category = categoryMapById.get(categoryId);
    const categoryName = category?.name || 'Uncategorized';
    const categoryIcon = category?.icon || '📦';
    const categoryColor = category?.color || '#999999';

    if (categoryMap.has(categoryId)) {
      const existing = categoryMap.get(categoryId)!;
      existing.total_amount += transaction.amount;
      existing.transaction_count += 1;
    } else {
      categoryMap.set(categoryId, {
        category_id: categoryId,
        category_name: categoryName,
        category_icon: categoryIcon,
        category_color: categoryColor,
        total_amount: transaction.amount,
        transaction_count: 1,
        percentage: 0
      });
    }
  });

  // Calculate percentages
  const totalSpending = Array.from(categoryMap.values())
    .reduce((sum, cat) => sum + cat.total_amount, 0);

  const breakdown = Array.from(categoryMap.values()).map(cat => ({
    ...cat,
    percentage: totalSpending > 0 ? (cat.total_amount / totalSpending) * 100 : 0
  }));

  // Sort by amount descending
  return breakdown.sort((a, b) => b.total_amount - a.total_amount);
}

  // Get account-wise summary
async getAccountSummary(startDate: string, endDate: string): Promise<AccountSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // First get all transactions
  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('amount, transaction_type, account_id')
    .eq('user_id', user.id)
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate);

  if (txError) throw txError;

  // Then get all accounts - FIXED COLUMN NAME
  const { data: accounts, error: accError } = await supabase
    .from('accounts')
    .select('id, account_number, account_type')  // Changed from account_name to account_number
    .eq('user_id', user.id);

  if (accError) throw accError;

  // Create a map of accounts
  const accountMapById = new Map(accounts?.map(acc => [acc.id, acc]) || []);

  // Group by account
  const accountMap = new Map<string, AccountSummary>();
  
  transactions?.forEach((transaction: any) => {
    const accountId = transaction.account_id || 'unknown';
    const account = accountMapById.get(accountId);
    const accountName = account?.account_number || 'Unknown Account';  // Changed to account_number
    const accountType = account?.account_type || 'unknown';

    if (accountMap.has(accountId)) {
      const existing = accountMap.get(accountId)!;
      if (transaction.transaction_type === 'credit') {
        existing.total_income += transaction.amount;
      } else {
        existing.total_expense += transaction.amount;
      }
      existing.transaction_count += 1;
      existing.net_change = existing.total_income - existing.total_expense;
    } else {
      accountMap.set(accountId, {
        account_id: accountId,
        account_name: accountName,
        account_type: accountType,
        total_income: transaction.transaction_type === 'credit' ? transaction.amount : 0,
        total_expense: transaction.transaction_type === 'debit' ? transaction.amount : 0,
        net_change: transaction.transaction_type === 'credit' ? transaction.amount : -transaction.amount,
        transaction_count: 1
      });
    }
  });

  return Array.from(accountMap.values())
    .sort((a, b) => b.total_expense - a.total_expense);
}
  
  // Get daily spending trend
  async getDailySpending(startDate: string, endDate: string): Promise<DailySpending[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('transactions')
      .select('transaction_date, amount')
      .eq('user_id', user.id)
      .eq('transaction_type', 'debit')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (error) throw error;

    // Group by date
    const dateMap = new Map<string, number>();
    
    data?.forEach((transaction) => {
      const date = transaction.transaction_date;
      if (dateMap.has(date)) {
        dateMap.set(date, dateMap.get(date)! + transaction.amount);
      } else {
        dateMap.set(date, transaction.amount);
      }
    });

    return Array.from(dateMap.entries()).map(([date, amount]) => ({
      date,
      amount
    }));
  }
}

export const reportsService = new ReportsService();
