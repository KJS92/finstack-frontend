import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { budgetService, Budget, BudgetWithSpending } from '../../services/budgetService';
import { categoryService, Category } from '../../services/categoryService';

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
      setCategories(data);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

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

      if (budget) {
        await budgetService.updateBudget(budget.id, formData);
      } else {
        await budgetService.createBudget(formData as any);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save budget');
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
    } else {
      return;
    }

    setFormData(prev => ({ ...prev, period, start_date, end_date }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {budget ? 'Edit Budget' : 'Create Budget'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget Amount (₹) *
            </label>
            <input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="5000"
              min="0"
              step="0.01"
              required
            />
          </div>

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Period *
            </label>
            <select
              value={formData.period}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="custom">Custom</option>
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : budget ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BudgetForm;
