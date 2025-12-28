import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { transactionParser, ParsedTransaction } from '../services/transactionParser';
import { transactionService } from '../services/transactionService';
import './TransactionPreview.css';

const TransactionPreview: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ total: 0, credits: 0, debits: 0 });
  const [importMode, setImportMode] = useState<'skip' | 'all'>('skip');

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

      // Parse the file content
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

      // Check for duplicates
      await checkForDuplicates(parsedTransactions);

    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const checkForDuplicates = async (txns: ParsedTransaction[]) => {
    try {
      setChecking(true);
      const result = await transactionService.checkDuplicates(txns, accountId);
      setDuplicateInfo(result);
    } catch (err: any) {
      console.error('Duplicate check failed:', err);
      // Don't block import if duplicate check fails
    } finally {
      setChecking(false);
    }
  };

  const handleImport = async () => {
    if (transactions.length === 0) {
      setError('No transactions to import');
      return;
    }

    // If all transactions are duplicates and mode is skip
    if (importMode === 'skip' && duplicateInfo?.newCount === 0) {
      setError('All transactions are duplicates. Nothing to import.');
      return;
    }

    try {
      setImporting(true);
      setError('');
    
      // Import transactions
      const skipDuplicates = importMode === 'skip';
      await transactionService.importTransactions(
        transactions,
        accountId,
        fileName,
        skipDuplicates
      );

      const importedCount = skipDuplicates 
        ? duplicateInfo?.newCount || transactions.length 
        : transactions.length;

      alert(`Successfully imported ${importedCount} transaction(s)!`);
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
          disabled={importing || transactions.length === 0 || checking || (importMode === 'skip' && duplicateInfo?.newCount === 0)}
        >
          {importing 
            ? 'Importing...' 
            : importMode === 'skip' && duplicateInfo?.newCount === 0
            ? 'No New Transactions'
            : `Import ${importMode === 'skip' ? duplicateInfo?.newCount : transactions.length} Transaction(s)`
          }
        </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Duplicate Warning */}
      {duplicateInfo && duplicateInfo.duplicateCount > 0 && (
        <div className="duplicate-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>Duplicate Transactions Detected</h3>
            <p>
              Found <strong>{duplicateInfo.duplicateCount}</strong> transaction(s) that already exist in your account.
              <br />
              <strong>{duplicateInfo.newCount}</strong> new transaction(s) will be imported.
            </p>
            <div className="import-mode-selector">
              <label>
                <input
                  type="radio"
                  name="importMode"
                  value="skip"
                  checked={importMode === 'skip'}
                  onChange={() => setImportMode('skip')}
                />
                Skip duplicates (recommended)
              </label>
              <label>
                <input
                  type="radio"
                  name="importMode"
                  value="all"
                  checked={importMode === 'all'}
                  onChange={() => setImportMode('all')}
                />
                Import all anyway
              </label>
            </div>
          </div>
        </div>
      )}

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
          {duplicateInfo && duplicateInfo.duplicateCount > 0 && (
            <div className="summary-card warning">
              <h3>New Transactions</h3>
              <p className="stat-value">{duplicateInfo.newCount}</p>
            </div>
          )}
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
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => {
                  const isDuplicate = duplicateInfo?.duplicates.some((dup: any) => 
                    dup.transaction_date === transaction.transaction_date &&
                    dup.amount === transaction.amount &&
                    dup.description === transaction.description
                  );
                  
                  return (
                    <tr key={index} className={isDuplicate ? 'duplicate-row' : ''}>
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
                      <td>
                        {isDuplicate ? (
                          <span className="duplicate-badge">Duplicate</span>
                        ) : (
                          <span className="new-badge">New</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
            disabled={importing || transactions.length === 0 || checking}
          >
            {importing 
              ? 'Importing...' 
              : checking 
              ? 'Checking duplicates...'
              : `Confirm & Import ${importMode === 'skip' ? (duplicateInfo?.newCount || transactions.length) : transactions.length} Transaction(s)`
            }
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionPreview;
