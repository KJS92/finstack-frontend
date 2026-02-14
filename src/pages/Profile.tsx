import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { profileService, UserProfile } from '../services/profileService';
import './Profile.css';
import AppHeader from '../components/layout/AppHeader';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({ accountCount: 0, memberSince: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userEmail, setUserEmail] = useState('');
  
  // Password change form
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    checkUser();
    loadProfile();
  }, []);

  const checkUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    navigate('/auth');
  } else {
    setUserEmail(session.user.email || '');
  }
};

  const loadProfile = async () => {
    try {
      setLoading(true);
      const profileData = await profileService.getProfile();
      const statsData = await profileService.getAccountStats();
      
      setProfile(profileData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      await profileService.updatePassword(newPassword);
      setSuccess('Password updated successfully!');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return <div className="profile-container"><p>Loading profile...</p></div>;
  }

  if (!profile) {
    return <div className="profile-container"><p>Profile not found</p></div>;
  }

  return (
    <div className="profile-container">
      <AppHeader title="Profile" userEmail={userEmail} activePage="profile" />

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="profile-content">
        <div className="profile-card">
          <div className="profile-avatar">
            <span className="avatar-icon">👤</span>
          </div>
          <h2>{profile.email}</h2>
          <p className="member-since">Member since {formatDate(profile.created_at)}</p>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Accounts</h3>
            <p className="stat-value">{stats.accountCount}</p>
          </div>
          <div className="stat-card">
            <h3>Account Status</h3>
            <p className="stat-value">Active</p>
          </div>
        </div>

        <div className="settings-section">
          <h3>Account Settings</h3>
          
          <div className="setting-item">
            <div className="setting-info">
              <h4>Email Address</h4>
              <p>{profile.email}</p>
            </div>
            <button className="btn-secondary" disabled>
              Change Email
            </button>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Password</h4>
              <p>••••••••</p>
            </div>
            <button 
              className="btn-secondary"
              onClick={() => setShowPasswordForm(!showPasswordForm)}
            >
              {showPasswordForm ? 'Cancel' : 'Change Password'}
            </button>
          </div>

          {showPasswordForm && (
            <form onSubmit={handlePasswordChange} className="password-form">
              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn-primary">
                Update Password
              </button>
            </form>
          )}
        </div>

        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h4>Delete Account</h4>
              <p>Permanently delete your account and all data</p>
            </div>
            <button className="btn-danger" disabled>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
