import { supabase } from '../config/supabase';

export interface ReceivablePayable {
  id: string;
  user_id: string;
  type: 'receivable' | 'payable';
  title: string;
  description?: string;
  contact_name?: string;
  contact_phone?: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date?: string;
  status: 'pending' | 'partial' | 'completed' | 'overdue';
  category?: string;
  is_recurring: boolean;
  recurring_frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  recurring_day?: number;
  recurring_end_date?: string;
  last_generated_date?: string;
  parent_recurring_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentHistory {
  id: string;
  user_id: string;
  rp_id: string;
  amount: number;
  payment_date: string;
  notes?: string;
  created_at: string;
}

class ReceivablesPayablesService {

  // ─── GET ALL ───────────────────────────────────────────
  async getAll(): Promise<ReceivablePayable[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('receivables_payables')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
  }

  // ─── GET BY TYPE ───────────────────────────────────────
  async getByType(type: 'receivable' | 'payable'): Promise<ReceivablePayable[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('receivables_payables')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .order('due_date', { ascending: true, nullsFirst: false });

    if (error) throw error;
    return data || [];
  }

  // ─── GET RECURRING TEMPLATES ───────────────────────────
  async getRecurringTemplates(): Promise<ReceivablePayable[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('receivables_payables')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_recurring', true)
      .is('parent_recurring_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ─── CREATE ────────────────────────────────────────────
  async create(entry: Omit<ReceivablePayable, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<ReceivablePayable> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('receivables_payables')
      .insert([{
        ...entry,
        user_id: user.id,
        remaining_amount: entry.total_amount - entry.paid_amount
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── UPDATE ────────────────────────────────────────────
  async update(id: string, updates: Partial<ReceivablePayable>): Promise<ReceivablePayable> {
    const { data, error } = await supabase
      .from('receivables_payables')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── DELETE ────────────────────────────────────────────
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('receivables_payables')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ─── ADD PAYMENT ───────────────────────────────────────
  async addPayment(rpId: string, amount: number, paymentDate: string, notes?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: entry, error: fetchError } = await supabase
      .from('receivables_payables')
      .select('*')
      .eq('id', rpId)
      .single();

    if (fetchError) throw fetchError;

    const newPaidAmount = entry.paid_amount + amount;
    const newRemainingAmount = entry.total_amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'completed' : 'partial';

    const { error: paymentError } = await supabase
      .from('payment_history')
      .insert([{
        user_id: user.id,
        rp_id: rpId,
        amount,
        payment_date: paymentDate,
        notes
      }]);

    if (paymentError) throw paymentError;

    await this.update(rpId, {
      paid_amount: newPaidAmount,
      remaining_amount: newRemainingAmount,
      status: newStatus
    });
  }

  // ─── GET PAYMENT HISTORY ───────────────────────────────
  async getPaymentHistory(rpId: string): Promise<PaymentHistory[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('rp_id', rpId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ─── AUTO GENERATE RECURRING ENTRIES ──────────────────
  async generateRecurringEntries(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const templates = await this.getRecurringTemplates();

    for (const template of templates) {
      if (!template.recurring_frequency) continue;

      // Check if recurring end date has passed
      if (template.recurring_end_date) {
        const endDate = new Date(template.recurring_end_date);
        if (today > endDate) continue;
      }

      const lastGenerated = template.last_generated_date
        ? new Date(template.last_generated_date)
        : new Date(template.created_at);

      const nextDueDate = this.getNextDueDate(
        lastGenerated,
        template.recurring_frequency,
        template.recurring_day
      );

      // If next due date is today or in the past, generate new entry
      if (nextDueDate <= today) {
        await this.create({
          type: template.type,
          title: template.title,
          description: template.description,
          contact_name: template.contact_name,
          contact_phone: template.contact_phone,
          total_amount: template.total_amount,
          paid_amount: 0,
          remaining_amount: template.total_amount,
          due_date: nextDueDate.toISOString().split('T')[0],
          status: 'pending',
          category: template.category,
          is_recurring: false,
          parent_recurring_id: template.id
        });

        // Update last generated date
        await this.update(template.id, {
          last_generated_date: nextDueDate.toISOString().split('T')[0]
        });
      }
    }
  }

  // ─── GET NEXT DUE DATE ─────────────────────────────────
  private getNextDueDate(
    lastDate: Date,
    frequency: string,
    recurringDay?: number
  ): Date {
    const next = new Date(lastDate);

    switch (frequency) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        if (recurringDay) next.setDate(recurringDay);
        break;
      case 'quarterly':
        next.setMonth(next.getMonth() + 3);
        if (recurringDay) next.setDate(recurringDay);
        break;
      case 'yearly':
        next.setFullYear(next.getFullYear() + 1);
        break;
    }

    return next;
  }

  // ─── GET SUMMARY ───────────────────────────────────────
  async getSummary(): Promise<{
    totalReceivable: number;
    totalPayable: number;
    pendingReceivable: number;
    pendingPayable: number;
    overdueReceivable: number;
    overduePayable: number;
  }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('receivables_payables')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_recurring', false);

    if (error) throw error;

    const summary = {
      totalReceivable: 0,
      totalPayable: 0,
      pendingReceivable: 0,
      pendingPayable: 0,
      overdueReceivable: 0,
      overduePayable: 0
    };

    data?.forEach(entry => {
      if (entry.type === 'receivable') {
        summary.totalReceivable += entry.remaining_amount;
        if (entry.status !== 'completed') {
          summary.pendingReceivable += entry.remaining_amount;
        }
        if (entry.status === 'overdue') {
          summary.overdueReceivable += entry.remaining_amount;
        }
      } else {
        summary.totalPayable += entry.remaining_amount;
        if (entry.status !== 'completed') {
          summary.pendingPayable += entry.remaining_amount;
        }
        if (entry.status === 'overdue') {
          summary.overduePayable += entry.remaining_amount;
        }
      }
    });

    return summary;
  }

  // ─── UPDATE OVERDUE STATUS ─────────────────────────────
  async updateOverdueStatus(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('receivables_payables')
      .select('id, due_date, status')
      .eq('user_id', user.id)
      .neq('status', 'completed')
      .lt('due_date', today);

    if (error) throw error;

    if (data && data.length > 0) {
      for (const entry of data) {
        await this.update(entry.id, { status: 'overdue' });
      }
    }
  }
}

export const receivablesPayablesService = new ReceivablesPayablesService();
