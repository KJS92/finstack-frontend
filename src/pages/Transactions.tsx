import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// "Transactions" nav item goes directly to the transaction list.
// The upload (bank statement import) is accessible from the empty state
// inside TransactionsList via the "Upload Transactions" button.
const Transactions: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/transactions-list', { replace: true }); }, []);
  return null;
};

import React from 'react';
export default Transactions;
