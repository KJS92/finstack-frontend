import { supabase } from '../config/supabase';
import { ParsedTransaction } from './transactionParser';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: 'debit' | 'credit';
  balance: number | null;
  category: string | null;
  notes: string | null;
  is_verified: boolean;
  source_file: string | null;
  created_at: string;
}

export const transactionService = {
  // Import transactions to database
  async importTransactions(
    transactions: ParsedTransaction[],
    accountId: string,
    sourceFile: string
  ): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const records = transactions.map(t => ({
      user_id: user.id,
      account_id: accountId,
      transaction_date: t.date,
      description: t.description,
      amount: t.amount,
      transaction_type: t.type,
      balance: t.balance || null,
      source_file: sourceFile,
      is_verified: false
    }));

    const { data, error } = await supabase
      .from('transactions')
      .insert(records)
      .select();

    if (error) throw error;
    return data?.length || 0;
  },

  // Get all transactions
  async getTransactions(accountId?: string): Promise<Transaction[]> {
    let query = supabase
      .from('transactions')
      .select('*')
      .order('transaction_date', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Get transaction by ID
  async getTransaction(id: string): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Update transaction
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete transaction
  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
