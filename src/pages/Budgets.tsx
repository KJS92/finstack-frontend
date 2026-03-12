import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetService, BudgetWithSpending } from '../services/budgetService';
import { supabase } from '../config/supabase';
import BudgetForm from '../components/budgets/BudgetForm';
import './Budgets.css';
import { alertService } from '../services/alertService';
import AppHeader from '../components/layout/AppHeader';
import { theme } from '../theme';
import { Plus, Wallet, TrendingDown, BarChart2 } from 'lucide-react';

const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [summary, setSummary] = useState({ totalBudget: 0, totalSpent: 0, totalRemaining: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpending | null>(null);
  const [showExpired, setShowExpired] = useState(false);

  useEffect(() => { checkUser(); loadBudgets(); checkExpiredBudgets(); }, []);

  const handleEdit = (budget: BudgetWithSpending) => { setEditingBudget(budget); setShowForm(true); };

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate('/auth');
    else setUserEmail(session.user.email || '');
  };

  const handleRenew = async (budget: BudgetWithSpending) => {
    if (window.confirm(`Renew budget for ${budget.category_name}? This will create a new budget for the next period.`)) {
      try { await budgetService.renewBudget(budget); loadBudgets(); }
      catch (error: any) { alert('Error: ' + error.message); }
    }
  };

  const handleReset = async (budget: BudgetWithSpending) => {
    if (window.confirm(`Reset budget for ${budget.category_name}? This will clear rollover amounts and start fresh.`)) {
      try { await budgetService.resetBudget(budget.id); loadBudgets(); }
      catch (error: any) { alert('Error: ' + error.message); }
    }
  };

  const checkExpiredBudgets = async () => {
    try { await budgetService.checkAndRenewBudgets(); } catch (error) { console.error(error); }
  };

  const loadBudgets = async () => {
    try {
      setLoading(true);
      const [budgetsData, summaryData] = await Promise.all([
        budgetService.getBudgetsWithSpending(),
        budgetService.getCurrentMonthSummary()
      ]);
      setBudgets(budgetsData);
      setSummary(summaryData);
      await checkBudgetsAndCreateAlerts(budgetsData);
      await budgetService.checkExpiredBudgets();
    } catch (error) { console.error('Error loading budgets:', error); }
    finally { setLoading(false); }
  };

  const checkBudgetsAndCreateAlerts = async (budgets: BudgetWithSpending[]) => {
    try {
      for (const budget of budgets) {
        if (budget.category_name) {
          await alertService.checkBudgetAndCreateAlerts(budget.id, budget.category_name, budget.spent, budget.amount, budget.alert_threshold || 80);
        }
      }
    } catch (error) { console.error('Error checking budget alerts:', error); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      try { await budgetService.deleteBudget(id); loadBudgets(); }
      catch (error) { console.error('Error deleting budget:', error); }
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const overallPercentage = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0;

  const activeBudgets = budgets.filter(b => new Date(b.end_date) >= new Date());
  const expiredBudgets = budgets.filter(b => new Date(b.end_date) < new Date());
  const visibleBudgets = showExpired ? budgets : activeBudgets;

  if (loading) return <div className="dashboard-container"><p>Loading budgets...</p></div>;

  return (
    <div className="dashboard-container" style={{ fontFamily: 'Inter, sans-serif' }}>
      <AppHeader title="Budgets" userEmail={userEmail} activePage="budgets" />

      {/* Unified Summary Card */}
      <div style={{ maxWidth: '900px', margin: '24px auto 0', padding: '0 16px' }}>
        <div style={{
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)', padding: '20px 24px',
          display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          gap: '0', marginBottom: '24px',
        }}>
          {[
            { label: 'TOTAL BUDGET', value: summary.totalBudget, sub: `${budgets.length} active budgets`, color: theme.colors.textPrimary, Icon: Wallet, iconColor: theme.colors.primary },
            { label: 'TOTAL SPENT', value: summary.totalSpent, sub: `${overallPercentage.toFixed(1)}% of budget`, color: '#dc2626', Icon: TrendingDown, iconColor: '#dc2626' },
            { label: 'REMAINING', value: summary.totalRemaining, sub: `${budgets.filter(b => b.rollover_enabled).length} with roll-over • ${budgets.filter(b => b.auto_renew).length} auto-renew`, color: '#16a34a', Icon: BarChart2, iconColor: '#16a34a' },
          ].map(({ label, value, sub, color, Icon, iconColor }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div style={{ width: '1px', background: '#e5e7eb', margin: '0 24px' }} />}
              <div style={{ textAlign: 'center', padding: '4px 8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
                  <Icon size={14} color={iconColor} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af', letterSpacing: '0.5px' }}>{label}</span>
                </div>
                <div style={{ fontSize: '22px', fontWeight: 700, color, marginBottom: '4px' }}>{formatCurrency(value)}</div>
                <div style={{ fontSize: '11px', color: '#9ca3af' }}>{sub}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: theme.colors.textPrimary }}>Your Budgets</h2>
            {expiredBudgets.length > 0 && (
              <button
                onClick={() => setShowExpired(s => !s)}
                style={{
                  padding: '4px 12px', fontSize: '12px', fontWeight: 600,
                  background: showExpired ? '#fef3c7' : '#f3f4f6',
                  color: showExpired ? '#92400e' : '#6b7280',
                  border: `1px solid ${showExpired ? '#fde68a' : '#e5e7eb'}`,
                  borderRadius: '20px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                }}
              >
                {showExpired ? `Hide Expired (${expiredBudgets.length})` : `Show Expired (${expiredBudgets.length})`}
              </button>
            )}
          </div>
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '9px 18px', background: theme.colors.primary,
              color: '#fff', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <Plus size={16} /> Create Budget
          </button>
        </div>
      </div>

      {/* Budgets Grid */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 16px 80px' }}>
        {visibleBudgets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
            <p style={{ color: '#9ca3af', marginBottom: '16px' }}>{showExpired ? 'No budgets found' : 'No active budgets'}</p>
            <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>Create Your First Budget</button>
          </div>
        ) : (
          <div className="budgets-grid">
            {visibleBudgets.map(budget => {
              const isOverBudget = budget.spent > budget.amount;
              const isWarning = budget.percentage >= 80 && !isOverBudget;
              const isExpired = new Date(budget.end_date) < new Date();
              const effectiveAmount = budget.amount + (budget.rollover_amount || 0);

              return (
                <div key={budget.id} className={`budget-card ${isExpired ? 'expired' : ''}`}>
                  <div className="budget-header">
                    <div className="budget-title">
                      <span className="budget-icon">{budget.category_icon || '📊'}</span>
                      <div>
                        <h4>{budget.category_name || 'General Budget'}</h4>
                        <p className="budget-period">{budget.period || 'Monthly'}</p>
                        <div className="budget-features">
                          {budget.rollover_enabled && <span className="feature-badge rollover">🔄 Roll-over</span>}
                          {budget.auto_renew && <span className="feature-badge auto-renew">♻️ Auto-renew</span>}
                          {isExpired && <span className="feature-badge expired">⚠️ Expired</span>}
                          {isOverBudget && <span className="feature-badge alert-exceeded">🚨 Over Budget</span>}
                          {isWarning && !isOverBudget && <span className="feature-badge alert-warning">⚠️ Alert: {budget.alert_threshold}%</span>}
                        </div>
                        {(budget.rollover_amount ?? 0) > 0 && <p className="rollover-amount">+{formatCurrency(budget.rollover_amount!)} from previous period</p>}
                      </div>
                    </div>
                    <div className="budget-actions">
                      <button onClick={() => handleEdit(budget)} className="btn-edit" title="Edit">✏️</button>
                      <button onClick={() => handleDelete(budget.id)} className="btn-delete" title="Delete">🗑️</button>
                    </div>
                  </div>

                  <div className="budget-progress">
                    <div className="progress-info">
                      <span>Spent</span>
                      <span className={isOverBudget ? 'over-budget' : ''}>{formatCurrency(budget.spent)} / {formatCurrency(effectiveAmount)}</span>
                    </div>
                    <div className="progress-bar">
                      <div className={`progress-fill ${isOverBudget ? 'over' : isWarning ? 'warning' : 'safe'}`} style={{ width: `${Math.min(budget.percentage, 100)}%` }} />
                    </div>
                    <div className="progress-footer">
                      <span>{budget.percentage.toFixed(1)}%</span>
                      {isOverBudget && <span className="alert">Over by {formatCurrency(budget.spent - effectiveAmount)}</span>}
                      {isWarning && <span className="warning-text">Approaching limit</span>}
                    </div>
                  </div>

                  <div className="budget-footer">
                    <div className="footer-row">
                      <span>Remaining</span>
                      <span className={budget.remaining >= 0 ? 'positive' : 'negative'}>{formatCurrency(budget.remaining)}</span>
                    </div>
                    <div className="footer-dates">
                      <span>{new Date(budget.start_date).toLocaleDateString('en-IN')}</span>
                      <span>to</span>
                      <span>{new Date(budget.end_date).toLocaleDateString('en-IN')}</span>
                      {isExpired && <span className="expired-label">Expired</span>}
                    </div>
                    {isExpired && (
                      <div className="budget-quick-actions">
                        <button onClick={() => handleRenew(budget)} className="btn-renew">🔄 Renew for Next Period</button>
                        <button onClick={() => handleReset(budget)} className="btn-reset">↻ Reset Budget</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showForm && <BudgetForm budget={editingBudget} onClose={() => { setShowForm(false); setEditingBudget(null); loadBudgets(); }} />}
    </div>
  );
};

export default Budgets;
