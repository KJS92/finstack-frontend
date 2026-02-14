import { supabase } from '../config/supabase';
import { alertService } from './alertService';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  period: string | null;
  start_date: string;
  end_date: string;
  created_at: string | null;
  rollover_enabled?: boolean;
  rollover_amount?: number;
  auto_renew?: boolean;
  status?: string;
  alert_threshold?: number;
}

export interface BudgetWithSpending extends Budget {
  category_name?: string;
  category_icon?: string;
  category_color?: string;
  spent: number;
  remaining: number;
  percentage: number;
}

class BudgetService {
  async getBudgets(): Promise<Budget[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getBudgetsWithSpending(startDate?: string, endDate?: string): Promise<BudgetWithSpending[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const now = new Date();
    const monthStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    console.log('Getting budgets for user:', user.id);

    // Get ALL budgets for this user
    const { data: budgets, error: budgetError } = await supabase
      .from('budgets')
      .select(`
        *,
        categories (
          name,
          icon,
          color
        )
      `)
      .eq('user_id', user.id);

    console.log('Budgets loaded:', budgets);
    console.log('Error:', budgetError);

    if (budgetError) throw budgetError;

    if (!budgets || budgets.length === 0) {
      console.log('No budgets found');
      return [];
    }

    // Get spending for each category
    const budgetsWithSpending: BudgetWithSpending[] = await Promise.all(
      budgets.map(async (budget: any) => {
        if (!budget.category_id) {
          return {
            ...budget,
            category_name: budget.categories?.name,
            category_icon: budget.categories?.icon,
            category_color: budget.categories?.color,
            spent: 0,
            remaining: budget.amount,
            percentage: 0
          };
        }

        const { data: transactions } = await supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', user.id)
          .eq('category_id', budget.category_id)
          .eq('transaction_type', 'debit')
          .gte('transaction_date', budget.start_date)
          .lte('transaction_date', budget.end_date);

        const spent = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
        const remaining = budget.amount - spent;
        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        return {
          ...budget,
          category_name: budget.categories?.name,
          category_icon: budget.categories?.icon,
          category_color: budget.categories?.color,
          spent,
          remaining,
          percentage: Math.min(percentage, 100)
        };
      })
    );

    console.log('Budgets with spending:', budgetsWithSpending);
    return budgetsWithSpending;
  }

  async createBudget(budget: Omit<Budget, 'id' | 'user_id' | 'created_at'>): Promise<Budget> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('budgets')
      .insert([{ ...budget, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteBudget(id: string): Promise<void> {
    const { error } = await supabase
      .from('budgets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Reset budget (clear spending, start fresh with proper dates)
async resetBudget(id: string): Promise<Budget> {
  // First, get the current budget to know its period
  const { data: currentBudget, error: fetchError } = await supabase
    .from('budgets')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;
  if (!currentBudget) throw new Error('Budget not found');

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const day = today.getDate();
  
  // Helper function to format date without timezone issues
  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  const startDate = new Date(year, month, day);
  let endDate: Date;

  // Calculate end date based on period
  if (currentBudget.period === 'monthly') {
    // End of current month
    endDate = new Date(year, month + 1, 0);
  } else if (currentBudget.period === 'weekly') {
    // 6 days from today (7 day period including start)
    endDate = new Date(year, month, day + 6);
  } else {
    // Keep same duration as original
    const [oldStartY, oldStartM, oldStartD] = currentBudget.start_date.split('-').map(Number);
    const [oldEndY, oldEndM, oldEndD] = currentBudget.end_date.split('-').map(Number);
    const oldStart = new Date(oldStartY, oldStartM - 1, oldStartD);
    const oldEnd = new Date(oldEndY, oldEndM - 1, oldEndD);
    const duration = oldEnd.getTime() - oldStart.getTime();
    endDate = new Date(startDate.getTime() + duration);
  }

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  console.log('Resetting budget:', {
    id,
    period: currentBudget.period,
    oldDates: `${currentBudget.start_date} to ${currentBudget.end_date}`,
    newDates: `${startDateStr} to ${endDateStr}`,
    endDateDay: endDate.getDate()
  });

  const { data, error } = await supabase
    .from('budgets')
    .update({ 
      rollover_amount: 0,
      start_date: startDateStr,
      end_date: endDateStr
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

  // Renew budget for next period
async renewBudget(oldBudget: BudgetWithSpending): Promise<Budget> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Helper function to format date without timezone issues
  const formatDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Calculate next period dates properly
  const [oldYear, oldMonth, oldDay] = oldBudget.end_date.split('-').map(Number);
  const oldEndDate = new Date(oldYear, oldMonth - 1, oldDay);
  let newStartDate: Date;
  let newEndDate: Date;

  if (oldBudget.period === 'monthly') {
    // Start from the day after old end date
    newStartDate = new Date(oldYear, oldMonth - 1, oldDay + 1);
    
    // End date is last day of the start date's month
    const startYear = newStartDate.getFullYear();
    const startMonth = newStartDate.getMonth();
    newEndDate = new Date(startYear, startMonth + 1, 0);
    
  } else if (oldBudget.period === 'weekly') {
    newStartDate = new Date(oldYear, oldMonth - 1, oldDay + 1);
    newEndDate = new Date(oldYear, oldMonth - 1, oldDay + 7);
    
  } else {
    // Daily or custom - just add same duration
    const [startYear, startMonth, startDay] = oldBudget.start_date.split('-').map(Number);
    const duration = oldEndDate.getTime() - new Date(startYear, startMonth - 1, startDay).getTime();
    newStartDate = new Date(oldYear, oldMonth - 1, oldDay + 1);
    newEndDate = new Date(newStartDate.getTime() + duration);
  }

  // Calculate rollover amount if enabled
  const rolloverAmount = oldBudget.rollover_enabled 
    ? Math.max(0, oldBudget.amount - oldBudget.spent) 
    : 0;

  const startDateStr = formatDate(newStartDate);
  const endDateStr = formatDate(newEndDate);

  console.log('Renewing budget:', {
    oldPeriod: `${oldBudget.start_date} to ${oldBudget.end_date}`,
    newPeriod: `${startDateStr} to ${endDateStr}`,
    endDay: newEndDate.getDate(),
    rolloverAmount,
    rolloverEnabled: oldBudget.rollover_enabled
  });

  // Create new budget
  const { data, error } = await supabase
    .from('budgets')
    .insert({
      user_id: user.id,
      category_id: oldBudget.category_id,
      amount: oldBudget.amount,
      period: oldBudget.period,
      start_date: startDateStr,
      end_date: endDateStr,
      rollover_enabled: oldBudget.rollover_enabled,
      auto_renew: oldBudget.auto_renew,
      rollover_amount: rolloverAmount
    })
    .select()
    .single();

  if (error) throw error;
  
  // Mark old budget as expired
  await supabase
    .from('budgets')
    .update({ status: 'expired' })
    .eq('id', oldBudget.id);

  try {
  const categoryName = oldBudget.category_name || 'Budget';
  const rolloverText = rolloverAmount > 0 
    ? ` with ₹${rolloverAmount.toLocaleString('en-IN')} rolled over`
    : '';
  
  await alertService.createAlert(
    data.id,
    'renewed',
    `✅ ${categoryName} budget renewed for next period${rolloverText}!`,
    undefined
  );
} catch (alertError) {
  console.error('Error creating renewal alert:', alertError);
}
  return data;
}
  
  // Check and auto-renew expired budgets
  async checkAndRenewBudgets(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const today = new Date().toISOString().split('T')[0];

    // Get expired budgets with auto-renew enabled
    const { data: expiredBudgets } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user.id)
      .eq('auto_renew', true)
      .eq('status', 'active')
      .lt('end_date', today);

    if (expiredBudgets && expiredBudgets.length > 0) {
      for (const budget of expiredBudgets) {
        try {
          await this.renewBudget(budget);
          const categoryName = budget.categories?.name || 'Budget';
          await alertService.createAlert(
          budget.id,
          'expired',
          `⏰ Your ${categoryName} budget has expired. ${budget.auto_renew ? 'Auto-renewal will create a new budget.' : 'Click to renew it for the next period.'}`,
          undefined
        );
          console.log('Auto-renewed budget:', budget.id);
        } catch (err) {
          console.error('Error renewing budget:', budget.id, err);
        }
      }
    }
  }
  
  // Get current month's budget summary
  async getCurrentMonthSummary(): Promise<{
    totalBudget: number;
    totalSpent: number;
    totalRemaining: number;
  }> {
    const budgets = await this.getBudgetsWithSpending();
    
    return {
      totalBudget: budgets.reduce((sum, b) => sum + b.amount, 0),
      totalSpent: budgets.reduce((sum, b) => sum + b.spent, 0),
      totalRemaining: budgets.reduce((sum, b) => sum + b.remaining, 0)
    };
  }
}

export const budgetService = new BudgetService();
