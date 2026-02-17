import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import NotificationDropdown from '../notifications/NotificationDropdown';
import { BarChart3 } from 'lucide-react';
import './AppHeader.css';

interface AppHeaderProps {
  title: string;
  userEmail: string;
  activePage?: string;
}

const AppHeader: React.FC<AppHeaderProps> = ({ title, userEmail, activePage }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <h1>{title}</h1>
        <p className="user-email">{userEmail}</p>
      </div>
      
      <div className="header-right">
        {/* Notification Bell */}
        <NotificationDropdown />
        
        {/* Navigation Buttons */}
        {/* Navigation Buttons */}
<div className="header-nav">
  <button 
    onClick={() => navigate('/dashboard')} 
    className={`nav-btn ${activePage === 'dashboard' ? 'active' : ''}`}
  >
    📊 Dashboard
  </button>
  <button 
    onClick={() => navigate('/add-transaction')} 
    className={`nav-btn ${activePage === 'add-transaction' ? 'active' : ''}`}
  >
    ➕ Add Transaction
  </button>
  <button 
    onClick={() => navigate('/transactions')} 
    className={`nav-btn ${activePage === 'transactions' ? 'active' : ''}`}
  >
    📋 Transactions
  </button>
  <button 
    onClick={() => navigate('/budgets')} 
    className={`nav-btn ${activePage === 'budgets' ? 'active' : ''}`}
  >
    <button 
      onClick={() => navigate('/receivables')} 
      className={`nav-btn ${activePage === 'receivables' ? 'active' : ''}`}
    >
    💸 Receivables
    </button>
    <button 
    onClick={() => navigate('/reports')} 
    className={`nav-btn ${activePage === 'reports' ? 'active' : ''}`}
  >
    📈 Reports
  </button>
  <button 
    onClick={() => navigate('/categories')} 
    className={`nav-btn ${activePage === 'categories' ? 'active' : ''}`}
  >
    🏷️ Categories
  </button>
  <button 
    onClick={() => navigate('/profile')} 
    className={`nav-btn ${activePage === 'profile' ? 'active' : ''}`}
  >
    👤 Profile
  </button>
</div>
        
        {/* Logout Button */}
        <button onClick={handleLogout} className="btn-logout">
          Logout
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
