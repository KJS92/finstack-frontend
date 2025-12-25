import { supabase } from '../config/supabase';

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  transaction_date: string;
  description: string;
  transaction_type: 'debit' | 'credit';
  amount: number;
  balance: number | null;
  category: string | null;
  is_verified: boolean;
  created_at: string;
}

class TransactionService {
  async getTransactions(accountId?: string): Promise<Transaction[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false });

    if (accountId) {
      query = query.eq('account_id', accountId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async importTransactions(
    transactions: any[],
    accountId: string,
    fileName: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const transactionsToInsert = transactions.map(t => ({
      user_id: user.id,
      account_id: accountId,
      transaction_date: t.transaction_date,
      description: t.description,
      transaction_type: t.transaction_type,
      amount: t.amount,
      balance: t.balance,
      category: t.category || 'Uncategorized'
    }));

    const { error: insertError } = await supabase
      .from('transactions')
      .insert(transactionsToInsert);

    if (insertError) throw insertError;

    // Update account balance to closing balance
    await this.updateAccountBalance(accountId);

    // Record file upload
    const fileType = fileName.split('.').pop()?.toLowerCase() || 'csv';
    
    const { error: fileError } = await supabase
      .from('file_uploads')
      .insert({
        user_id: user.id,
        account_id: accountId,
        file_name: fileName,
        file_type: fileType,
        status: 'completed',
        uploaded_at: new Date().toISOString()
      });

    if (fileError) throw fileError;
  }

  async updateAccountBalance(accountId: string): Promise<void> {
    // Get the most recent transaction for this account
    const { data: latestTransaction, error } = await supabase
      .from('transactions')
      .select('balance')
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestTransaction?.balance) return;

    // Update account balance
    await supabase
      .from('accounts')
      .update({ balance: latestTransaction.balance })
      .eq('id', accountId);
  }

  async deleteTransaction(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get transaction details before deleting
    const { data: transaction } = await supabase
      .from('transactions')
      .select('account_id')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    // Update account balance after deletion
    if (transaction?.account_id) {
      await this.updateAccountBalance(transaction.account_id);
    }
  }
}

export const transactionService = new TransactionService();
