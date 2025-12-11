import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import './PasswordReset.css';

const PasswordReset: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}`,
      });

      if (error) throw error;

      setIsSuccess(true);
      setMessage('Password reset email sent! Please check your inbox.');
    } catch (error: any) {
      setIsSuccess(false);
      setMessage(error.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-reset-container">
      <div className="password-reset-card">
        <h1 className="reset-title">Reset Password</h1>
        <p className="reset-subtitle">
          Enter your email address and we'll send you a link to reset your password.
        </p>

        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="reset-form">
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                disabled={loading}
              />
            </div>

            <button type="submit" className="reset-button" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <div className="success-state">
            <div className="success-icon">✉️</div>
            <p className="success-text">Check your email!</p>
            <p className="success-subtext">
              We've sent a password reset link to <strong>{email}</strong>
            </p>
          </div>
        )}

        {message && !isSuccess && (
          <div className="message error">
            {message}
          </div>
        )}

        <p className="back-to-login">
          Remember your password?{' '}
          <button
            type="button"
            onClick={() => navigate('/auth')}
            className="link-button"
          >
            Back to Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default PasswordReset;
