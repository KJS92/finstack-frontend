import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetService, BudgetWithSpending } from '../services/budgetService';
import { supabase } from '../config/supabase';
import BudgetForm from '../components/budgets/BudgetForm';
import './Budgets.css';
import { alertService } from '../services/alertService';
import AppHeader from '../components/layout/AppHeader';
import { theme } from '../theme';
import { Plus, Wallet, TrendingDown, BarChart2, Edit, Trash2, RefreshCw, RotateCcw, AlertTriangle, AlertCircle, Package } from 'lucide-react';

const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [summary, setSummary] = useState({ totalBudget: 0, totalSpent: 0, totalRemaining: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [editingBudget, setEditingBudget] = useState<BudgetWithSpending | null>(null);
  const [showExpired, setShowExpired] = useState(false);
  const [error, setError] = useState('');
  // Inline confirm state: 'delete:<id>' | 'renew:<id>' | 'reset:<id>' | null
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const loadBudgets = useCallback(async () => {
    try {
      setLoading(true);
      const [budgetsData, summaryData] = await Promise.all([
        budgetService.getBudgetsWithSpending(),
        budgetService.getCurrentMonthSummary(),
      ]);
      setBudgets(budgetsData);
      setSummary(summaryData);
      await checkBudgetsAndCreateAlerts(budgetsData);
      await budgetService.checkExpiredBudgets();
    } catch (err) {
      console.error('Error loading budgets:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setUserEmail(user.email || '');
      setDisplayName(user.user_metadata?.full_name || user.email?.split('@')[0] || '');
      await budgetService.checkAndRenewBudgets().catch(console.error);
      await loadBudgets();
    };
    init();
  }, [navigate, loadBudgets]);

  // Dismiss inline confirm on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirmAction(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleEdit = (budget: BudgetWithSpending) => { setEditingBudget(budget); setShowForm(true); };

  const checkBudgetsAndCreateAlerts = async (items: BudgetWithSpending[]) => {
    try {
      for (const budget of items) {
        if (budget.category_name) {
          await alertService.checkBudgetAndCreateAlerts(
            budget.id, budget.category_name, budget.spent, budget.amount, budget.alert_threshold || 80,
          );
        }
      }
    } catch (err) { console.error('Error checking budget alerts:', err); }
  };

  const handleRenew = async (budget: BudgetWithSpending) => {
    const key = `renew:${budget.id}`;
    if (confirmAction !== key) { setConfirmAction(key); return; }
    setConfirmAction(null);
    try {
      await budgetService.renewBudget(budget);
      await loadBudgets();
    } catch (err: any) { setError(err.message); }
  };

  const handleReset = async (budget: BudgetWithSpending) => {
    const key = `reset:${budget.id}`;
    if (confirmAction !== key) { setConfirmAction(key); return; }
    setConfirmAction(null);
    try {
      await budgetService.resetBudget(budget.id);
      await loadBudgets();
    } catch (err: any) { setError(err.message); }
  };

  const handleDelete = async (id: string) => {
    const key = `delete:${id}`;
    if (confirmAction !== key) { setConfirmAction(key); return; }
    setConfirmAction(null);
    try {
      await budgetService.deleteBudget(id);
      await loadBudgets();
    } catch (err: any) { setError(err.message); }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);

  const overallPercentage = summary.totalBudget > 0 ? (summary.totalSpent / summary.totalBudget) * 100 : 0;
  const activeBudgets = budgets.filter(b => new Date(b.end_date) >= new Date());
  const expiredBudgets = budgets.filter(b => new Date(b.end_date) < new Date());
  const visibleBudgets = showExpired ? budgets : activeBudgets;

  if (loading) return <div className="dashboard-container"><p>Loading budgets...</p></div>;

  return (
    <div className="dashboard-container" style={{ fontFamily: theme.fontFamily }}>
      <AppHeader title="Budgets" userEmail={userEmail} displayName={displayName} activePage="budgets" />

      {error && (
        <div style={{ maxWidth: '900px', margin: '16px auto 0', padding: '0 16px' }}>
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', fontSize: '14px' }} role="alert">
            {error}
            <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700 }}>✕</button>
          </div>
        </div>
      )}

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
                  borderRadius: '20px', cursor: 'pointer', fontFamily: theme.fontFamily,
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
              fontFamily: theme.fontFamily,
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
            <button onClick={() => setShowForm(true)} style={{ padding: '10px 24px', background: theme.colors.primary, color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontFamily: theme.fontFamily }}>Create Your First Budget</button>
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
                      {budget.category_icon
                        ? <span className="budget-icon">{budget.category_icon}</span>
                        : <Package size={18} color={theme.colors.textMuted} style={{ flexShrink: 0 }} />}
                      <div>
                        <h4>{budget.category_name || 'General Budget'}</h4>
                        <p className="budget-period">{budget.period || 'Monthly'}</p>
                        <div className="budget-features">
                          {budget.rollover_enabled && (
                            <span className="feature-badge rollover" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RefreshCw size={10} /> Roll-over
                            </span>
                          )}
                          {budget.auto_renew && (
                            <span className="feature-badge auto-renew" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <RotateCcw size={10} /> Auto-renew
                            </span>
                          )}
                          {isExpired && (
                            <span className="feature-badge expired" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={10} /> Expired
                            </span>
                          )}
                          {isOverBudget && (
                            <span className="feature-badge alert-exceeded" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertCircle size={10} /> Over Budget
                            </span>
                          )}
                          {isWarning && !isOverBudget && (
                            <span className="feature-badge alert-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <AlertTriangle size={10} /> Alert: {budget.alert_threshold}%
                            </span>
                          )}
                        </div>
                        {(budget.rollover_amount ?? 0) > 0 && <p className="rollover-amount">+{formatCurrency(budget.rollover_amount!)} from previous period</p>}
                      </div>
                    </div>
                    <div className="budget-actions">
                      <button onClick={() => handleEdit(budget)} className="btn-edit" title="Edit" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Edit size={14} />
                      </button>
                      {confirmAction === `delete:${budget.id}` ? (
                        <div className="confirm-delete">
                          <span>Delete?</span>
                          <button onClick={() => handleDelete(budget.id)} className="btn-confirm-yes">Yes</button>
                          <button onClick={() => setConfirmAction(null)} className="btn-confirm-no">No</button>
                        </div>
                      ) : (
                        <button onClick={() => handleDelete(budget.id)} className="btn-delete" title="Delete" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
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
                        {confirmAction === `renew:${budget.id}` ? (
                          <div className="confirm-delete">
                            <span>Renew?</span>
                            <button onClick={() => handleRenew(budget)} className="btn-confirm-yes">Yes</button>
                            <button onClick={() => setConfirmAction(null)} className="btn-confirm-no">No</button>
                          </div>
                        ) : (
                          <button onClick={() => handleRenew(budget)} className="btn-renew" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <RefreshCw size={13} /> Renew for Next Period
                          </button>
                        )}
                        {confirmAction === `reset:${budget.id}` ? (
                          <div className="confirm-delete">
                            <span>Reset?</span>
                            <button onClick={() => handleReset(budget)} className="btn-confirm-yes">Yes</button>
                            <button onClick={() => setConfirmAction(null)} className="btn-confirm-no">No</button>
                          </div>
                        ) : (
                          <button onClick={() => handleReset(budget)} className="btn-reset" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <RotateCcw size={13} /> Reset Budget
                          </button>
                        )}
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
