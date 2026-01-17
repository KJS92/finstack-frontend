import { supabase } from '../config/supabase';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_default: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateCategoryDto {
  name: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryDto {
  name?: string;
  icon?: string;
  color?: string;
}

class CategoryService {
  // Get all categories for current user
  async getCategories(): Promise<Category[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) throw error;
    return data || [];
  }

  // Get a single category by ID
  async getCategoryById(id: string): Promise<Category | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Create a new category
  async createCategory(categoryDto: CreateCategoryDto): Promise<Category> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .insert([{
        user_id: user.id,
        name: categoryDto.name,
        icon: categoryDto.icon || '📌',
        color: categoryDto.color || '#3B82F6',
        is_default: false
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Update a category
  async updateCategory(id: string, categoryDto: UpdateCategoryDto): Promise<Category> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('categories')
      .update({
        name: categoryDto.name,
        icon: categoryDto.icon,
        color: categoryDto.color,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Delete a category
  async deleteCategory(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Check if category is default
    const category = await this.getCategoryById(id);
    if (category?.is_default) {
      throw new Error('Cannot delete default categories');
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
  }

  // Get category statistics (transaction count per category)
  async getCategoryStats(startDate?: string, endDate?: string): Promise<any[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    let query = supabase
      .from('transactions')
      .select('category_id, amount, transaction_type')
      .eq('user_id', user.id);

    if (startDate) {
      query = query.gte('transaction_date', startDate);
    }
    if (endDate) {
      query = query.lte('transaction_date', endDate);
    }

    const { data: transactions, error } = await query;
    if (error) throw error;

    const categories = await this.getCategories();

    // Calculate stats per category
    const statsMap = new Map();
    
    transactions?.forEach(txn => {
      const categoryId = txn.category_id || 'uncategorized';
      if (!statsMap.has(categoryId)) {
        statsMap.set(categoryId, {
          category_id: categoryId,
          total_amount: 0,
          debit_amount: 0,
          credit_amount: 0,
          transaction_count: 0
        });
      }

      const stats = statsMap.get(categoryId);
      stats.transaction_count++;
      stats.total_amount += txn.amount;
      
      if (txn.transaction_type === 'debit') {
        stats.debit_amount += txn.amount;
      } else {
        stats.credit_amount += txn.amount;
      }
    });

    // Merge with category details
    const result = Array.from(statsMap.values()).map(stat => {
      const category = categories?.find(c => c.id === stat.category_id);
      return {
        ...stat,
        category_name: category?.name || 'Uncategorized',
        category_icon: category?.icon || '❓',
        category_color: category?.color || '#6B7280'
      };
    });

    return result.sort((a, b) => b.debit_amount - a.debit_amount);
  }
}

export const categoryService = new CategoryService();
