import { useState, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Sidebar collapse toggle state (false: 240px expanded, true: 64px compact icon-only)
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => (location.pathname.startsWith(path) ? 'active' : '');

  // Dynamic breadcrumb text mapping
  const breadcrumbText = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/admin/dashboard')) return 'Dashboard Báo cáo & Thống kê';
    if (path.includes('/admin/products')) return 'Quản lý Sản phẩm';
    if (path.includes('/admin/discounts')) return 'Quản lý Mã giảm giá';
    if (path.includes('/admin/users')) return 'Quản lý Người dùng & Phân quyền';
    if (path.includes('/staff/orders')) return 'Không gian Vận hành Đơn hàng';
    if (path.includes('/staff/chat') || path.includes('/admin/chat')) return 'Tư vấn trực tuyến (Live Chat)';
    return 'Trung tâm Quản trị';
  }, [location.pathname]);

  const isStaff = user?.role === 'Staff';
  const isAdmin = user?.role === 'Admin';

  const getInitials = (name) => {
    if (!name) return 'GH';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className={`admin-layout ${isCollapsed ? 'is-collapsed' : ''}`}>
      {/* 1. SIDEBAR */}
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <Link to={isAdmin ? '/admin/dashboard' : '/staff/orders'} className="admin-brand-link">
            <div className="admin-brand-icon">
              <img
                src="/images/Logo_GHT.png"
                alt="Admin Logo"
                className="admin-brand-logo-img"
                style={{ width: '46px', height: '46px', display: 'block' }}
              />
            </div>
            {!isCollapsed && <span className="admin-brand-title">GHT Central</span>}
          </Link>
        </div>

        <nav className="admin-nav">
          {/* Menu cho Admin */}
          {isAdmin && (
            <Link
              to="/admin/dashboard"
              className={`admin-nav-item ${isActive('/admin/dashboard')}`}
              title="Dashboard Thống kê"
            >
              <i className="ti ti-chart-bar"></i>
              {!isCollapsed && <span>Dashboard</span>}
            </Link>
          )}

          {/* Vận hành đơn hàng (Cả Admin và Staff) */}
          <Link
            to="/staff/orders"
            className={`admin-nav-item ${isActive('/staff/orders')}`}
            title="Vận hành đơn hàng"
          >
            <i className="ti ti-truck"></i>
            {!isCollapsed && <span>Vận hành đơn hàng</span>}
          </Link>

          {/* Sản phẩm (Admin và Staff) */}
          <Link
            to="/admin/products"
            className={`admin-nav-item ${isActive('/admin/products')}`}
            title="Kho sản phẩm"
          >
            <i className="ti ti-package"></i>
            {!isCollapsed && <span>{isStaff ? 'Kho sản phẩm' : 'Sản phẩm'}</span>}
          </Link>

          {/* Tư vấn trực tuyến (Admin và Staff) */}
          <Link
            to="/staff/chat"
            className={`admin-nav-item ${isActive('/staff/chat') || isActive('/admin/chat')}`}
            title="Tư vấn trực tuyến"
          >
            <i className="ti ti-messages"></i>
            {!isCollapsed && <span>Tư vấn trực tuyến</span>}
          </Link>

          {/* Mã giảm giá (Admin) */}
          {isAdmin && (
            <Link
              to="/admin/discounts"
              className={`admin-nav-item ${isActive('/admin/discounts')}`}
              title="Mã giảm giá"
            >
              <i className="ti ti-ticket"></i>
              {!isCollapsed && <span>Mã giảm giá</span>}
            </Link>
          )}

          {/* Người dùng (Admin) */}
          {isAdmin && (
            <Link
              to="/admin/users"
              className={`admin-nav-item ${isActive('/admin/users')}`}
              title="Người dùng & Phân quyền"
            >
              <i className="ti ti-users"></i>
              {!isCollapsed && <span>Người dùng</span>}
            </Link>
          )}
        </nav>

        {/* Chân Sidebar */}
        <div className="admin-sidebar-footer">
          <Link to="/" className="admin-nav-item btn-back-store" title="Về trang chủ cửa hàng">
            <i className="ti ti-home"></i>
            {!isCollapsed && <span>Về cửa hàng</span>}
          </Link>
        </div>
      </aside>

      {/* 2. MAIN WRAPPER */}
      <div className="admin-main-wrapper">
        {/* TOP-BAR HEADER */}
        <header className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              type="button"
              className="admin-hamburger-btn"
              onClick={() => setIsCollapsed((prev) => !prev)}
              title={isCollapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
            >
              <i className={`ti ${isCollapsed ? 'ti-layout-sidebar-left-expand' : 'ti-layout-sidebar-left-collapse'}`}></i>
            </button>

            <div className="admin-breadcrumb-box">
              <span className="admin-breadcrumb-root">Hệ thống</span>
              <span className="admin-breadcrumb-sep">/</span>
              <span className="admin-breadcrumb-current">{breadcrumbText}</span>
            </div>
          </div>

          <div className="admin-topbar-right">
            <div className="admin-profile-widget">
              <div className="admin-avatar-circle">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="admin-avatar-img" />
                ) : (
                  getInitials(user?.name)
                )}
              </div>

              <div className="admin-profile-info">
                <span className="admin-profile-name">{user?.name || 'Nhân sự'}</span>
                <span className={`admin-role-badge ${isAdmin ? 'badge-admin' : 'badge-staff'}`}>
                  {user?.role || 'Staff'}
                </span>
              </div>

              <button
                type="button"
                className="admin-logout-btn"
                onClick={handleLogout}
                title="Đăng xuất khỏi hệ thống"
              >
                <i className="ti ti-logout"></i>
                <span className="logout-text">Đăng xuất</span>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENT OUTLET */}
        <main className="admin-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
