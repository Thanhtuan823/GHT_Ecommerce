import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">GHT_Ecom</Link>
        <div className="navbar-menu">
          <Link to="/products">Sản phẩm</Link>
        </div>
        <div className="navbar-actions">
          {!user ? (
            <>
              <Link to="/login" className="btn-ghost">Đăng nhập</Link>
              <Link to="/register" className="btn-primary">Đăng ký</Link>
            </>
          ) : (
            <div className="user-menu">
              {user.avatar && <img src={user.avatar} alt="Avatar" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />}
              <span>{user.name}</span>
              <span style={{ fontSize: '12px', background: 'var(--color-bg-muted)', padding: '2px 6px', borderRadius: '4px' }}>{user.role}</span>
              <Link to="/profile" className="btn-ghost">Hồ sơ</Link>
              {(user.role === 'Admin' || user.role === 'Staff') && (
                <Link to="/admin" className="btn-primary">Admin</Link>
              )}
              <button onClick={logout} className="btn-danger">Đăng xuất</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
