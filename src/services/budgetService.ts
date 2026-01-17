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

    // Get current month if no dates provided
    const now = new Date();
    const monthStart = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    // Get budgets with category info
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
      .eq('user_id', user.id)
      .gte('end_date', monthStart)  // Budget is still active
      .lte('start_date', monthEnd);  // Budget has started

    if (budgetError) throw budgetError;

    // Get spending for each category
    const budgetsWithSpending: BudgetWithSpending[] = await Promise.all(
      (budgets || []).map(async (budget: any) => {
        if (!budget.category_id) {
          return {
            ...budget,
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
          .gte('transaction_date', monthStart)
          .lte('transaction_date', monthEnd);

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
