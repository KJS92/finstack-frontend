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

  // Notify user that balance update is happening in background
  if (transaction?.account_id) {
    // Show notification via custom event
    window.dispatchEvent(new CustomEvent('showToast', {
      detail: { message: 'Updating account balances...', type: 'info' }
    }));

    // Recalculate in background
    this.recalculateBalances(transaction.account_id)
      .then(() => {
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: { message: 'Balances updated successfully!', type: 'success' }
        }));
        // Trigger data refresh
        window.dispatchEvent(new CustomEvent('balancesUpdated'));
      })
      .catch(err => {
        console.error('Background balance recalculation failed:', err);
        window.dispatchEvent(new CustomEvent('showToast', {
          detail: { message: 'Balance update failed. Please refresh the page.', type: 'error' }
        }));
      });
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

  console.log(`🔄 Starting balance recalculation for account: ${accountId}`);

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .eq('account_id', accountId)
    .order('transaction_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  console.log(`📊 Found ${transactions?.length} transactions to recalculate`);
  
  if (transactions && transactions.length > 0) {
    console.log(`📅 Date range: ${transactions[0].transaction_date} to ${transactions[transactions.length - 1].transaction_date}`);
  }

  let runningBalance = 0;
  const updates = [];
  
  for (const txn of transactions || []) {
    if (txn.transaction_type === 'credit') {
      runningBalance += txn.amount;
    } else {
      runningBalance -= txn.amount;
    }
    
    // Log first 3 and last 3 transactions
    const index = updates.length;
    if (index < 3 || index >= (transactions?.length || 0) - 3) {
      console.log(`  ${index + 1}. ${txn.transaction_date} | ${txn.description.substring(0, 30)} | ${txn.transaction_type} ₹${txn.amount} | Balance: ₹${runningBalance}`);
    } else if (index === 3) {
      console.log(`  ... (${(transactions?.length || 0) - 6} more transactions) ...`);
    }
    
    updates.push({
      id: txn.id,
      balance: runningBalance
    });
  }

  // Batch update in chunks of 100
  const chunkSize = 100;
  console.log(`💾 Updating ${updates.length} transactions in batches of ${chunkSize}...`);
  
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    
    const updatePromises = chunk.map(update =>
      supabase
        .from('transactions')
        .update({ balance: update.balance })
        .eq('id', update.id)
    );
    
    await Promise.all(updatePromises);
    console.log(`  ✅ Updated batch ${Math.floor(i / chunkSize) + 1} (${chunk.length} transactions)`);
  }

  console.log(`✅ Final balance: ₹${runningBalance}`);

  // Update the account balance
  const { error: updateError } = await supabase
    .from('accounts')
    .update({ balance: runningBalance })
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('❌ Error updating account balance:', updateError);
    throw updateError;
  }
  
  console.log(`✅ Account balance updated successfully to ₹${runningBalance}`);
}
  class TransactionService {
  // ... existing methods like getTransactions, createTransaction, etc.

  async deleteTransaction(id: string): Promise<void> {
    // ... existing delete method
  }

  // ADD THIS NEW METHOD HERE ⬇️
  async updateTransactionCategory(transactionId: string, categoryId: string | null): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('transactions')
      .update({ category_id: categoryId })
      .eq('id', transactionId)
      .eq('user_id', user.id);

    if (error) throw error;
  }

} // ← End of TransactionService class

export const transactionService = new TransactionService();

}
export const transactionService = new TransactionService();
