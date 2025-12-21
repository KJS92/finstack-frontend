import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import { fileUploadService } from '../services/fileUploadService';
import './Transactions.css';

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkUser();
    loadAccounts();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    }
  };

  const loadAccounts = async () => {
    try {
      const data = await accountService.getAccounts();
      setAccounts(data);
      if (data.length > 0) {
        setSelectedAccount(data[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validation = fileUploadService.validateFile(selectedFile);
    if (!validation.valid) {
      setError(validation.error || 'Invalid file');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError('');
  };

    const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedAccount) {
      setError('Please select both a file and an account');
      return;
    }
  
    try {
      setUploading(true);
      setError('');
      setSuccess('');
  
      // Find account name for display
      const account = accounts.find(a => a.id === selectedAccount);
      
      // Navigate to preview page with file data
      navigate('/transaction-preview', {
        state: {
          file: file,
          accountId: selectedAccount,
          accountName: account?.name || 'Unknown Account'
        }
      });
      
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
    } finally {
      setUploading(false);
    }
  };


  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="transactions-container">
      <header className="transactions-header">
        <h1>Upload Transactions</h1>
        <div className="header-actions">
          <button onClick={() => navigate('/dashboard')} className="btn-secondary">
            Dashboard
          </button>
          <button onClick={() => navigate('/accounts')} className="btn-secondary">
            Accounts
          </button>
          <button onClick={() => navigate('/profile')} className="btn-secondary">
            Profile
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="upload-section">
        <div className="upload-card">
          <div className="upload-icon">📁</div>
          <h2>Upload Bank Statement</h2>
          <p>Support for CSV, XLS, XLSX, and PDF files (max 10MB)</p>

          {accounts.length === 0 ? (
            <div className="no-accounts">
              <p>You need to create an account first</p>
              <button onClick={() => navigate('/accounts')} className="btn-primary">
                Create Account
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpload} className="upload-form">
              <div className="form-group">
                <label>Select Account</label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  required
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {account.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Choose File</label>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xls,.xlsx,.pdf"
                  onChange={handleFileSelect}
                  required
                />
                {file && (
                  <div className="file-info">
                    <span>📄 {file.name}</span>
                    <span className="file-size">
                      {(file.size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                )}
              </div>

              <button 
                type="submit" 
                className="btn-primary btn-large" 
                disabled={uploading || !file}
              >
                {uploading ? 'Uploading...' : 'Upload Statement'}
              </button>
            </form>
          )}
        </div>

        <div className="info-card">
          <h3>Supported Formats</h3>
          <ul>
            <li><strong>CSV</strong> - Comma-separated values</li>
            <li><strong>XLS/XLSX</strong> - Excel spreadsheets</li>
            <li><strong>PDF</strong> - PDF bank statements with tables</li>
          </ul>
          
          <h3>Tips for Best Results</h3>
          <ul>
            <li>Ensure the file contains date, description, and amount columns</li>
            <li>Remove any header rows or summary sections</li>
            <li>Keep file size under 10MB</li>
            <li>Use clear, descriptive file names</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Transactions;
