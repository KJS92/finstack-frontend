import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';
import './UpdatePassword.css';

const UpdatePassword: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasValidToken, setHasValidToken] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Check current location for hash params
        const currentHash = window.location.hash || location.hash;
        const hashParams = new URLSearchParams(currentHash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        console.log('Hash params:', { accessToken: !!accessToken, refreshToken: !!refreshToken, type });
        
        if (accessToken && refreshToken && type === 'recovery') {
          // Set the session with tokens from URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            console.error('Session error:', error);
            setMessage('Invalid or expired reset link. Please request a new one.');
            setHasValidToken(false);
          } else {
            console.log('Session set successfully');
            setHasValidToken(true);
            // Clear the hash from URL for security
            window.history.replaceState(null, '', '/update-password');
          }
        } else {
          // Check if we already have a valid session
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('Existing session found');
            setHasValidToken(true);
          } else {
            console.log('No valid session or token');
            setMessage('Invalid or expired reset link. Please request a new one.');
            setHasValidToken(false);
          }
        }
      } catch (error) {
        console.error('Error:', error);
        setMessage('Error validating reset link. Please try again.');
        setHasValidToken(false);
      }
    };
    
    checkSession();
  }, [location]);

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
      
      // Sign out and redirect to login after 2 seconds
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      setMessage(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  if (!hasValidToken && message) {
    return (
      <div className="update-password-container">
        <div className="update-password-card">
          <h1 className="update-title">Invalid Link</h1>
          <div className="message error">
            {message}
          </div>
          <button
            className="update-button"
            onClick={() => navigate('/password-reset')}
          >
            Request New Reset Link
          </button>
        </div>
      </div>
    );
  }

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

        {message && hasValidToken && (
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
