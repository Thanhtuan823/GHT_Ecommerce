import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AdminLayout.css';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path) ? 'active' : '';

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <i className="ti ti-crown" style={{ marginRight: '8px', color: 'var(--color-accent)', fontSize: '20px' }}></i>
          <span style={{ fontWeight: 'bold' }}>GHT Admin</span>
        </div>
        
        <nav className="admin-nav">
          <Link to="/admin/dashboard" className={`admin-nav-item ${isActive('/admin/dashboard')}`}>
            <i className="ti ti-chart-bar"></i> Dashboard
          </Link>
          <Link to="/admin/products" className={`admin-nav-item ${isActive('/admin/products')}`}>
            <i className="ti ti-package"></i> Sản phẩm
          </Link>
          <Link to="/admin/discounts" className={`admin-nav-item ${isActive('/admin/discounts')}`}>
            <i className="ti ti-ticket"></i> Mã giảm giá
          </Link>
          <Link to="/staff/orders" className={`admin-nav-item ${isActive('/staff/orders')}`}>
            <i className="ti ti-truck"></i> Vận hành đơn hàng
          </Link>
        </nav>
        
        <div className="admin-user">
          <div style={{ fontSize: '13px', marginBottom: '8px', fontWeight: '500' }}>{user?.name}</div>
          <button onClick={handleLogout} className="btn-ghost" style={{ width: '100%', fontSize: '12px' }}>Đăng xuất</button>
        </div>
      </aside>
      
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
