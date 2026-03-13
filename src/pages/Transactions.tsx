import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// "Transactions" nav item redirects straight to the transaction list.
// Upload (bank statement import) is accessible from the empty state
// inside TransactionsList via the "Upload Transactions" button.
const Transactions: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    navigate('/transactions-list', { replace: true });
  }, [navigate]);
  return null;
};

export default Transactions;
