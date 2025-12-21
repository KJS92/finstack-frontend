import { supabase } from '../config/supabase';

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
}

export const profileService = {
  // Get current user profile
  async getProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    return {
      id: user.id,
      email: user.email || '',
      created_at: user.created_at
    };
  },

  // Update email
  async updateEmail(newEmail: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      email: newEmail
    });
    if (error) throw error;
  },

  // Update password
  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw error;
  },

  // Get account statistics
  async getAccountStats() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get account count
    const { count: accountCount } = await supabase
      .from('accounts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    return {
      accountCount: accountCount || 0,
      memberSince: user.created_at
    };
  }
};
