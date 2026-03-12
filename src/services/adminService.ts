import { supabase } from '../config/supabase';

export interface AdminStats {
  totalUsers: number;
  totalAccounts: number;
  totalTransactions: number;
  totalAssets: number;
  newUsersThisMonth: number;
  newTransactionsThisMonth: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  created_at: string;
  accountCount: number;
  transactionCount: number;
  lastSeen: string | null;
}

export const adminService = {
  /** Check if the current user has the admin flag in user_metadata */
  async isAdmin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.user_metadata?.is_admin === true;
  },

  /** Aggregate stats — only counts, no user financial data */
  async getStats(): Promise<AdminStats> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [
      { count: totalAccounts },
      { count: totalTransactions },
      { count: totalAssets },
      { count: newTransactionsThisMonth },
    ] = await Promise.all([
      supabase.from('accounts').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('assets').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('transactions').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
    ]);

    return {
      totalUsers: 0,          // populated client-side from user rows
      totalAccounts: totalAccounts || 0,
      totalTransactions: totalTransactions || 0,
      totalAssets: totalAssets || 0,
      newUsersThisMonth: 0,   // populated client-side
      newTransactionsThisMonth: newTransactionsThisMonth || 0,
    };
  },

  /**
   * Returns per-user metadata: email (from accounts table email column or
   * from auth user_metadata where available), join date, account + txn counts.
   * No balances or transaction details are exposed.
   */
  async getUserRows(): Promise<AdminUserRow[]> {
    // Pull distinct user_ids + account counts from accounts table
    const { data: accountRows, error: accErr } = await supabase
      .from('accounts')
      .select('user_id, created_at');

    if (accErr) throw accErr;

    // Count transactions per user
    const { data: txnRows, error: txnErr } = await supabase
      .from('transactions')
      .select('user_id');

    if (txnErr) throw txnErr;

    // Get email + created_at from profiles table if it exists, fallback to auth
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, email, created_at');

    // Build user map
    const userMap: Record<string, AdminUserRow> = {};

    (accountRows || []).forEach(row => {
      const uid = row.user_id;
      if (!userMap[uid]) {
        userMap[uid] = {
          id: uid,
          email: '',
          created_at: row.created_at,
          accountCount: 0,
          transactionCount: 0,
          lastSeen: null,
        };
      }
      userMap[uid].accountCount += 1;
    });

    (txnRows || []).forEach(row => {
      const uid = row.user_id;
      if (!userMap[uid]) {
        userMap[uid] = { id: uid, email: '', created_at: '', accountCount: 0, transactionCount: 0, lastSeen: null };
      }
      userMap[uid].transactionCount += 1;
    });

    // Enrich with profile email if available
    (profileRows || []).forEach(p => {
      if (userMap[p.id]) {
        userMap[p.id].email = p.email || '';
        if (!userMap[p.id].created_at) userMap[p.id].created_at = p.created_at;
      }
    });

    // For users with no email from profiles, mask the ID
    return Object.values(userMap).map(u => ({
      ...u,
      email: u.email || `user-${u.id.slice(0, 8)}`,
    }));
  },
};
