import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/auth');
    } else {
      setUser(user);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>FinStack Dashboard</h1>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </header>
      
      <div className="dashboard-content">
  <div className="welcome-card">
    <h2>Welcome to FinStack! 🎉</h2>
    <p>Email: {user?.email}</p>
    <p className="success-message">
      Your backend and frontend are successfully connected!
    </p>
    <button 
      className="nav-button"
      onClick={() => window.location.href = '/accounts'}
    >
      Manage Accounts →
    </button>
  </div>
  
  <div className="info-card">
    <h3>What's Next?</h3>
    <ul>
      <li>✅ Week 1: Authentication Complete</li>
      <li>🔄 Week 2: Account Management (In Progress)</li>
      <li>Week 3: Transaction Upload & Parsing</li>
      <li>Week 4: Categorization</li>
      <li>Week 5: Budgets & Summaries</li>
    </ul>
  </div>
</div>
  );
};

export default Dashboard;
