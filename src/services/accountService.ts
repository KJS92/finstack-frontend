import { supabase } from '../config/supabase';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: 'bank' | 'credit_card' | 'savings' | 'investment' | 'wallet';
  balance: number;
  currency: string;
  account_number?: string;
  bank_name?: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAccountInput {
  name: string;
  type: Account['type'];
  balance?: number;
  account_number?: string;
  bank_name?: string;
  color?: string;
}

export const accountService = {
  // Get all accounts for current user
  async getAccounts(): Promise<Account[]> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get single account
  async getAccount(id: string): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Create new account
  async createAccount(input: CreateAccountInput): Promise<Account> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('accounts')
      .insert([{
        user_id: user.id,
        name: input.name,
        type: input.type,
        balance: input.balance || 0,
        account_number: input.account_number,
        bank_name: input.bank_name,
        color: input.color || '#3B82F6',
        currency: 'INR'
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update account
  async updateAccount(id: string, updates: Partial<CreateAccountInput>): Promise<Account> {
    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete account (soft delete)
  async deleteAccount(id: string): Promise<void> {
    const { error } = await supabase
      .from('accounts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) throw error;
  },

  // Get total balance across all accounts
  async getTotalBalance(): Promise<number> {
    const accounts = await this.getAccounts();
    return accounts.reduce((total, acc) => total + Number(acc.balance), 0);
  }
};
