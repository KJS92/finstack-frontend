import React, { useState, useEffect } from 'react';
import { alertService, BudgetAlert } from '../../services/alertService';
import './NotificationDropdown.css';

const NotificationDropdown: React.FC = () => {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [readCount, setReadCount] = useState(0);

  useEffect(() => {
    loadAlerts();
    // Reload alerts every 30 seconds
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = async () => {
  try {
    // Run cleanup in background (doesn't block UI)
    alertService.cleanupOldAlerts().catch(err => 
      console.error('Cleanup failed:', err)
    );

    const [allAlerts, unreadCnt, readCnt] = await Promise.all([
      alertService.getAlerts(),
      alertService.getUnreadCount(),
      alertService.getReadCount()
    ]);
    
    setAlerts(allAlerts);
    setUnreadCount(unreadCnt);
    setReadCount(readCnt);
  } catch (error) {
    console.error('Error loading alerts:', error);
  }
};

  const handleMarkAsRead = async (alertId: string) => {
    try {
      await alertService.markAsRead(alertId);
      loadAlerts();
    } catch (error) {
      console.error('Error marking alert as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setLoading(true);
      await alertService.markAllAsRead();
      await loadAlerts();
    } catch (error) {
      console.error('Error marking all as read:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (alertId: string) => {
    try {
      await alertService.deleteAlert(alertId);
      loadAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const getAlertIcon = (type: BudgetAlert['alert_type']) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'exceeded': return '🚨';
      case 'expired': return '⏰';
      case 'renewed': return '🔄';
      default: return '📢';
    }
  };

  const getAlertColor = (type: BudgetAlert['alert_type']) => {
    switch (type) {
      case 'warning': return '#f59e0b';
      case 'exceeded': return '#ef4444';
      case 'expired': return '#6b7280';
      case 'renewed': return '#10b981';
      default: return '#3b82f6';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-IN');
  };

  const handleClearAllRead = async () => {
  if (!window.confirm('Delete all read notifications? This cannot be undone.')) {
    return;
  }
  
  try {
    setLoading(true);
    await alertService.clearAllRead();
    await loadAlerts();
  } catch (error) {
    console.error('Error clearing read alerts:', error);
    alert('Failed to clear notifications. Please try again.');
  } finally {
    setLoading(false);
  }
}notification-header;

  return (
    <div className="notification-container">
      {/* Bell Icon */}
      <button 
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="notification-overlay" onClick={() => setIsOpen(false)} />
          <div className="notification-dropdown">
            {/* Header */}
            <div className="notification-header">
  <h3>Notifications</h3>
  <div className="header-buttons">
    {unreadCount > 0 && (
      <button 
        onClick={handleMarkAllAsRead} 
        className="header-btn mark-all"
        disabled={loading}
      >
        {loading ? '...' : 'Mark all read'}
      </button>
    )}
    {readCount > 0 && (
      <button 
        onClick={handleClearAllRead} 
        className="header-btn clear-all"
        disabled={loading}
        title={`Clear ${readCount} read notification${readCount !== 1 ? 's' : ''}`}
      >
        {loading ? '...' : '🗑️ Clear read'}
      </button>
    )}
  </div>
</div>

            {/* Alerts List */}
            <div className="notification-list">
              {alerts.length === 0 ? (
                <div className="no-notifications">
                  <p>🎉 No notifications</p>
                  <span>You're all caught up!</span>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div 
                    key={alert.id} 
                    className={`notification-item ${alert.is_read ? 'read' : 'unread'}`}
                    style={{ borderLeftColor: getAlertColor(alert.alert_type) }}
                  >
                    <div className="notification-icon">
                      {getAlertIcon(alert.alert_type)}
                    </div>
                    <div className="notification-content">
                      <p className="notification-message">{alert.message}</p>
                      <span className="notification-time">{formatTime(alert.created_at)}</span>
                    </div>
                    <div className="notification-actions">
                      {!alert.is_read && (
                        <button
                          onClick={() => handleMarkAsRead(alert.id)}
                          className="btn-icon"
                          title="Mark as read"
                        >
                          ✓
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(alert.id)}
                        className="btn-icon delete"
                        title="Delete"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
{alerts.length > 0 && (
  <div className="notification-footer">
    <div className="footer-info">
      <span className="alert-count">
        {unreadCount} unread • {readCount} read
      </span>
      <span className="cleanup-info">
        Read notifications auto-delete after 30 days
      </span>
    </div>
  </div>
)}
    </div>
  );
};

export default NotificationDropdown;
