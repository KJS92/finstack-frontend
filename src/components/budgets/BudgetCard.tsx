import React from 'react';
import { BudgetWithSpending } from '../../services/budgetService';
import { Edit2, Trash2, AlertCircle } from 'lucide-react';

interface BudgetCardProps {
  budget: BudgetWithSpending;
  onEdit: (budget: BudgetWithSpending) => void;
  onDelete: (id: string) => void;
}

const BudgetCard: React.FC<BudgetCardProps> = ({ budget, onEdit, onDelete }) => {
  const isOverBudget = budget.spent > budget.amount;
  const isWarning = budget.percentage >= 80 && !isOverBudget;

  const getProgressColor = () => {
    if (isOverBudget) return 'bg-red-600';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-green-600';
  };

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {budget.category_icon && (
            <span className="text-2xl">{budget.category_icon}</span>
          )}
          <div>
            <h3 className="font-semibold text-gray-900">
              {budget.category_name || 'General Budget'}
            </h3>
            <p className="text-sm text-gray-500">{budget.period || 'Monthly'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(budget)}
            className="p-1 text-gray-400 hover:text-blue-600 transition"
          >
            <Edit2 size={18} />
          </button>
          <button
            onClick={() => onDelete(budget.id)}
            className="p-1 text-gray-400 hover:text-red-600 transition"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Spent</span>
          <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-900'}`}>
            ₹{budget.spent.toLocaleString('en-IN')} / ₹{budget.amount.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${getProgressColor()}`}
            style={{ width: `${Math.min(budget.percentage, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-gray-500">{budget.percentage.toFixed(1)}%</span>
          {isOverBudget && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertCircle size={14} />
              Over by ₹{(budget.spent - budget.amount).toLocaleString('en-IN')}
            </span>
          )}
          {isWarning && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
              <AlertCircle size={14} />
              Approaching limit
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-4 border-t border-gray-100">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Remaining</span>
          <span className={`font-semibold ${budget.remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ₹{budget.remaining.toLocaleString('en-IN')}
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{new Date(budget.start_date).toLocaleDateString('en-IN')}</span>
          <span>to {new Date(budget.end_date).toLocaleDateString('en-IN')}</span>
        </div>
      </div>
    </div>
  );
};

export default BudgetCard;

