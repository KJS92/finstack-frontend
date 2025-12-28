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

export interface DuplicateCheckResult {
  duplicates: any[];
  newTransactions: any[];
  duplicateCount: number;
  newCount: number;
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

  async checkDuplicates(
    transactions: any[],
    accountId: string
  ): Promise<DuplicateCheckResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const duplicates: any[] = [];
    const newTransactions: any[] = [];

    for (const txn of transactions) {
      // Check if transaction exists with same date, amount, and description
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .eq('transaction_date', txn.transaction_date)
        .eq('amount', txn.amount)
        .eq('description', txn.description)
        .limit(1);

      if (existing && existing.length > 0) {
        duplicates.push(txn);
      } else {
        newTransactions.push(txn);
      }
    }

    return {
      duplicates,
      newTransactions,
      duplicateCount: duplicates.length,
      newCount: newTransactions.length
    };
  }

  async importTransactions(
    transactions: any[],
    accountId: string,
    fileName: string,
    skipDuplicates: boolean = true
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Filter duplicates if needed
    let transactionsToImport = transactions;
    
    if (skipDuplicates) {
      const duplicateCheck = await this.checkDuplicates(transactions, accountId);
      transactionsToImport = duplicateCheck.newTransactions;
    }

    if (transactionsToImport.length === 0) {
      throw new Error('No new transactions to import (all are duplicates)');
    }

    const transactionsToInsert = transactionsToImport.map(t => ({
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
        status: 'completed'
      });

    if (fileError) {
      console.error('File upload record error:', fileError);
      // Don't throw - transactions are already imported
    }
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

  // NEW: Update transaction function
  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('account_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('transactions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    // Recalculate balances for the account after update
    if (transaction?.account_id) {
      await this.recalculateBalances(transaction.account_id);
    }
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

    // Recalculate balances after deletion
    if (transaction?.account_id) {
      await this.recalculateBalances(transaction.account_id);
    }
  }

  // NEW: Recalculate balances function
  async recalculateBalances(accountId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  let runningBalance = 0;
  
  // Update all transaction balances
  for (const txn of transactions || []) {
    if (txn.transaction_type === 'credit') {
      runningBalance += txn.amount;
    } else {
      runningBalance -= txn.amount;
    }

    await supabase
      .from('transactions')
      .update({ balance: runningBalance })
      .eq('id', txn.id);
  }

  // Update the account balance directly with the final running balance
  await supabase
    .from('accounts')
    .update({ balance: runningBalance })
    .eq('id', accountId);
}
}
  // Update account balance to the latest transaction balance
  
export const transactionService = new TransactionService();
