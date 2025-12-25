import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { transactionParser, ParsedTransaction } from '../services/transactionParser';
import { transactionService } from '../services/transactionService';
import { fileUploadService } from '../services/fileUploadService';
import './TransactionPreview.css';

const TransactionPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ total: 0, credits: 0, debits: 0 });

  // Get file content and account from navigation state
  const { file, accountId, accountName, fileName } = location.state || {};

  useEffect(() => {
    checkUser();
    if (file) {
      parseFile();
    } else {
      setError('No file provided');
      setLoading(false);
    }
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    }
  };

  const parseFile = async () => {
    try {
      setLoading(true);
      setError('');

      // Parse the file content (file is now a string)
      const parsedTransactions = transactionParser.parseCSV(file);
      setTransactions(parsedTransactions);

      // Calculate summary
      const summary = {
        total: parsedTransactions.length,
        credits: parsedTransactions
          .filter(t => t.transaction_type === 'credit')
          .reduce((sum, t) => sum + t.amount, 0),
        debits: parsedTransactions
          .filter(t => t.transaction_type === 'debit')
          .reduce((sum, t) => sum + t.amount, 0)
      };
      setSummary(summary);

    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (transactions.length === 0) {
      setError('No transactions to import');
      return;
    }

    try {
      setImporting(true);
      setError('');
    
      // Import transactions to database
      await transactionService.importTransactions(
        transactions,
        accountId,
        fileName
      );

      alert(`Successfully imported ${transactions.length} transactions!`);
      navigate('/transactions-list');
    } catch (err: any) {
      setError(err.message || 'Failed to import transactions');
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    navigate('/transactions');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="preview-container">
        <div className="loading-screen">
          <div className="spinner"></div>
          <p>Parsing transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <header className="preview-header">
        <div>
          <h1>Transaction Preview</h1>
          <p className="account-info">
            Account: <strong>{accountName}</strong> • File: <strong>{fileName}</strong>
          </p>
        </div>
        <div className="header-actions">
          <button onClick={handleCancel} className="btn-secondary">
            Cancel
          </button>
          <button 
            onClick={handleImport} 
            className="btn-primary"
            disabled={importing || transactions.length === 0}
          >
            {importing ? 'Importing...' : `Import ${transactions.length} Transactions`}
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="preview-content">
        <div className="summary-cards">
          <div className="summary-card">
            <h3>Total Transactions</h3>
            <p className="stat-value">{summary.total}</p>
          </div>
          <div className="summary-card credit">
            <h3>Total Credits</h3>
            <p className="stat-value">{formatCurrency(summary.credits)}</p>
          </div>
          <div className="summary-card debit">
            <h3>Total Debits</h3>
            <p className="stat-value">{formatCurrency(summary.debits)}</p>
          </div>
          <div className="summary-card net">
            <h3>Net Change</h3>
            <p className="stat-value">
              {formatCurrency(summary.credits - summary.debits)}
            </p>
          </div>
        </div>

        <div className="transactions-table-container">
          <h3>Transactions Preview</h3>
          <div className="table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{formatDate(transaction.transaction_date)}</td>
                    <td className="description">{transaction.description}</td>
                    <td>
                      <span className={`type-badge ${transaction.transaction_type}`}>
                        {transaction.transaction_type === 'credit' ? '↓ Credit' : '↑ Debit'}
                      </span>
                    </td>
                    <td className={`amount ${transaction.transaction_type}`}>
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td>
                      {transaction.balance ? formatCurrency(transaction.balance) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="preview-actions">
          <button onClick={handleCancel} className="btn-secondary btn-large">
            Cancel Import
          </button>
          <button 
            onClick={handleImport} 
            className="btn-primary btn-large"
            disabled={importing || transactions.length === 0}
          >
            {importing ? 'Importing...' : `Confirm & Import ${transactions.length} Transactions`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionPreview;
