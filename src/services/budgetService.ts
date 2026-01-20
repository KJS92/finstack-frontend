import { supabase } from '../config/supabase';

export interface Budget {
  id: string;
  user_id: string;
  category_id: string | null;
  amount: number;
  period: string | null;  // Changed from period_type
  start_date: string;
  end_date: string;  // NOT NULL in your schema
  created_at: string | null;
  rollover_enabled?: boolean;      // NEW
  rollover_amount?: number;        // NEW
  auto_renew?: boolean;            // NEW
  status?: string;                 // NEW
  // Note: No is_active or updated_at in your schema
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

  // Get ALL budgets for this user (simplified query)
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

  // Reset budget (clear spending, start fresh)
async resetBudget(id: string): Promise<Budget> {
  const { data, error } = await supabase
    .from('budgets')
    .update({ 
      rollover_amount: 0,
      start_date: new Date().toISOString().split('T')[0]
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Renew budget for next period
async renewBudget(oldBudget: Budget): Promise<Budget> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Calculate next period dates
  const endDate = new Date(oldBudget.end_date);
  let start_date: string;
  let end_date: string;

  if (oldBudget.period === 'monthly') {
    start_date = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1).toISOString().split('T')[0];
    end_date = new Date(endDate.getFullYear(), endDate.getMonth() + 2, 0).toISOString().split('T')[0];
  } else if (oldBudget.period === 'quarterly') {
    start_date = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1).toISOString().split('T')[0];
    end_date = new Date(endDate.getFullYear(), endDate.getMonth() + 4, 0).toISOString().split('T')[0];
  } else if (oldBudget.period === 'yearly') {
    start_date = new Date(endDate.getFullYear() + 1, 0, 1).toISOString().split('T')[0];
    end_date = new Date(endDate.getFullYear() + 1, 11, 31).toISOString().split('T')[0];
  } else {
    throw new Error('Cannot auto-renew custom period budgets');
  }

  // Calculate rollover amount if enabled
  const rollover_amount = oldBudget.rollover_enabled ? 
    Math.max(0, oldBudget.amount - (oldBudget as any).spent || 0) : 0;

  // Create new budget
  const { data, error } = await supabase
    .from('budgets')
    .insert([{
      user_id: user.id,
      category_id: oldBudget.category_id,
      amount: oldBudget.amount,
      period: oldBudget.period,
      start_date,
      end_date,
      rollover_enabled: oldBudget.rollover_enabled,
      rollover_amount,
      auto_renew: oldBudget.auto_renew,
      status: 'active'
    }])
    .select()
    .single();

  if (error) throw error;

  // Mark old budget as expired
  await supabase
    .from('budgets')
    .update({ status: 'expired' })
    .eq('id', oldBudget.id);

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
