import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import './UpdatePassword.css';

const UpdatePassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid session from the reset link
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setMessage('Invalid or expired reset link. Please request a new one.');
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setMessage('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setIsSuccess(true);
      setMessage('Password updated successfully!');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="update-password-container">
      <div className="update-password-card">
        <h1 className="update-title">Set New Password</h1>
        <p className="update-subtitle">
          Enter your new password below.
        </p>

        <form onSubmit={handleSubmit} className="update-form">
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              disabled={loading || isSuccess}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="••••••••"
              minLength={6}
              disabled={loading || isSuccess}
            />
          </div>

          <button 
            type="submit" 
            className="update-button" 
            disabled={loading || isSuccess}
          >
            {loading ? 'Updating...' : isSuccess ? 'Password Updated!' : 'Update Password'}
          </button>
        </form>

        {message && (
          <div className={`message ${isSuccess ? 'success' : 'error'}`}>
            {message}
            {isSuccess && <p className="redirect-text">Redirecting to login...</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default UpdatePassword;
