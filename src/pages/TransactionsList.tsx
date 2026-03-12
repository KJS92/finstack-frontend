import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { transactionService, Transaction } from '../services/transactionService';
import { accountService, Account } from '../services/accountService';
import EditTransactionModal from '../components/EditTransactionModal';
import { categoryService, Category } from '../services/categoryService';
import { categorizationService } from '../services/categorizationService';
import { pdfExportService } from '../services/pdfExportService';
import Toast from '../components/Toast';
import './TransactionsList.css';
import AppHeader from '../components/layout/AppHeader';
import { Filter, X, ChevronDown, ChevronUp, Download, List, LayoutGrid, Sparkles } from 'lucide-react';

type SortField = 'date' | 'amount' | 'description';
type SortDir = 'asc' | 'desc';

const TransactionsList: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('list');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [bulkCategorizing, setBulkCategorizing] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');

  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => { checkUser(); loadData(); }, []);

  useEffect(() => {
    const state = location.state as any;
    if (state?.accountId && accounts.length > 0) setSelectedAccount(state.accountId);
  }, [location.state, accounts]);

  useEffect(() => {
    if (accounts.length > 0) loadTransactions();
  }, [selectedAccount, accounts]);

  useEffect(() => {
    const handleToast = (event: CustomEvent) => setToast(event.detail);
    const handleBalancesUpdated = () => loadTransactions();
    window.addEventListener('showToast', handleToast as EventListener);
    window.addEventListener('balancesUpdated', handleBalancesUpdated);
    return () => {
      window.removeEventListener('showToast', handleToast as EventListener);
      window.removeEventListener('balancesUpdated', handleBalancesUpdated);
    };
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate('/auth');
    else setUserEmail(session.user.email || '');
  };

  const loadCategories = async () => {
    try { setCategories(await categoryService.getCategories()); }
    catch (err: any) { console.error('Error loading categories:', err); }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setAccounts(await accountService.getAccounts());
      await loadCategories();
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const accountId = selectedAccount === 'all' ? undefined : selectedAccount;
      setTransactions(await transactionService.getTransactions(accountId));
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const filteredTransactions = useMemo(() => {
    let filtered = [...transactions];
    if (selectedType !== 'all') filtered = filtered.filter(t => t.transaction_type === selectedType);
    if (selectedCategory !== 'all') filtered = filtered.filter(t => t.category_id === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.description?.toLowerCase().includes(q) || t.category?.toLowerCase().includes(q)
      );
    }
    if (minAmount !== '') filtered = filtered.filter(t => t.amount >= parseFloat(minAmount));
    if (maxAmount !== '') filtered = filtered.filter(t => t.amount <= parseFloat(maxAmount));
    if (dateRange !== 'all') {
      const now = new Date();
      let fs: Date | null = null, fe: Date | null = null;
      switch (dateRange) {
        case 'this_month': fs = new Date(now.getFullYear(), now.getMonth(), 1); fe = new Date(now.getFullYear(), now.getMonth() + 1, 0); break;
        case 'last_month': fs = new Date(now.getFullYear(), now.getMonth() - 1, 1); fe = new Date(now.getFullYear(), now.getMonth(), 0); break;
        case 'last_3_months': fs = new Date(now.getFullYear(), now.getMonth() - 3, 1); fe = now; break;
        case 'last_6_months': fs = new Date(now.getFullYear(), now.getMonth() - 6, 1); fe = now; break;
        case 'this_year': fs = new Date(now.getFullYear(), 0, 1); fe = new Date(now.getFullYear(), 11, 31); break;
        case 'last_year': fs = new Date(now.getFullYear() - 1, 0, 1); fe = new Date(now.getFullYear() - 1, 11, 31); break;
        case 'custom': if (startDate) fs = new Date(startDate); if (endDate) fe = new Date(endDate); break;
      }
      if (fs || fe) {
        filtered = filtered.filter(t => {
          const d = new Date(t.transaction_date);
          if (fs && d < fs) return false;
          if (fe && d > fe) return false;
          return true;
        });
      }
    }
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'date') cmp = new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime();
      else if (sortField === 'amount') cmp = a.amount - b.amount;
      else if (sortField === 'description') cmp = (a.description || '').localeCompare(b.description || '');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [transactions, selectedType, selectedCategory, searchQuery, minAmount, maxAmount, dateRange, startDate, endDate, sortField, sortDir]);

  const activeFilterCount = useMemo(() => [
    selectedAccount !== 'all', selectedCategory !== 'all', selectedType !== 'all',
    searchQuery.trim() !== '', dateRange !== 'all', minAmount !== '' || maxAmount !== '',
  ].filter(Boolean).length, [selectedAccount, selectedCategory, selectedType, searchQuery, dateRange, minAmount, maxAmount]);

  const summary = useMemo(() => ({
    count: filteredTransactions.length,
    credits: filteredTransactions.filter(t => t.transaction_type === 'credit').reduce((s, t) => s + t.amount, 0),
    debits: filteredTransactions.filter(t => t.transaction_type === 'debit').reduce((s, t) => s + t.amount, 0),
  }), [filteredTransactions]);

  const handleExportPDF = () => {
    if (filteredTransactions.length === 0) { setToast({ message: 'No transactions to export.', type: 'info' }); return; }
    setExporting(true);
    try {
      pdfExportService.exportTransactions({
        transactions: filteredTransactions, accounts, categories,
        filters: {
          accountName: selectedAccount === 'all' ? 'All Accounts' : (accounts.find(a => a.id === selectedAccount)?.name || 'Account'),
          categoryName: selectedCategory === 'all' ? 'All Categories' : (categories.find(c => c.id === selectedCategory)?.name || 'Category'),
          typeName: selectedType === 'all' ? 'All Types' : selectedType === 'credit' ? 'Income' : 'Expense',
          dateLabel: getDateRangeLabel(), searchQuery,
        },
        summary, generatedBy: userEmail,
      });
      setToast({ message: `Exported ${filteredTransactions.length} transactions as PDF!`, type: 'success' });
    } catch (err: any) {
      setToast({ message: 'PDF export failed: ' + err.message, type: 'error' });
    } finally { setExporting(false); }
  };

  const handleEdit = (t: Transaction) => setEditingTransaction(t);
  const handleEditClose = () => setEditingTransaction(null);
  const handleEditSave = async () => { setEditingTransaction(null); await loadTransactions(); };

  const handleDateRangeChange = (value: string) => {
    setDateRange(value);
    if (value !== 'custom') { setStartDate(''); setEndDate(''); }
  };

  const clearAllFilters = () => {
    setSelectedAccount('all'); setSelectedCategory('all'); setSelectedType('all');
    setSearchQuery(''); setDateRange('all'); setStartDate(''); setEndDate('');
    setMinAmount(''); setMaxAmount('');
  };

  const handleSortChange = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this transaction?')) return;
    try { await transactionService.deleteTransaction(id); await loadTransactions(); }
    catch (err: any) { setError(err.message); }
  };

  const handleBulkCategorize = async () => {
    if (!window.confirm('Auto-categorize all uncategorized transactions?')) return;
    setBulkCategorizing(true);
    try {
      const uncategorized = transactions.filter(t => !t.category_id);
      if (uncategorized.length === 0) { setToast({ message: 'All transactions are already categorized!', type: 'info' }); return; }
      setToast({ message: `Categorizing ${uncategorized.length} transactions...`, type: 'info' });
      const result = await categorizationService.autoCategorizeTransactions(uncategorized);
      if (result.categorized > 0) {
        await categorizationService.applyCategorizationResults(result.results);
        await loadTransactions();
        setToast({ message: `Categorized ${result.categorized} transactions!`, type: 'success' });
      } else {
        setToast({ message: 'No transactions could be auto-categorized.', type: 'info' });
      }
    } catch (err: any) {
      setToast({ message: 'Bulk categorization failed.', type: 'error' });
    } finally { setBulkCategorizing(false); }
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return 'No Account';
    return accounts.find(a => a.id === accountId)?.name || `Account (${accountId.substring(0, 8)}...)`;
  };

  const getCategoryInfo = (categoryId: string | null) => {
    if (!categoryId) return { name: 'Uncategorized', icon: '?', color: '#6B7280' };
    const cat = categories.find(c => c.id === categoryId);
    return cat ? { name: cat.name, icon: cat.icon, color: cat.color } : { name: 'Uncategorized', icon: '?', color: '#6B7280' };
  };

  const getDateRangeLabel = () => {
    const labels: Record<string, string> = {
      all: 'All Time', this_month: 'This Month', last_month: 'Last Month',
      last_3_months: 'Last 3 Months', last_6_months: 'Last 6 Months',
      this_year: 'This Year', last_year: 'Last Year',
    };
    if (dateRange === 'custom') return startDate && endDate ? `${formatDate(startDate)} – ${formatDate(endDate)}` : 'Custom Range';
    return labels[dateRange] || 'All Time';
  };

  const sortIcon = (field: SortField) => sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕';

  const groupedByCategory = useMemo(() => {
    const grouped: { [key: string]: Transaction[] } = {};
    filteredTransactions.forEach(txn => {
      const key = txn.category_id || 'uncategorized';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(txn);
    });
    return grouped;
  }, [filteredTransactions]);

  const calcGroupTotal = (txns: Transaction[]) =>
    txns.reduce((sum, t) => sum + (t.transaction_type === 'debit' ? t.amount : -t.amount), 0);

  if (loading) return <div className="transactions-list-container"><p>Loading transactions...</p></div>;

  return (
    <div className="transactions-list-container">
      <AppHeader title="Transaction List" userEmail={userEmail} activePage="transactions" />
      {error && <div className="error-message">{error}</div>}

      {/* Summary Cards */}
      <div className="summary-section">
        <div className="summary-card"><h3>Transactions</h3><p className="stat-value">{summary.count}</p><span className="stat-label">{getDateRangeLabel()}</span></div>
        <div className="summary-card credit"><h3>Total Income</h3><p className="stat-value">{formatCurrency(summary.credits)}</p><span className="stat-label">{getDateRangeLabel()}</span></div>
        <div className="summary-card debit"><h3>Total Expenses</h3><p className="stat-value">{formatCurrency(summary.debits)}</p><span className="stat-label">{getDateRangeLabel()}</span></div>
        <div className="summary-card net"><h3>Net Balance</h3><p className="stat-value">{formatCurrency(summary.credits - summary.debits)}</p><span className="stat-label">{getDateRangeLabel()}</span></div>
      </div>

      {/* Filter Panel */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', margin: '0 20px 16px' }}>
        <div onClick={() => setFiltersOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} color="#16A34A" />
            <span style={{ fontWeight: 600, fontSize: '15px', color: '#111' }}>Filters & Sort</span>
            {activeFilterCount > 0 && (
              <span style={{ background: '#16A34A', color: '#fff', borderRadius: '999px', fontSize: '11px', fontWeight: 700, padding: '2px 8px' }}>
                {activeFilterCount} active
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {activeFilterCount > 0 && (
              <button onClick={e => { e.stopPropagation(); clearAllFilters(); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', fontWeight: 600, padding: '4px 10px', cursor: 'pointer' }}>
                <X size={12} /> Clear all
              </button>
            )}
            {filtersOpen ? <ChevronUp size={16} color="#999" /> : <ChevronDown size={16} color="#999" />}
          </div>
        </div>

        {filtersOpen && (
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid #f3f4f6' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginTop: '16px' }}>
              <div>
                <label style={filterLabelStyle}>Search Description</label>
                <input type="text" placeholder="e.g. Swiggy, salary..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={filterInputStyle} />
              </div>
              <div>
                <label style={filterLabelStyle}>Type</label>
                <select value={selectedType} onChange={e => setSelectedType(e.target.value)} style={filterInputStyle}>
                  <option value="all">All Types</option>
                  <option value="credit">Income (Credit)</option>
                  <option value="debit">Expense (Debit)</option>
                </select>
              </div>
              <div>
                <label style={filterLabelStyle}>Account</label>
                <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} style={filterInputStyle}>
                  <option value="all">All Accounts</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={filterLabelStyle}>Category</label>
                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} style={filterInputStyle}>
                  <option value="all">All Categories</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={filterLabelStyle}>Date Range</label>
                <select value={dateRange} onChange={e => handleDateRangeChange(e.target.value)} style={filterInputStyle}>
                  <option value="all">All Time</option>
                  <option value="this_month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="last_3_months">Last 3 Months</option>
                  <option value="last_6_months">Last 6 Months</option>
                  <option value="this_year">This Year (2026)</option>
                  <option value="last_year">Last Year (2025)</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              <div>
                <label style={filterLabelStyle}>Sort By</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['date', 'amount', 'description'] as SortField[]).map(f => (
                    <button key={f} onClick={() => handleSortChange(f)} style={{ flex: 1, padding: '8px 6px', border: '1px solid', borderColor: sortField === f ? '#16A34A' : '#ddd', borderRadius: '8px', background: sortField === f ? '#DCFCE7' : '#fff', color: sortField === f ? '#15803D' : '#555', fontSize: '12px', fontWeight: sortField === f ? 700 : 400, cursor: 'pointer', textTransform: 'capitalize' }}>
                      {f}{sortField === f ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={filterLabelStyle}>Amount Range (₹)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" placeholder="Min amount" value={minAmount} onChange={e => setMinAmount(e.target.value)} style={{ ...filterInputStyle, flex: 1 }} min="0" />
                  <span style={{ color: '#999', fontSize: '13px' }}>to</span>
                  <input type="number" placeholder="Max amount" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} style={{ ...filterInputStyle, flex: 1 }} min="0" />
                </div>
              </div>
              {dateRange === 'custom' && (
                <>
                  <div><label style={filterLabelStyle}>From</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={filterInputStyle} /></div>
                  <div><label style={filterLabelStyle}>To</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={filterInputStyle} /></div>
                </>
              )}
            </div>
            {activeFilterCount > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '14px' }}>
                {searchQuery.trim() && <FilterChip label={`"${searchQuery}"`} onRemove={() => setSearchQuery('')} />}
                {selectedType !== 'all' && <FilterChip label={selectedType === 'credit' ? 'Income only' : 'Expense only'} onRemove={() => setSelectedType('all')} />}
                {selectedAccount !== 'all' && <FilterChip label={accounts.find(a => a.id === selectedAccount)?.name || 'Account'} onRemove={() => setSelectedAccount('all')} />}
                {selectedCategory !== 'all' && <FilterChip label={categories.find(c => c.id === selectedCategory)?.name || 'Category'} onRemove={() => setSelectedCategory('all')} />}
                {dateRange !== 'all' && <FilterChip label={getDateRangeLabel()} onRemove={() => handleDateRangeChange('all')} />}
                {(minAmount !== '' || maxAmount !== '') && <FilterChip label={`₹${minAmount || '0'} – ₹${maxAmount || '∞'}`} onRemove={() => { setMinAmount(''); setMaxAmount(''); }} />}
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Toggle + Actions */}
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => setViewMode('list')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <List size={14} /> List View
        </button>
        <button
          className={`view-toggle-btn ${viewMode === 'grouped' ? 'active' : ''}`}
          onClick={() => setViewMode('grouped')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <LayoutGrid size={14} /> Group by Category
        </button>
        <button
          onClick={handleBulkCategorize}
          disabled={bulkCategorizing}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: bulkCategorizing ? '#e5e7eb' : '#0F172A', color: bulkCategorizing ? '#999' : '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: bulkCategorizing ? 'not-allowed' : 'pointer' }}
        >
          <Sparkles size={14} />
          {bulkCategorizing ? 'Categorizing...' : 'Auto-Categorize'}
        </button>
        <button
          onClick={handleExportPDF}
          disabled={exporting || filteredTransactions.length === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: exporting || filteredTransactions.length === 0 ? '#e5e7eb' : '#15803D', color: exporting || filteredTransactions.length === 0 ? '#9ca3af' : '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: exporting || filteredTransactions.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          <Download size={14} />
          {exporting ? 'Exporting...' : `Export PDF (${filteredTransactions.length})`}
        </button>
      </div>

      {/* Transactions Content */}
      <div className="transactions-content">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <p>No transactions match the selected filters</p>
            {activeFilterCount > 0 && <button onClick={clearAllFilters} className="btn-secondary">Clear All Filters</button>}
            {activeFilterCount === 0 && <button onClick={() => navigate('/transactions')} className="btn-primary">Upload Transactions</button>}
          </div>
        ) : viewMode === 'list' ? (
          <div className="table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th onClick={() => handleSortChange('date')} style={{ cursor: 'pointer' }}>Date{sortIcon('date')}</th>
                  <th>Account</th>
                  <th onClick={() => handleSortChange('description')} style={{ cursor: 'pointer' }}>Description{sortIcon('description')}</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th onClick={() => handleSortChange('amount')} style={{ cursor: 'pointer' }}>Amount{sortIcon('amount')}</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map(txn => {
                  const catInfo = getCategoryInfo(txn.category_id);
                  return (
                    <tr key={txn.id}>
                      <td>{formatDate(txn.transaction_date)}</td>
                      <td>{getAccountName(txn.account_id)}</td>
                      <td className="description">{txn.description}</td>
                      <td><span className="category-badge" style={{ backgroundColor: catInfo.color || '#6B7280' }}>{catInfo.icon} {catInfo.name}</span></td>
                      <td><span className={`type-badge ${txn.transaction_type}`}>{txn.transaction_type === 'credit' ? '↓ Credit' : '↑ Debit'}</span></td>
                      <td className={`amount ${txn.transaction_type}`}>{formatCurrency(txn.amount)}</td>
                      <td>{txn.balance ? formatCurrency(txn.balance) : '-'}</td>
                      <td>
                        <div className="action-buttons">
                          <button onClick={() => handleEdit(txn)} className="btn-edit-small">Edit</button>
                          <button onClick={() => handleDelete(txn.id)} className="btn-delete-small">Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grouped-view">
            {Object.entries(groupedByCategory).map(([categoryId, txns]) => {
              const catInfo = getCategoryInfo(categoryId === 'uncategorized' ? null : categoryId);
              const total = calcGroupTotal(txns);
              return (
                <div key={categoryId} className="category-group">
                  <div className="category-header">
                    <h3><span style={{ fontSize: '20px' }}>{catInfo.icon}</span> {catInfo.name}<span className="transaction-count"> ({txns.length} transactions)</span></h3>
                    <span className={`category-total ${total > 0 ? 'debit' : 'credit'}`}>{formatCurrency(Math.abs(total))}</span>
                  </div>
                  <table className="transactions-table">
                    <tbody>
                      {txns.map(txn => (
                        <tr key={txn.id}>
                          <td>{formatDate(txn.transaction_date)}</td>
                          <td>{getAccountName(txn.account_id)}</td>
                          <td className="description">{txn.description}</td>
                          <td><span className={`type-badge ${txn.transaction_type}`}>{txn.transaction_type === 'credit' ? '↓ Credit' : '↑ Debit'}</span></td>
                          <td className={`amount ${txn.transaction_type}`}>{formatCurrency(txn.amount)}</td>
                          <td>{txn.balance ? formatCurrency(txn.balance) : '-'}</td>
                          <td>
                            <div className="action-buttons">
                              <button onClick={() => handleEdit(txn)} className="btn-edit-small">Edit</button>
                              <button onClick={() => handleDelete(txn.id)} className="btn-delete-small">Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingTransaction && <EditTransactionModal transaction={editingTransaction} onClose={handleEditClose} onSave={handleEditSave} />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

const FilterChip: React.FC<{ label: string; onRemove: () => void }> = ({ label, onRemove }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '999px', fontSize: '12px', fontWeight: 500, padding: '3px 10px' }}>
    {label}
    <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#15803D', padding: '0', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
      <X size={11} />
    </button>
  </span>
);

const filterLabelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#555', marginBottom: '6px' };
const filterInputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '13px', color: '#333', background: '#fafafa', boxSizing: 'border-box' };

export default TransactionsList;
