import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import axiosClient from '../../utils/axiosClient';
import './Navbar.css';

const DEFAULT_CATEGORIES = [
  { id: '1', name: 'Laptop', description: 'Máy tính xách tay' },
  { id: '2', name: 'PC & Màn hình', description: 'Dàn PC hiệu năng cao & màn hình đồ họa' },
  { id: '3', name: 'Điện thoại', description: 'Smartphone flagship & gaming phone chính hãng' },
  { id: '4', name: 'Phụ kiện', description: 'Chuột, bàn phím cơ, tai nghe & củ cáp sạc' }
];

const getCategoryIcon = (catName = '') => {
  const lower = catName.toLowerCase();
  if (lower.includes('laptop')) return 'ti-device-laptop';
  if (lower.includes('pc') || lower.includes('màn hình') || lower.includes('máy tính')) return 'ti-device-desktop';
  if (lower.includes('điện thoại') || lower.includes('phone') || lower.includes('mobile')) return 'ti-device-mobile';
  if (lower.includes('phụ kiện') || lower.includes('tai nghe') || lower.includes('chuột') || lower.includes('bàn phím')) return 'ti-headphones';
  if (lower.includes('linh kiện') || lower.includes('cpu') || lower.includes('vga') || lower.includes('ram')) return 'ti-cpu';
  return 'ti-device-laptop';
};

const Navbar = () => {
  const { user, logout, openProfileModal, openVouchersModal } = useAuth();
  const { cartCount } = useCart();
  const { wishlist } = useWishlist();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Category dropdown states
  const [categories, setCategories] = useState([]);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryRef = useRef(null);
  const catTimeoutRef = useRef(null);

  // Fetch categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosClient.get('/categories');
        if (res.data && res.data.length > 0) {
          setCategories(res.data);
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      } catch {
        setCategories(DEFAULT_CATEGORIES);
      }
    };
    fetchCategories();
  }, []);

  // Close user dropdown & category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target)) {
        setCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleCategoryMouseEnter = () => {
    if (catTimeoutRef.current) clearTimeout(catTimeoutRef.current);
    setCategoryDropdownOpen(true);
  };

  const handleCategoryMouseLeave = () => {
    catTimeoutRef.current = setTimeout(() => {
      setCategoryDropdownOpen(false);
    }, 180);
  };

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
        {/* Left: Logo & Category Hover Menu */}
        <div className="navbar-left">
          <Link className="navbar-logo" to="/">
            <img
              src="/images/Logo_GHT.png"
              alt="GHT E-Commerce Logo"
              className="navbar-logo-img"
            />
            <span>GHT_Ecom</span>
          </Link>

          <div
            className="navbar-category-wrapper"
            ref={categoryRef}
            onMouseEnter={handleCategoryMouseEnter}
            onMouseLeave={handleCategoryMouseLeave}
          >
            <button
              type="button"
              className={`navbar-category-btn ${categoryDropdownOpen ? 'is-active' : ''}`}
              onClick={() => setCategoryDropdownOpen((prev) => !prev)}
              aria-expanded={categoryDropdownOpen}
              aria-haspopup="true"
            >
              <i className="ti ti-layout-grid"></i>
              <span>Danh mục</span>
              <i className={`ti ti-chevron-down navbar-category-chevron ${categoryDropdownOpen ? 'is-rotated' : ''}`}></i>
            </button>

            {categoryDropdownOpen && (
              <div className="navbar-category-dropdown" role="menu">
                <div className="category-dropdown-header">
                  <Link
                    to="/products"
                    className="category-dropdown-item category-dropdown-item-all"
                    onClick={() => setCategoryDropdownOpen(false)}
                  >
                    <div className="cat-icon-box">
                      <i className="ti ti-apps"></i>
                    </div>
                    <div className="cat-info">
                      <span className="cat-title">Tất cả sản phẩm</span>
                      <span className="cat-sub">Khám phá toàn bộ thiết bị & phụ kiện</span>
                    </div>
                    <i className="ti ti-chevron-right cat-arrow"></i>
                  </Link>
                </div>

                <div className="category-dropdown-divider" />

                <div className="category-dropdown-list">
                  {categories.map((cat) => (
                    <Link
                      key={cat.id}
                      to={`/products?category=${cat.id}`}
                      className="category-dropdown-item"
                      onClick={() => setCategoryDropdownOpen(false)}
                    >
                      <div className="cat-icon-box">
                        <i className={`ti ${getCategoryIcon(cat.name)}`}></i>
                      </div>
                      <div className="cat-info">
                        <span className="cat-title">{cat.name}</span>
                        {cat.description && <span className="cat-sub">{cat.description}</span>}
                      </div>
                      <i className="ti ti-chevron-right cat-arrow"></i>
                    </Link>
                  ))}
                </div>

                <div className="category-dropdown-divider" />

                <div className="category-dropdown-footer">
                  <button
                    type="button"
                    className="category-dropdown-ai-btn"
                    onClick={() => {
                      setCategoryDropdownOpen(false);
                      window.dispatchEvent(new CustomEvent('open-ght-chatbot'));
                    }}
                  >
                    <i className="ti ti-sparkles"></i>
                    <span>✦ Tư vấn chọn máy với AI</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Search Bar */}
        <form className="navbar-search-form" onSubmit={handleSearchSubmit}>
          <i className="ti ti-search navbar-search-icon"></i>
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
            <i className="ti ti-heart"></i>
            {wishlist.length > 0 && (
              <span className="navbar-badge">{wishlist.length}</span>
            )}
          </Link>

          {/* Cart */}
          <Link to="/cart" className="navbar-icon-btn" title="Giỏ hàng">
            <i className="ti ti-shopping-cart"></i>
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
                id="user-profile-btn"
                type="button"
                className="user-profile-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setDropdownOpen((prev) => !prev);
                }}
              >
                <div className="user-avatar-circle">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.name} className="user-avatar-img" />
                  ) : (
                    getInitials(user.name)
                  )}
                </div>
                <span className="user-name-text">{user.name}</span>
                <i className="ti ti-chevron-down user-dropdown-icon"></i>
              </button>

              {dropdownOpen && (
                <div className="user-dropdown-menu" id="user-dropdown-menu">
                  <div className="user-dropdown-header">
                    <div className="user-name-text">{user.name}</div>
                    <div className="user-dropdown-email">{user.email}</div>
                  </div>

                  <button
                    id="user-menu-profile"
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      openProfileModal();
                    }}
                  >
                    <i className="ti ti-user"></i>
                    <span>Hồ sơ cá nhân</span>
                  </button>

                  <button
                    id="user-menu-vouchers"
                    type="button"
                    className="user-dropdown-item"
                    onClick={() => {
                      setDropdownOpen(false);
                      openVouchersModal();
                    }}
                  >
                    <i className="ti ti-ticket"></i>
                    <span>Ví mã ưu đãi</span>
                  </button>

                  <Link
                    to="/orders"
                    className="user-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <i className="ti ti-package"></i>
                    <span>Đơn hàng của tôi</span>
                  </Link>

                  {(user.role === 'Admin' || user.role === 'Staff') && (
                    <Link
                      to="/admin"
                      className="user-dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="ti ti-settings"></i>
                      <span>Quản trị ({user.role})</span>
                    </Link>
                  )}

                  {(user.role === 'Staff' || user.role === 'Admin') && (
                    <Link
                      to="/staff/orders"
                      className="user-dropdown-item"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="ti ti-clipboard-list"></i>
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
                    <i className="ti ti-logout"></i>
                    <span>Đăng xuất</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Language Toggle */}
          <button type="button" className="lang-toggle-btn">
            <i className="ti ti-world"></i> VI/EN
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

