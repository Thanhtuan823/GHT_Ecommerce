import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
          <span className="ti-crown" style={{ marginRight: '8px', color: 'var(--color-accent)', fontSize: '20px' }}></span>
          <span style={{ fontWeight: 'bold' }}>GHT Admin</span>
        </div>
        
        <nav className="admin-nav">
          <Link to="/admin/dashboard" className={`admin-nav-item ${isActive('/admin/dashboard')}`}>
            <span className="ti-bar-chart"></span> Dashboard
          </Link>
          <Link to="/admin/products" className={`admin-nav-item ${isActive('/admin/products')}`}>
            <span className="ti-package"></span> Sản phẩm
          </Link>
          <Link to="/admin/discounts" className={`admin-nav-item ${isActive('/admin/discounts')}`}>
            <span className="ti-ticket"></span> Mã giảm giá
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
