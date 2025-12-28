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

    await this.updateAccountBalance(accountId);

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
    }
  }

  async updateAccountBalance(accountId: string): Promise<void> {
    const { data: latestTransaction, error } = await supabase
      .from('transactions')
      .select('balance')
      .eq('account_id', accountId)
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !latestTransaction?.balance) return;

    await supabase
      .from('accounts')
      .update({ balance: latestTransaction.balance })
      .eq('id', accountId);
  }

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

    if (transaction?.account_id) {
      await this.recalculateBalances(transaction.account_id);
    }
  }

  async deleteTransaction(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

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

    if (transaction?.account_id) {
      await this.recalculateBalances(transaction.account_id);
    }
  }

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
  const updates = [];
  
  // Calculate all balances first
  for (const txn of transactions || []) {
    if (txn.transaction_type === 'credit') {
      runningBalance += txn.amount;
    } else {
      runningBalance -= txn.amount;
    }
    
    updates.push({
      id: txn.id,
      balance: runningBalance
    });
  }

  // Batch update in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    
    // Update transactions in batch
    const updatePromises = chunk.map(update =>
      supabase
        .from('transactions')
        .update({ balance: update.balance })
        .eq('id', update.id)
    );
    
    await Promise.all(updatePromises);
  }

  console.log(`Updated ${updates.length} transactions, final balance: ${runningBalance}`);

  // Update the account balance
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ balance: runningBalance })
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('Error updating account balance:', updateError);
    throw updateError;
  }
  
  console.log('Account balance updated successfully');
}
}

export const transactionService = new TransactionService();
