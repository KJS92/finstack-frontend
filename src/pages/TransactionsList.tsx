import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { transactionService, Transaction } from '../services/transactionService';
import { accountService, Account } from '../services/accountService';
import './TransactionsList.css';

const TransactionsList: React.FC = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
  checkUser();
  loadData();
}, []);

// Remove the second useEffect with selectedAccount dependency

const loadData = async () => {
  try {
    setLoading(true);
    
    // Load accounts FIRST
    const accountsData = await accountService.getAccounts();
    setAccounts(accountsData);
    
    // Then load transactions
    const accountId = selectedAccount === 'all' ? undefined : selectedAccount;
    const transactionsData = await transactionService.getTransactions(accountId);
    setTransactions(transactionsData);
    
  } catch (err: any) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  // Add separate function for filter changes
  useEffect(() => {
    if (accounts.length > 0) {
      loadTransactions();
    }
  }, [selectedAccount]);
  
  const loadTransactions = async () => {
    try {
      setLoading(true);
      const accountId = selectedAccount === 'all' ? undefined : selectedAccount;
      const data = await transactionService.getTransactions(accountId);
      setTransactions(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await transactionService.deleteTransaction(id);
      loadTransactions();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
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

    const getAccountName = (accountId: string | null) => {
    if (!accountId) return 'No Account';
    const account = accounts.find(a => a.id === accountId);
    return account?.name || `Account (${accountId.substring(0, 8)}...)`;
  };

  if (loading) {
    return <div className="transactions-list-container"><p>Loading transactions...</p></div>;
  }

  return (
    <div className="transactions-list-container">
      <header className="transactions-list-header">
        <h1>All Transactions</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/transactions')} className="btn-primary">
            Upload New
          </button>
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Dashboard
          </button>
          <button onClick={() => navigate('/accounts')} className="btn-secondary">
            Accounts
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-section">
        <div className="filter-group">
          <label>Filter by Account:</label>
          <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
            <option value="all">All Accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="transactions-content">
        {transactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions yet</p>
            <button onClick={() => navigate('/transactions')} className="btn-primary">
              Upload Transactions
            </button>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Account</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.transaction_date)}</td>
                    <td>{getAccountName(transaction.account_id)}</td>
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
                      <button 
                        onClick={() => handleDelete(transaction.id)}
                        className="btn-delete-small"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsList;
