import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { budgetService, BudgetWithSpending } from '../services/budgetService';
import { supabase } from '../config/supabase';
import BudgetForm from '../components/budgets/BudgetForm';
import './Budgets.css';

const Budgets: React.FC = () => {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [summary, setSummary] = useState({ totalBudget: 0, totalSpent: 0, totalRemaining: 0 });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    checkUser();
    loadBudgets();
    checkExpiredBudgets();
  }, []);

  const [editingBudget, setEditingBudget] = useState<BudgetWithSpending | null>(null);

  const handleEdit = (budget: BudgetWithSpending) => {
  setEditingBudget(budget);
  setShowForm(true);
};

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    } else {
      setUserEmail(session.user.email || '');
    }
  };

  const handleRenew = async (budget: BudgetWithSpending) => {
  if (window.confirm(`Renew budget for ${budget.category_name}? This will create a new budget for the next period.`)) {
    try {
      await budgetService.renewBudget(budget);
      alert('Budget renewed successfully!');
      loadBudgets();
    } catch (error: any) {
      console.error('Error renewing budget:', error);
      alert('Error: ' + error.message);
    }
  }
};

  const handleReset = async (budget: BudgetWithSpending) => {
    if (window.confirm(`Reset budget for ${budget.category_name}? This will clear rollover amounts and start fresh.`)) {
      try {
        await budgetService.resetBudget(budget.id);
        alert('Budget reset successfully!');
        loadBudgets();
      } catch (error: any) {
        console.error('Error resetting budget:', error);
        alert('Error: ' + error.message);
      }
    }
  };

  const loadBudgets = async () => {
    try {
      setLoading(true);
      console.log('Loading budgets...'); // Debug
      const [budgetsData, summaryData] = await Promise.all([
        budgetService.getBudgetsWithSpending(),
        budgetService.getCurrentMonthSummary()
      ]);
      console.log('Budgets loaded:', budgetsData); // Debug
      console.log('Summary:', summaryData); // Debug
      setBudgets(budgetsData);
      setSummary(summaryData);
    } catch (error) {
      console.error('Error loading budgets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this budget?')) {
      try {
        await budgetService.deleteBudget(id);
        loadBudgets();
      } catch (error) {
        console.error('Error deleting budget:', error);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const overallPercentage = summary.totalBudget > 0 
    ? (summary.totalSpent / summary.totalBudget) * 100 
    : 0;

  if (loading) {
    return <div className="dashboard-container"><p>Loading budgets...</p></div>;
  }

  return (
    <div className="dashboard-container">
      {/* Header - matching Dashboard style */}
      <header className="dashboard-header">
        <div>
          <h1>Budgets</h1>
          <p className="user-email">{userEmail}</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate('/add-transaction')} className="btn-primary">
            Add Transaction
          </button>
          <button onClick={() => navigate('/transactions')} className="btn-primary">
            Upload Transactions
          </button>
          <button onClick={() => navigate('/budgets')} className="btn-secondary active">
            Budgets
          </button>
          <button onClick={() => navigate('/categories')} className="btn-secondary">
            Categories
          </button>
          <button onClick={() => navigate('/profile')} className="btn-secondary">
            Profile
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Dashboard
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="dashboard-summary">
        <div className="summary-card">
          <h3>Total Budget</h3>
          <p className="amount">{formatCurrency(summary.totalBudget)}</p>
        </div>
        <div className="summary-card">
          <h3>Total Spent</h3>
          <p className="amount spent">{formatCurrency(summary.totalSpent)}</p>
          <p className="percentage">{overallPercentage.toFixed(1)}% of budget</p>
        </div>
        <div className="summary-card">
          <h3>Remaining</h3>
          <p className="amount remaining">{formatCurrency(summary.totalRemaining)}</p>
        </div>
      </div>

      {/* Budgets Section */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2>Your Budgets</h2>
          <button onClick={() => setShowForm(true)} className="btn-link">
            + Create Budget
          </button>
        </div>
        
        {budgets.length === 0 ? (
          <div className="empty-state">
            <p>No budgets yet</p>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Create Your First Budget
            </button>
          </div>
        ) : (
          <div className="budgets-grid">
            {{budgets.map((budget) => {
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
                      {budget.rollover_amount > 0 && (
                        <p className="rollover-tag">
                          +₹{budget.rollover_amount.toLocaleString('en-IN')} rolled over
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="budget-actions">
                    {isExpired && budget.auto_renew && (
                      <span className="auto-renew-badge">Auto-renew enabled</span>
                    )}
                    <button onClick={() => handleEdit(budget)} className="btn-edit" title="Edit">
                      ✏️
                    </button>
                    <button onClick={() => handleDelete(budget.id)} className="btn-delete" title="Delete">
                      🗑️
                    </button>
                  </div>
                </div>
          
                <div className="budget-progress">
                  <div className="progress-info">
                    <span>Spent</span>
                    <span className={isOverBudget ? 'over-budget' : ''}>
                      {formatCurrency(budget.spent)} / {formatCurrency(effectiveAmount)}
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className={`progress-fill ${isOverBudget ? 'over' : isWarning ? 'warning' : 'safe'}`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>
                  <div className="progress-footer">
                    <span>{budget.percentage.toFixed(1)}%</span>
                    {isOverBudget && (
                      <span className="alert">Over by {formatCurrency(budget.spent - effectiveAmount)}</span>
                    )}
                    {isWarning && <span className="warning-text">Approaching limit</span>}
                  </div>
                </div>
          
                <div className="budget-footer">
                  <div className="footer-row">
                    <span>Remaining</span>
                    <span className={budget.remaining >= 0 ? 'positive' : 'negative'}>
                      {formatCurrency(budget.remaining)}
                    </span>
                  </div>
                  <div className="footer-dates">
                    <span>{new Date(budget.start_date).toLocaleDateString('en-IN')}</span>
                    <span>to</span>
                    <span>{new Date(budget.end_date).toLocaleDateString('en-IN')}</span>
                    {isExpired && <span className="expired-label">Expired</span>}
                  </div>
                  
                  {/* Action buttons for expired budgets */}
                  {isExpired && (
                    <div className="budget-quick-actions">
                      <button onClick={() => handleRenew(budget)} className="btn-renew">
                        🔄 Renew for Next Period
                      </button>
                      <button onClick={() => handleReset(budget)} className="btn-reset">
                        ↻ Reset Budget
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* Budget Form Modal */}
{/* Budget Form Modal */}
{showForm && <BudgetForm 
budget={editingBudget} 
  onClose={() => { 
    setShowForm(false); 
    setEditingBudget(null);
    loadBudgets(); 
  }} 
/>}
    </div>
  );
};

export default Budgets;
