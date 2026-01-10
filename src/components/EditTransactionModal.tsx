import React, { useState, useEffect } from 'react';
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
    amount: transaction.amount,
    transaction_type: transaction.transaction_type,
    category_id: transaction.category_id || ''
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

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
    setLoading(true);
    setError('');

    try {
      await transactionService.updateTransaction(transaction.id, {
        transaction_date: formData.transaction_date,
        description: formData.description,
        amount: parseFloat(formData.amount.toString()),
        transaction_type: formData.transaction_type,
        category_id: formData.category_id || null
      });
      onSave();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Transaction</h2>
          <button onClick={onClose} className="modal-close">&times;</button>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
              required
            />
          </div>

          <div className="form-group">
            <label>Type</label>
            <select
              value={formData.transaction_type}
              onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value as 'debit' | 'credit' })}
              required
            >
              <option value="debit">Debit (Expense)</option>
              <option value="credit">Credit (Income)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Category</label>
            <select
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
