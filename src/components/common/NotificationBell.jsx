import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import signalRService from '../../services/signalRService';
import './NotificationBell.css';

const getNotificationIcon = (type) => {
  switch (type) {
    case 'ORDER_PLACED':
      return { icon: 'ti-package', className: 'type-order' };
    case 'PAYMENT_SUCCESS':
      return { icon: 'ti-check', className: 'type-payment' };
    case 'ORDER_STATUS':
      return { icon: 'ti-truck', className: 'type-shipping' };
    case 'CHAT_MESSAGE':
      return { icon: 'ti-message-dots', className: 'type-chat' };
    case 'LOW_STOCK':
      return { icon: 'ti-alert-triangle', className: 'type-warning' };
    default:
      return { icon: 'ti-bell', className: 'type-system' };
  }
};

const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.max(0, Math.floor((now - date) / 1000));

  if (diffSec < 60) return 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} ngày trước`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Fetch initial notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await axiosClient.get('/notifications');
      setNotifications(res.data?.data || []);
      setUnreadCount(res.data?.unreadCount || 0);
    } catch (err) {
      console.warn('Lỗi tải thông báo:', err);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();

    // SignalR Realtime Listener
    const handleReceiveNotification = (notif) => {
      setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)].slice(0, 30));
      setUnreadCount((prev) => prev + 1);
    };

    const setupSignalR = async () => {
      try {
        await signalRService.startConnection();
        signalRService.onReceiveNotification(handleReceiveNotification);
      } catch (err) {
        console.warn('Lỗi kết nối SignalR thông báo:', err);
      }
    };

    setupSignalR();

    return () => {
      signalRService.offReceiveNotification(handleReceiveNotification);
    };
  }, [fetchNotifications]);

  // Click outside listener to close popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle click on single notification
  const handleItemClick = async (notif) => {
    setIsOpen(false);

    if (!notif.isRead) {
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await axiosClient.put(`/notifications/${notif.id}/read`);
      } catch (err) {
        console.warn('Lỗi đánh dấu đã đọc:', err);
      }
    }

    if (notif.targetUrl) {
      navigate(notif.targetUrl);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async (e) => {
    e.stopPropagation();
    if (unreadCount === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await axiosClient.put('/notifications/read-all');
    } catch (err) {
      console.warn('Lỗi đánh dấu tất cả đã đọc:', err);
    }
  };

  return (
    <div className="notif-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className={`notif-bell-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Thông báo hệ thống"
        aria-label="Thông báo"
      >
        <i className="ti ti-bell"></i>
        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-popover">
          <div className="notif-popover-header">
            <div className="notif-header-title">
              <span>Thông báo</span>
              {unreadCount > 0 && (
                <span className="notif-header-unread-tag">{unreadCount} mới</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
                title="Đánh dấu tất cả là đã đọc"
              >
                <i className="ti ti-checks"></i> Đã đọc tất cả
              </button>
            )}
          </div>

          <div className="notif-popover-list">
            {loading ? (
              <div className="notif-empty">Đang tải thông báo...</div>
            ) : notifications.length === 0 ? (
              <div className="notif-empty">
                <i className="ti ti-bell-off"></i>
                <p>Hiện tại bạn không có thông báo nào</p>
              </div>
            ) : (
              notifications.map((notif) => {
                const { icon, className } = getNotificationIcon(notif.type);
                return (
                  <div
                    key={notif.id}
                    className={`notif-item ${notif.isRead ? 'is-read' : 'is-unread'}`}
                    onClick={() => handleItemClick(notif)}
                  >
                    <div className={`notif-icon-box ${className}`}>
                      <i className={`ti ${icon}`}></i>
                    </div>

                    <div className="notif-item-body">
                      <div className="notif-item-title-row">
                        <span className="notif-item-title">{notif.title}</span>
                        <span className="notif-item-time">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <div className="notif-item-message">{notif.message}</div>
                    </div>

                    {!notif.isRead && <span className="notif-unread-dot"></span>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
