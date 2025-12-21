import React, { useState } from 'react';
import './ColumnMapper.css';

interface ColumnMapperProps {
  headers: string[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
}

export interface ColumnMapping {
  date: number;
  description: number;
  debit: number;
  credit: number;
  balance: number;
}

const ColumnMapper: React.FC<ColumnMapperProps> = ({ headers, onConfirm, onCancel }) => {
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: -1,
    description: -1,
    debit: -1,
    credit: -1,
    balance: -1
  });

  // Auto-detect best matches
  const autoDetect = () => {
    const findBestMatch = (patterns: string[]) => {
      return headers.findIndex(h => 
        patterns.some(p => h.toLowerCase().includes(p.toLowerCase()))
      );
    };

    setMapping({
      date: findBestMatch(['date', 'dt', 'txn date']),
      description: findBestMatch(['description', 'narration', 'particulars', 'details']),
      debit: findBestMatch(['debit', 'withdrawal', 'dr']),
      credit: findBestMatch(['credit', 'deposit', 'cr']),
      balance: findBestMatch(['balance', 'bal', 'closing'])
    });
  };

  React.useEffect(() => {
    autoDetect();
  }, [headers]);

  const handleConfirm = () => {
    if (mapping.date === -1 || mapping.description === -1) {
      alert('Please map at least Date and Description columns');
      return;
    }
    if (mapping.debit === -1 && mapping.credit === -1) {
      alert('Please map at least one of Debit or Credit columns');
      return;
    }
    onConfirm(mapping);
  };

  return (
    <div className="column-mapper">
      <h3>Map Your CSV Columns</h3>
      <p>Tell us which columns contain which data</p>

      <div className="mapping-grid">
        <div className="mapping-row">
          <label>Date Column *</label>
          <select 
            value={mapping.date} 
            onChange={e => setMapping({...mapping, date: parseInt(e.target.value)})}
          >
            <option value={-1}>-- Select Column --</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
        </div>

        <div className="mapping-row">
          <label>Description Column *</label>
          <select 
            value={mapping.description} 
            onChange={e => setMapping({...mapping, description: parseInt(e.target.value)})}
          >
            <option value={-1}>-- Select Column --</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
        </div>

        <div className="mapping-row">
          <label>Debit/Withdrawal Column</label>
          <select 
            value={mapping.debit} 
            onChange={e => setMapping({...mapping, debit: parseInt(e.target.value)})}
          >
            <option value={-1}>-- Select Column --</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
        </div>

        <div className="mapping-row">
          <label>Credit/Deposit Column</label>
          <select 
            value={mapping.credit} 
            onChange={e => setMapping({...mapping, credit: parseInt(e.target.value)})}
          >
            <option value={-1}>-- Select Column --</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
        </div>

        <div className="mapping-row">
          <label>Balance Column (Optional)</label>
          <select 
            value={mapping.balance} 
            onChange={e => setMapping({...mapping, balance: parseInt(e.target.value)})}
          >
            <option value={-1}>-- Select Column --</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{h}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mapper-actions">
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
        <button onClick={handleConfirm} className="btn-primary">
          Confirm Mapping
        </button>
      </div>
    </div>
  );
};

export default ColumnMapper;
