import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { transactionService, Transaction } from '../services/transactionService';
import { categoryService, Category } from '../services/categoryService';
import './EditTransactionModal.css';

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    transaction_date: transaction.transaction_date,
    description: transaction.description,
    // Store amount as string during editing to allow '0.', '' etc without NaN
    amount: transaction.amount.toString(),
    transaction_type: transaction.transaction_type,
    category_id: transaction.category_id || '',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  // Close on Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const loadCategories = async () => {
    try {
      const data = await categoryService.getCategories();
      setCategories(data);
    } catch (err: any) {
      console.error('Error loading categories:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(formData.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await transactionService.updateTransaction(transaction.id, {
        transaction_date: formData.transaction_date,
        description: formData.description,
        amount: parsedAmount,
        transaction_type: formData.transaction_type,
        category_id: formData.category_id || null,
      });
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Always reset loading — whether save succeeded or failed
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="edit-modal-title">Edit Transaction</h2>
          <button onClick={onClose} className="modal-close" aria-label="Close edit modal">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="error-message" role="alert">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label htmlFor="edit-date">Date</label>
            <input
              id="edit-date"
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-description">Description</label>
            <input
              id="edit-description"
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-amount">Amount (&#8377;)</label>
            <input
              id="edit-amount"
              type="number"
              step="0.01"
              min="0.01"
              // Keep as string in state — parse only on submit to avoid NaN mid-typing
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-type">Type</label>
            <select
              id="edit-type"
              value={formData.transaction_type}
              onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value as 'debit' | 'credit' })}
              required
            >
              <option value="debit">Debit (Expense)</option>
              <option value="credit">Credit (Income)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="edit-category">Category</label>
            <select
              id="edit-category"
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            >
              <option value="">-- Select Category --</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.icon} {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTransactionModal;
