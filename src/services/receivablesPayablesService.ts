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
  // Get all receivables and payables
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

  // Get by type
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

  // Create new entry
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

  // Update entry
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

  // Delete entry
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('receivables_payables')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Add payment
  async addPayment(rpId: string, amount: number, paymentDate: string, notes?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Get current entry
    const { data: entry, error: fetchError } = await supabase
      .from('receivables_payables')
      .select('*')
      .eq('id', rpId)
      .single();

    if (fetchError) throw fetchError;

    const newPaidAmount = entry.paid_amount + amount;
    const newRemainingAmount = entry.total_amount - newPaidAmount;
    const newStatus = newRemainingAmount <= 0 ? 'completed' : 'partial';

    // Add payment history
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

    // Update entry
    await this.update(rpId, {
      paid_amount: newPaidAmount,
      remaining_amount: newRemainingAmount,
      status: newStatus
    });
  }

  // Get payment history for an entry
  async getPaymentHistory(rpId: string): Promise<PaymentHistory[]> {
    const { data, error } = await supabase
      .from('payment_history')
      .select('*')
      .eq('rp_id', rpId)
      .order('payment_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Get summary
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
      .eq('user_id', user.id);

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

  // Update overdue status
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

    // Update each overdue entry
    if (data && data.length > 0) {
      for (const entry of data) {
        await this.update(entry.id, { status: 'overdue' });
      }
    }
  }
}

export const receivablesPayablesService = new ReceivablesPayablesService();
