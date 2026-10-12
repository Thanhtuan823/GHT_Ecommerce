import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const { wishlist } = useWishlist();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm.trim())}`);
    } else {
      navigate('/products');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'GH';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left: Logo & Category */}
        <div className="navbar-left">
          <Link to="/" className="navbar-logo">
            <span className="navbar-logo-icon">G</span>
            <span>GHT_Ecom</span>
          </Link>
          <Link to="/products" className="navbar-category-btn">
            <span>≡</span>
            <span>Danh mục</span>
          </Link>
        </div>

        {/* Center: Search Bar */}
        <form className="navbar-search-form" onSubmit={handleSearchSubmit}>
          <span className="navbar-search-icon">🔍</span>
          <input
            type="text"
            className="navbar-search-input"
            placeholder="Ví dụ: Dell XPS 15, MacBook M3..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </form>

        {/* Right: Actions & User */}
        <div className="navbar-actions">
          {/* Wishlist */}
          <Link to="/wishlist" className="navbar-icon-btn" title="Yêu thích">
            <span>♡</span>
            {wishlist.length > 0 && (
              <span className="navbar-badge">{wishlist.length}</span>
            )}
          </Link>

          {/* Cart */}
          <Link to="/cart" className="navbar-icon-btn" title="Giỏ hàng">
            <span>🛒</span>
            {cartCount > 0 && (
              <span className="navbar-badge">{cartCount}</span>
            )}
          </Link>

          {/* User Account or Auth Buttons */}
          {!user ? (
            <>
              <Link to="/login" className="btn-ghost">Đăng nhập</Link>
              <Link to="/register" className="btn-primary">Đăng ký</Link>
            </>
          ) : (
            <div className="user-profile-wrapper" ref={dropdownRef}>
              <button
                type="button"
                className="user-profile-btn"
                onClick={() => setDropdownOpen((prev) => !prev)}
              >
                <div className="user-avatar-circle">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="user-avatar-img" />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <span className="user-name-text">{user.name}</span>
                <span className="user-dropdown-icon">▾</span>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div className="user-name-text">{user.name}</div>
                    <div className="user-dropdown-email">{user.email}</div>
                  </div>

                  <Link
                    to="/profile"
                    className="user-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span>👤</span>
                    <span>Hồ sơ cá nhân</span>
                  </Link>

                  <Link
                    to="/orders"
                    className="user-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <span>📦</span>
                    <span>Đơn hàng của tôi</span>
                  </Link>

                  {(user.role === 'Admin' || user.role === 'Staff') && (
                    <Link
                      to="/admin"
                      className="user-dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>⚙️</span>
                      <span>Quản trị ({user.role})</span>
                    </Link>
                  )}

                  {(user.role === 'Staff' || user.role === 'Admin') && (
                    <Link
                      to="/staff/orders"
                      className="user-dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span>📋</span>
                      <span>Vận hành đơn hàng</span>
                    </Link>
                  )}

                  <div className="user-dropdown-divider" />

                  <button
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                  >
                    <span>🚪</span>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Language Toggle */}
          <button type="button" className="lang-toggle-btn">
            VI/EN
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

