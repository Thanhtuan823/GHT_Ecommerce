import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlist } = useWishlist();

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">GHT_Ecom</Link>
        <div className="navbar-menu">
          <Link to="/products">Sản phẩm</Link>
        </div>
        <div className="navbar-actions">
          <Link to="/wishlist" className="btn-ghost" style={{ padding: '8px 12px', border: 'none', background: 'transparent' }}>
            ❤️ {wishlist.length}
          </Link>
          <Link to="/cart" className="btn-ghost" style={{ padding: '8px 12px', border: 'none', background: 'transparent', marginRight: '16px' }}>
            🛒 <span className="badge" style={{ background: 'var(--color-danger)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '12px' }}>{cartCount}</span>
          </Link>
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
              <Link to="/orders" className="btn-ghost">Đơn hàng</Link>
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
