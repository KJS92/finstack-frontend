import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { transactionService, Transaction } from '../services/transactionService';
import { accountService, Account } from '../services/accountService';
import EditTransactionModal from '../components/EditTransactionModal';
import './TransactionsList.css';

const TransactionsList: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({ 
    total: 0, 
    credits: 0, 
    debits: 0,
    count: 0 
  });

  useEffect(() => {
    checkUser();
    loadData();
  }, []);

  // Handle account filter from Dashboard navigation
  useEffect(() => {
   // Handle account filter from Dashboard navigation
useEffect(() => {
  const state = location.state as any;
  if (state?.accountId && accounts.length > 0) {
    console.log('Setting account filter to:', state.accountId);
    setSelectedAccount(state.accountId);
    // Clear location state after using it
    window.history.replaceState({}, document.title);
  }
}, [location.state, accounts]);

  // Load transactions when account filter changes
  useEffect(() => {
    if (accounts.length > 0) {
      loadTransactions();
    }
  }, [selectedAccount, accounts]);

  // Apply date filters
  useEffect(() => {
    applyFilters();
  }, [transactions, dateRange, startDate, endDate]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load accounts FIRST
      const accountsData = await accountService.getAccounts();
      setAccounts(accountsData);
      
      // Then load all transactions initially
      const transactionsData = await transactionService.getTransactions();
      setTransactions(transactionsData);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

  const applyFilters = () => {
    let filtered = [...transactions];

    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let filterStartDate: Date | null = null;
      let filterEndDate: Date | null = null;

      switch (dateRange) {
        case 'this_month':
          filterStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
          filterEndDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'last_month':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          filterEndDate = new Date(now.getFullYear(), now.getMonth(), 0);
          break;
        case 'last_3_months':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
          filterEndDate = now;
          break;
        case 'last_6_months':
          filterStartDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
          filterEndDate = now;
          break;
        case 'this_year':
          filterStartDate = new Date(now.getFullYear(), 0, 1);
          filterEndDate = new Date(now.getFullYear(), 11, 31);
          break;
        case 'last_year':
          filterStartDate = new Date(now.getFullYear() - 1, 0, 1);
          filterEndDate = new Date(now.getFullYear() - 1, 11, 31);
          break;
        case 'custom':
          if (startDate) filterStartDate = new Date(startDate);
          if (endDate) filterEndDate = new Date(endDate);
          break;
      }

      if (filterStartDate || filterEndDate) {
        filtered = filtered.filter(txn => {
          const txnDate = new Date(txn.transaction_date);
          if (filterStartDate && txnDate < filterStartDate) return false;
          if (filterEndDate && txnDate > filterEndDate) return false;
          return true;
        });
      }
    }

    setFilteredTransactions(filtered);
    calculateSummary(filtered);
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };
  
  const handleEditClose = () => {
    setEditingTransaction(null);
  };
  
  const handleEditSave = async () => {
    setEditingTransaction(null);
    await loadTransactions(); // Make it async and await
  };

  const calculateSummary = (txns: Transaction[]) => {
    const summary = {
      total: txns.length,
      count: txns.length,
      credits: txns
        .filter(t => t.transaction_type === 'credit')
        .reduce((sum, t) => sum + t.amount, 0),
      debits: txns
        .filter(t => t.transaction_type === 'debit')
        .reduce((sum, t) => sum + t.amount, 0)
    };
    setSummary(summary);
  };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    if (value !== 'custom') {
      setStartDate('');
      setEndDate('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      await transactionService.deleteTransaction(id);
      await loadTransactions();
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

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'this_month': return 'This Month';
      case 'last_month': return 'Last Month';
      case 'last_3_months': return 'Last 3 Months';
      case 'last_6_months': return 'Last 6 Months';
      case 'this_year': return 'This Year';
      case 'last_year': return 'Last Year';
      case 'custom': return startDate && endDate 
        ? `${formatDate(startDate)} - ${formatDate(endDate)}` 
        : 'Custom Range';
      default: return 'All Time';
    }
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

      {/* Summary Cards */}
      <div className="summary-section">
        <div className="summary-card">
          <h3>Transactions</h3>
          <p className="stat-value">{summary.count}</p>
          <span className="stat-label">{getDateRangeLabel()}</span>
        </div>
        <div className="summary-card credit">
          <h3>Total Income</h3>
          <p className="stat-value">{formatCurrency(summary.credits)}</p>
          <span className="stat-label">{getDateRangeLabel()}</span>
        </div>
        <div className="summary-card debit">
          <h3>Total Expenses</h3>
          <p className="stat-value">{formatCurrency(summary.debits)}</p>
          <span className="stat-label">{getDateRangeLabel()}</span>
        </div>
        <div className="summary-card net">
          <h3>Net Balance</h3>
          <p className="stat-value">{formatCurrency(summary.credits - summary.debits)}</p>
          <span className="stat-label">{getDateRangeLabel()}</span>
        </div>
      </div>

      {/* Filters Section */}
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

        <div className="filter-group">
          <label>Filter by Date:</label>
          <select value={dateRange} onChange={(e) => handleDateRangeChange(e.target.value)}>
            <option value="all">All Time</option>
            <option value="this_month">This Month</option>
            <option value="last_month">Last Month</option>
            <option value="last_3_months">Last 3 Months</option>
            <option value="last_6_months">Last 6 Months</option>
            <option value="this_year">This Year (2025)</option>
            <option value="last_year">Last Year (2024)</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        {dateRange === 'custom' && (
          <>
            <div className="filter-group">
              <label>From:</label>
              <input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)} 
              />
            </div>
            <div className="filter-group">
              <label>To:</label>
              <input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)} 
              />
            </div>
          </>
        )}
      </div>

      <div className="transactions-content">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions found for the selected filters</p>
            {dateRange !== 'all' || selectedAccount !== 'all' ? (
              <button onClick={() => { setDateRange('all'); setSelectedAccount('all'); }} className="btn-secondary">
                Clear Filters
              </button>
            ) : (
              <button onClick={() => navigate('/transactions')} className="btn-primary">
                Upload Transactions
              </button>
            )}
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
                {filteredTransactions.map((transaction) => (
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
                      <div className="action-buttons">
                        <button 
                          onClick={() => handleEdit(transaction)}
                          className="btn-edit-small"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(transaction.id)}
                          className="btn-delete-small"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Edit Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onClose={handleEditClose}
          onSave={handleEditSave}
        />
      )}
    </div>
  );
};

export default TransactionsList;
