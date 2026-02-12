import { supabase } from '../config/supabase';

export interface BudgetAlert {
  id: string;
  user_id: string;
  budget_id: string;
  alert_type: 'warning' | 'exceeded' | 'expired' | 'renewed';
  threshold?: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

class AlertService {
  // Get all alerts for current user (unread + recent read)
  async getAlerts(unreadOnly: boolean = false): Promise<BudgetAlert[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    if (unreadOnly) {
      // Only unread
      const { data, error } = await supabase
        .from('budget_alerts')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    }

    // Unread + recent read (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('budget_alerts')
      .select('*')
      .eq('user_id', user.id)
      .or(`is_read.eq.false,created_at.gte.${sevenDaysAgo.toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(50); // Limit to 50 most recent

    if (error) throw error;
    return data || [];
  }

  // Get alert count (unread)
  async getUnreadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { count, error } = await supabase
      .from('budget_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
    return count || 0;
  }

  // Get count of read alerts (for "Clear All Read" button visibility)
  async getReadCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { count, error } = await supabase
      .from('budget_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', true);

    if (error) throw error;
    return count || 0;
  }

  // Create alert
  async createAlert(
    budgetId: string,
    alertType: BudgetAlert['alert_type'],
    message: string,
    threshold?: number
  ): Promise<BudgetAlert> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Check if similar alert already exists (avoid duplicates)
    const { data: existing } = await supabase
      .from('budget_alerts')
      .select('*')
      .eq('user_id', user.id)
      .eq('budget_id', budgetId)
      .eq('alert_type', alertType)
      .eq('is_read', false)
      .maybeSingle();

    if (existing) {
      console.log('Alert already exists, skipping duplicate');
      return existing;
    }

    const { data, error } = await supabase
      .from('budget_alerts')
      .insert({
        user_id: user.id,
        budget_id: budgetId,
        alert_type: alertType,
        message,
        threshold
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Mark alert as read
  async markAsRead(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('budget_alerts')
      .update({ is_read: true })
      .eq('id', alertId);

    if (error) throw error;
  }

  // Mark all alerts as read
  async markAllAsRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('budget_alerts')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) throw error;
  }

  // Delete alert
  async deleteAlert(alertId: string): Promise<void> {
    const { error } = await supabase
      .from('budget_alerts')
      .delete()
      .eq('id', alertId);

    if (error) throw error;
  }

  // Check budget and create alerts if needed
  async checkBudgetAndCreateAlerts(
    budgetId: string,
    budgetName: string,
    spent: number,
    amount: number,
    threshold: number = 80
  ): Promise<void> {
    const percentage = (spent / amount) * 100;

    // Budget exceeded (100% or more)
    if (percentage >= 100) {
      await this.createAlert(
        budgetId,
        'exceeded',
        `⚠️ Budget exceeded! You've spent ₹${spent.toLocaleString('en-IN')} out of ₹${amount.toLocaleString('en-IN')} for ${budgetName}.`,
        100
      );
    }
    // Warning threshold reached
    else if (percentage >= threshold) {
      await this.createAlert(
        budgetId,
        'warning',
        `⚠️ Budget warning! You've used ${percentage.toFixed(0)}% of your ${budgetName} budget (₹${spent.toLocaleString('en-IN')} / ₹${amount.toLocaleString('en-IN')}).`,
        threshold
      );
    }
  }

  // Auto-delete old read notifications (older than 30 days)
  async cleanupOldAlerts(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('budget_alerts')
      .delete()
      .eq('user_id', user.id)
      .eq('is_read', true)
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error cleaning up old alerts:', error);
    } else {
      console.log('Old read alerts cleaned up');
    }
  }

  // Clear all read notifications
  async clearAllRead(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('budget_alerts')
      .delete()
      .eq('user_id', user.id)
      .eq('is_read', true);

    if (error) throw error;
  }
}

export const alertService = new AlertService();
