import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabase';
import { Transaction } from '../services/transactionService';
import './EditTransactionModal.css';

interface EditTransactionModalProps {
  transaction: Transaction;
  onClose: () => void;
  onSave: () => void;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({
  transaction,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    date: transaction.transaction_date,
    description: transaction.description,
    type: transaction.transaction_type,
    amount: transaction.amount.toString()
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    setLoading(true);
    setError('');

    const amount = parseFloat(formData.amount);

    console.log('About to update transaction via service');
    
    const { transactionService } = await import('../services/transactionService');
    
    // Update the transaction
    await transactionService.updateTransaction(transaction.id, {
      transaction_date: formData.date,
      description: formData.description,
      transaction_type: formData.type as 'debit' | 'credit',
      amount: amount
    });

    console.log('Transaction updated successfully');
    
    // Close modal immediately - don't wait for balance recalculation
    onSave();
    
  } catch (err: any) {
    console.error('Error updating transaction:', err);
    setError(err.message);
    setLoading(false); // Only stop loading on error
  }
  // Don't set loading to false on success - modal closes immediately
};


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Transaction</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-group">
            <label>Date *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Description *</label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Type *</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'debit' | 'credit' })}
              required
            >
              <option value="debit">Debit (Expense)</option>
              <option value="credit">Credit (Income)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Amount *</label>
            <input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">
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
