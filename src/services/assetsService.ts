import { supabase } from '../config/supabase';

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  type: 'investment' | 'insurance';
  category:
    | 'fd' | 'sip' | 'stocks' | 'mutual_fund' | 'ppf' | 'nps'
    | 'gold' | 'real_estate' | 'other_investment'
    | 'life_insurance' | 'health_insurance' | 'vehicle_insurance'
    | 'term_insurance' | 'other_insurance';
  current_value: number;
  invested_amount?: number;
  purchase_date?: string;
  maturity_date?: string;
  interest_rate?: number;
  notes?: string;
  institution_name?: string;
  policy_number?: string;
  is_active: boolean;
  reminder_days: number;
  created_at: string;
  updated_at: string;
}

export interface AssetSummary {
  totalInvestments: number;
  totalInsurance: number;
  totalBankBalance: number;
  totalReceivables: number;
  totalPayables: number;
  totalAssets: number;
  totalLiabilities: number;
  totalNetWorth: number;
  totalGainLoss: number;
  upcomingMaturities: Asset[];
}

class AssetsService {

  // ─── GET ALL ───────────────────────────────────────────
  async getAll(): Promise<Asset[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ─── GET BY TYPE ───────────────────────────────────────
  async getByType(type: 'investment' | 'insurance'): Promise<Asset[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // ─── CREATE ────────────────────────────────────────────
  async create(asset: Omit<Asset, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Asset> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('assets')
      .insert([{ ...asset, user_id: user.id }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── UPDATE ────────────────────────────────────────────
  async update(id: string, updates: Partial<Asset>): Promise<Asset> {
    const { data, error } = await supabase
      .from('assets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // ─── DELETE (soft delete) ──────────────────────────────
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('assets')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }

  // ─── GET SUMMARY ───────────────────────────────────────
  async getSummary(): Promise<AssetSummary> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Fetch all data in parallel
  const [assetsResult, accountsResult, rpResult] = await Promise.all([
    supabase
      .from('assets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true),

    supabase
      .from('accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true),

    supabase
      .from('receivables_payables')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'completed')
      .eq('is_recurring', false)
  ]);

  if (assetsResult.error) throw assetsResult.error;
  if (accountsResult.error) throw accountsResult.error;
  if (rpResult.error) throw rpResult.error;

  const today = new Date();
  const reminderDate = new Date();
  reminderDate.setDate(today.getDate() + 30);

  const summary: AssetSummary = {
    totalInvestments: 0,
    totalInsurance: 0,
    totalBankBalance: 0,
    totalReceivables: 0,
    totalPayables: 0,
    totalAssets: 0,
    totalLiabilities: 0,
    totalNetWorth: 0,
    totalGainLoss: 0,
    upcomingMaturities: []
  };

  // ── Assets (Investments & Insurance) ──────────────────
  assetsResult.data?.forEach(asset => {
    if (asset.type === 'investment') {
      summary.totalInvestments += asset.current_value;
      if (asset.invested_amount) {
        summary.totalGainLoss += asset.current_value - asset.invested_amount;
      }
    } else {
      summary.totalInsurance += asset.current_value;
    }

    // Upcoming maturities within 30 days
    if (asset.maturity_date) {
      const maturityDate = new Date(asset.maturity_date);
      if (maturityDate >= today && maturityDate <= reminderDate) {
        summary.upcomingMaturities.push(asset);
      }
    }
  });

  // ── Bank Balances ──────────────────────────────────────
  accountsResult.data?.forEach(account => {
  if (account.type === 'credit_card') {
    // Credit card balance is always a liability (stored as positive)
    summary.totalLiabilities += account.balance || 0;
  } else {
    // Savings, bank, wallet, UPI = assets
    summary.totalBankBalance += account.balance || 0;
  }
});

  // ── Receivables & Payables ─────────────────────────────
  rpResult.data?.forEach(entry => {
    if (entry.type === 'receivable') {
      summary.totalReceivables += entry.remaining_amount;
    } else {
      summary.totalPayables += entry.remaining_amount;
    }
  });

  // ── Final Calculations ─────────────────────────────────
  summary.totalAssets =
    summary.totalInvestments +
    summary.totalInsurance +
    summary.totalBankBalance +
    summary.totalReceivables;

  summary.totalLiabilities += summary.totalPayables;

  summary.totalNetWorth = summary.totalAssets - summary.totalLiabilities;

  return summary;
}
  
  // ─── GET CATEGORY LABEL ────────────────────────────────
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      fd: 'Fixed Deposit',
      sip: 'SIP / Mutual Fund',
      stocks: 'Stocks',
      mutual_fund: 'Mutual Fund',
      ppf: 'PPF',
      nps: 'NPS',
      gold: 'Gold',
      real_estate: 'Real Estate',
      other_investment: 'Other Investment',
      life_insurance: 'Life Insurance',
      health_insurance: 'Health Insurance',
      vehicle_insurance: 'Vehicle Insurance',
      term_insurance: 'Term Insurance',
      other_insurance: 'Other Insurance'
    };
    return labels[category] || category;
  }

  // ─── GET CATEGORY ICON ─────────────────────────────────
  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      fd: '🏦',
      sip: '📈',
      stocks: '📊',
      mutual_fund: '💹',
      ppf: '🏛️',
      nps: '👴',
      gold: '🥇',
      real_estate: '🏠',
      other_investment: '💰',
      life_insurance: '❤️',
      health_insurance: '🏥',
      vehicle_insurance: '🚗',
      term_insurance: '🛡️',
      other_insurance: '📋'
    };
    return icons[category] || '💼';
  }
}

export const assetsService = new AssetsService();
