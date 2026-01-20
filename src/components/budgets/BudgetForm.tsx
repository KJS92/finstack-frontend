import React, { useState, useEffect } from 'react';
import { budgetService, Budget, BudgetWithSpending } from '../../services/budgetService';
import { categoryService, Category } from '../../services/categoryService';
import './BudgetForm.css';

interface BudgetFormProps {
  budget: BudgetWithSpending | null;
  onClose: () => void;
}

const BudgetForm: React.FC<BudgetFormProps> = ({ budget, onClose }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    category_id: budget?.category_id || '',
    amount: budget?.amount || 0,
    period: budget?.period || 'monthly',
    start_date: budget?.start_date || new Date().toISOString().split('T')[0],
    end_date: budget?.end_date || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await categoryService.getCategories();
      console.log('Categories loaded:', data); // Debug
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('=== BUDGET FORM SUBMIT ===');
    console.log('Form data:', formData);

    try {
      if (!formData.category_id) {
        throw new Error('Please select a category');
      }

      if (formData.amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (new Date(formData.end_date) <= new Date(formData.start_date)) {
        throw new Error('End date must be after start date');
      }

      console.log('Validation passed, saving budget...');

      if (budget) {
        console.log('Updating budget:', budget.id);
        await budgetService.updateBudget(budget.id, formData);
      } else {
        console.log('Creating new budget');
        const result = await budgetService.createBudget(formData as any);
        console.log('Budget created successfully:', result);
      }

      alert('Budget saved successfully!');
      onClose();
    } catch (err: any) {
      console.error('Budget save error:', err);
      setError(err.message || 'Failed to save budget');
      alert('Error: ' + (err.message || 'Failed to save budget'));
    } finally {
      setLoading(false);
    }
  };

      const handlePeriodChange = (period: string) => {
      const now = new Date();
      let start_date: string;
      let end_date: string;
    
      if (period === 'monthly') {
        start_date = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end_date = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else if (period === 'yearly') {
        start_date = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end_date = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
      } else if (period === 'quarterly') {
        const quarter = Math.floor(now.getMonth() / 3);
        start_date = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        end_date = new Date(now.getFullYear(), (quarter + 1) * 3, 0).toISOString().split('T')[0];
      } else if (period === 'custom') {
        // For custom, keep existing dates or use current month as default
        start_date = formData.start_date || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end_date = formData.end_date || new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      } else {
        // Fallback
        start_date = formData.start_date;
        end_date = formData.end_date;
      }
    
      setFormData(prev => ({ ...prev, period, start_date, end_date }));
    };


  return (
    <div className="budget-form-overlay" onClick={onClose}>
      <div className="budget-form-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="budget-form-header">
          <h2>{budget ? 'Edit Budget' : 'Create Budget'}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="budget-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {/* Category */}
          <div className="form-group">
            <label>Category *</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div className="form-group">
            <label>Budget Amount (₹) *</label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              placeholder="5000"
              min="0"
              step="1"
              required
            />
          </div>

          {/* Period */}
          <div className="form-group">
            <label>Period *</label>
            <select
              value={formData.period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              required
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="form-row">
            <div className="form-group">
              <label>Start Date *</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>End Date *</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="btn-submit">
              {loading ? 'Saving...' : budget ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetForm;
