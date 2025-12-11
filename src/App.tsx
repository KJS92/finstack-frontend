import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Accounts from './pages/Accounts';
import PasswordReset from './pages/PasswordReset';
import UpdatePassword from './pages/UpdatePassword';
import AuthHandler from './components/AuthHandler';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <AuthHandler />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/update-password" element={<UpdatePassword />} />
        </Routes>
      </div>
    </Router>
  );
}

// Custom component to handle root route
function RootRedirect() {
  const hash = window.location.hash;
  
  // If there's a recovery token in the hash, don't redirect
  if (hash && hash.includes('type=recovery')) {
    return null; // AuthHandler will take care of navigation
  }
  
  // Otherwise redirect to auth
  return <Navigate to="/auth" replace />;
}

export default App;
