import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Trash2, CheckCheck, AlertTriangle } from 'lucide-react';
import { alertService, BudgetAlert } from '../../services/alertService';
import { theme } from '../../theme';

const NotificationDropdown: React.FC = () => {
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readCount, setReadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Track whether cleanup has already run this session
  const cleanupDoneRef = useRef(false);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setConfirmClear(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAlerts = async () => {
    try {
      // Run cleanup only once per session, not on every 30-second poll
      if (!cleanupDoneRef.current) {
        cleanupDoneRef.current = true;
        alertService.cleanupOldAlerts().catch(err =>
          console.error('Cleanup failed:', err)
        );
      }
      const [allAlerts, unreadCnt, readCnt] = await Promise.all([
        alertService.getAlerts(),
        alertService.getUnreadCount(),
        alertService.getReadCount(),
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
      await loadAlerts();
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
      await loadAlerts();
    } catch (error) {
      console.error('Error deleting alert:', error);
    }
  };

  const handleClearAllRead = async () => {
    // Use inline confirmation instead of window.confirm (blocked in PWA standalone mode)
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    try {
      setLoading(true);
      setConfirmClear(false);
      await alertService.clearAllRead();
      await loadAlerts();
    } catch (error) {
      console.error('Error clearing read alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Alert type → colour ──────────────────────────────
  const getAlertColor = (type: BudgetAlert['alert_type']) => {
    switch (type) {
      case 'warning':  return theme.colors.warning;
      case 'exceeded': return theme.colors.expense;
      case 'expired':  return theme.colors.textSecondary;
      case 'renewed':  return theme.colors.income;
      default:         return theme.colors.info;
    }
  };

  // ── Alert type → label ───────────────────────────────
  const getAlertLabel = (type: BudgetAlert['alert_type']) => {
    switch (type) {
      case 'warning':  return 'Warning';
      case 'exceeded': return 'Exceeded';
      case 'expired':  return 'Expired';
      case 'renewed':  return 'Renewed';
      default:         return 'Info';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-IN');
  };

  return (
    <div
      ref={dropdownRef}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {/* ── Bell Button ──────────────────────────────── */}
      <button
        onClick={() => { setIsOpen(prev => !prev); setConfirmClear(false); }}
        aria-label="Notifications"
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          position: 'relative',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          borderRadius: theme.radius.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.colors.textSecondary,
        }}
      >
        <Bell
          size={20}
          color={isOpen ? theme.colors.primary : theme.colors.textSecondary}
        />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              backgroundColor: theme.colors.expense,
              color: '#fff',
              fontSize: '10px',
              fontWeight: theme.fontWeights.bold,
              borderRadius: theme.radius.pill,
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              fontFamily: theme.fontFamily.base,
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Dropdown ─────────────────────────────────── */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          style={{
            position: 'absolute',
            top: '40px',
            right: 0,
            width: '340px',
            backgroundColor: theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.radius.xl,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 300,
            overflow: 'hidden',
            fontFamily: theme.fontFamily.base,
          }}
        >

          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            borderBottom: `1px solid ${theme.colors.borderSubtle}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                color: theme.colors.textPrimary,
                fontSize: theme.fontSizes.body,
                fontWeight: theme.fontWeights.semibold,
              }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span style={{
                  backgroundColor: theme.colors.primaryLight,
                  color: theme.colors.primary,
                  fontSize: '11px',
                  fontWeight: theme.fontWeights.semibold,
                  padding: '2px 8px',
                  borderRadius: theme.radius.pill,
                }}>
                  {unreadCount} new
                </span>
              )}
            </div>

            {/* Header actions */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  aria-label="Mark all notifications as read"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'none',
                    border: 'none',
                    color: theme.colors.primary,
                    fontSize: '11px',
                    fontWeight: theme.fontWeights.medium,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: theme.radius.md,
                    fontFamily: theme.fontFamily.base,
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              {readCount > 0 && (
                confirmClear ? (
                  // Inline confirmation — replaces window.confirm (blocked in PWA mode)
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: theme.colors.textMuted }}>Sure?</span>
                    <button
                      onClick={handleClearAllRead}
                      disabled={loading}
                      style={{
                        background: theme.colors.expense,
                        color: '#fff',
                        border: 'none',
                        borderRadius: theme.radius.sm,
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: theme.fontWeights.semibold,
                        cursor: 'pointer',
                        fontFamily: theme.fontFamily.base,
                      }}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmClear(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: theme.colors.textMuted,
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontFamily: theme.fontFamily.base,
                        padding: '3px 4px',
                      }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleClearAllRead}
                    disabled={loading}
                    aria-label={`Clear ${readCount} read notifications`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'none',
                      border: 'none',
                      color: theme.colors.textSecondary,
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      borderRadius: theme.radius.md,
                      fontFamily: theme.fontFamily.base,
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={13} />
                    Clear read
                  </button>
                )
              )}
            </div>
          </div>

          {/* Alert List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center' }}>
                <Bell size={28} color={theme.colors.border} style={{ marginBottom: '10px' }} />
                <p style={{
                  color: theme.colors.textPrimary,
                  fontSize: theme.fontSizes.body,
                  fontWeight: theme.fontWeights.medium,
                  margin: '0 0 4px',
                }}>
                  All caught up
                </p>
                <span style={{ color: theme.colors.textMuted, fontSize: theme.fontSizes.caption }}>
                  No notifications right now
                </span>
              </div>
            ) : (
              alerts.map((alert, i) => (
                <div
                  key={alert.id}
                  role="listitem"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: alert.is_read
                      ? 'transparent'
                      : `${theme.colors.primaryLight}60`,
                    borderBottom: i < alerts.length - 1
                      ? `1px solid ${theme.colors.borderSubtle}`
                      : 'none',
                    borderLeft: `3px solid ${getAlertColor(alert.alert_type)}`,
                    transition: theme.transition.fast,
                  }}
                >
                  {/* Colour dot */}
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getAlertColor(alert.alert_type),
                    marginTop: '5px',
                    flexShrink: 0,
                  }} />

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'inline-block',
                      backgroundColor: `${getAlertColor(alert.alert_type)}18`,
                      color: getAlertColor(alert.alert_type),
                      fontSize: '10px',
                      fontWeight: theme.fontWeights.semibold,
                      padding: '2px 7px',
                      borderRadius: theme.radius.pill,
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.4px',
                    }}>
                      {getAlertLabel(alert.alert_type)}
                    </span>
                    <p style={{
                      color: alert.is_read ? theme.colors.textSecondary : theme.colors.textPrimary,
                      fontSize: theme.fontSizes.label,
                      fontWeight: alert.is_read ? theme.fontWeights.regular : theme.fontWeights.medium,
                      margin: '0 0 3px',
                      lineHeight: 1.4,
                    }}>
                      {alert.message}
                    </p>
                    <span style={{ color: theme.colors.textMuted, fontSize: '11px' }}>
                      {formatTime(alert.created_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    {!alert.is_read && (
                      <button
                        onClick={() => handleMarkAsRead(alert.id)}
                        aria-label="Mark as read"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: theme.radius.sm,
                          display: 'flex',
                          color: theme.colors.primary,
                        }}
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      aria-label="Delete notification"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: theme.radius.sm,
                        display: 'flex',
                        color: theme.colors.textMuted,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div style={{
              padding: '10px 16px',
              borderTop: `1px solid ${theme.colors.borderSubtle}`,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span style={{ color: theme.colors.textMuted, fontSize: '11px' }}>
                {unreadCount} unread · {readCount} read
              </span>
              <span style={{ color: theme.colors.textMuted, fontSize: '11px' }}>
                Auto-clears after 30 days
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
