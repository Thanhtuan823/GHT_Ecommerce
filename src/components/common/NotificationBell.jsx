import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import signalRService from '../../services/signalRService';
import { useAuth } from '../../context/AuthContext';
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
  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL' | 'UNREAD'
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();

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
    // 1. Đóng popover
    setIsOpen(false);

    // 2. Loại bỏ thông báo vừa nhấn ra khỏi danh sách hiển thị ngay lập tức & giảm unread badge
    setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
    if (!notif.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // 3. Gọi ngầm API cập nhật đã đọc (fire-and-forget)
    axiosClient.put(`/notifications/${notif.id}/read`).catch((err) => {
      console.warn('Lỗi đánh dấu đã đọc:', err);
    });

    // 4. Bóc tách productId từ metadata hoặc targetUrl
    let targetUrl = notif.targetUrl || '/admin/products';
    let productId = null;

    if (notif.metadata) {
      try {
        const meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata;
        productId = meta?.productId;
      } catch (e) {}
    }

    if (!productId && targetUrl.includes('editId=')) {
      const match = targetUrl.match(/editId=(\d+)/);
      if (match) productId = match[1];
    }

    // 5. Điều hướng hoặc kích hoạt mở Modal ngay tại trang hiện tại
    if (notif.type === 'LOW_STOCK') {
      if (productId) {
        navigate(`/admin/products?editId=${productId}`);
      } else {
        navigate('/admin/products');
      }
      return;
    }

    // Parse orderId from metadata hoặc targetUrl
    let orderId = null;
    if (notif.metadata) {
      try {
        const meta = typeof notif.metadata === 'string' ? JSON.parse(notif.metadata) : notif.metadata;
        orderId = meta?.orderId;
      } catch {
        orderId = null;
      }
    }
    if (!orderId && targetUrl) {
      const match = targetUrl.match(/\/orders\/(\d+)/);
      if (match) orderId = match[1];
    }

    const isStaffOrAdmin = user?.role === 'Staff' || user?.role === 'Admin';

    if (notif.type === 'ORDER_PLACED' || notif.type === 'ORDER_STATUS' || notif.type === 'PAYMENT_SUCCESS') {
      if (isStaffOrAdmin) {
        if (orderId) {
          navigate(`/staff/orders?highlightOrder=${orderId}`);
        } else {
          navigate('/staff/orders');
        }
      } else {
        if (orderId) {
          navigate(`/orders/${orderId}`);
        } else {
          navigate(targetUrl || '/orders');
        }
      }
    } else if (notif.type === 'CHAT_MESSAGE') {
      navigate('/staff/chat');
    } else if (targetUrl) {
      navigate(targetUrl);
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

          {/* Bộ lọc tab: Tất cả / Chưa đọc */}
          <div className="notif-tab-filter-bar" style={{ display: 'flex', gap: '8px', padding: '6px 16px', borderBottom: '1px solid var(--color-border)', backgroundColor: '#fafbfd' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilterTab('ALL'); }}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '12px',
                border: filterTab === 'ALL' ? '1px solid #3b82f6' : '1px solid var(--color-border)',
                backgroundColor: filterTab === 'ALL' ? '#eff6ff' : '#ffffff',
                color: filterTab === 'ALL' ? '#2563eb' : 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              Tất cả ({notifications.length})
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilterTab('UNREAD'); }}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '12px',
                border: filterTab === 'UNREAD' ? '1px solid #3b82f6' : '1px solid var(--color-border)',
                backgroundColor: filterTab === 'UNREAD' ? '#eff6ff' : '#ffffff',
                color: filterTab === 'UNREAD' ? '#2563eb' : 'var(--color-text-secondary)',
                cursor: 'pointer'
              }}
            >
              Chưa đọc ({notifications.filter((n) => !n.isRead).length})
            </button>
          </div>

          <div className="notif-popover-list">
            {loading ? (
              <div className="notif-empty">Đang tải thông báo...</div>
            ) : (filterTab === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications).length === 0 ? (
              <div className="notif-empty">
                <i className="ti ti-bell-off"></i>
                <p>{filterTab === 'UNREAD' ? 'Không có thông báo chưa đọc' : 'Hiện tại bạn không có thông báo nào'}</p>
              </div>
            ) : (
              (filterTab === 'UNREAD' ? notifications.filter((n) => !n.isRead) : notifications).map((notif) => {
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
