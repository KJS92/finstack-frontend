import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { accountService, Account } from '../services/accountService';
import { fileUploadService } from '../services/fileUploadService';
import './Transactions.css';
import AppHeader from '../components/layout/AppHeader';
const [userEmail, setUserEmail] = useState('');

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
  } else {
    setUserEmail(session.user.email || '');
  }
};
  
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedAccount) {
      setError('Please select an account first');
      return;
    }

    // Update file state for UI
    setFile(selectedFile);

    try {
      setError('');
      setUploading(true);

      // Read file as text
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const fileContent = event.target?.result as string;
          
          if (!fileContent) {
            throw new Error('Failed to read file content');
          }

          // Navigate to preview with file content as string
          navigate('/transaction-preview', {
            state: {
              file: fileContent,  // Pass as string, not File object
              accountId: selectedAccount,
              accountName: accounts.find(a => a.id === selectedAccount)?.name,
              fileName: selectedFile.name
            }
          });
        } catch (err: any) {
          setError(err.message || 'Failed to process file');
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setError('Failed to read file');
        setUploading(false);
      };

      // Read as text for CSV
      if (selectedFile.name.endsWith('.csv')) {
        reader.readAsText(selectedFile);
      } else {
        setError('Only CSV files are supported at the moment');
        setUploading(false);
      }

    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <div className="transactions-container">
      <AppHeader 
  title="Transactions" 
  userEmail={userEmail} 
  activePage="transactions"
/>

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
            <div className="upload-form">
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
                  disabled={uploading}
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

              {uploading && (
                <div className="uploading-message">
                  Processing file... Please wait.
                </div>
              )}
            </div>
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
