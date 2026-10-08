import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist } = useWishlist();
  
  const isWishlisted = wishlist.some(w => w.id === product.id);

  const handleAddToCart = async () => {
    const success = await addToCart(product, 1);
    if (success) {
      // Could show toast here, but alert is handled in Context
    }
  };

  const handleToggleWishlist = async () => {
    await toggleWishlist(product);
  };
  return (
    <div className="product-card">
      <div className="product-card-image" style={{ position: 'relative' }}>
        <img 
          src={product.images && product.images.length > 0 ? product.images[0] : '/images/premium.png'} 
          alt={product.name} 
        />
        {product.inStock <= 0 && <span className="badge badge-sale">Hết hàng</span>}
        <button 
          onClick={handleToggleWishlist}
          style={{
            position: 'absolute', top: '8px', right: '8px', 
            background: 'white', border: 'none', borderRadius: '50%', 
            width: '32px', height: '32px', cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)', color: isWishlisted ? 'var(--color-danger)' : 'var(--color-text-muted)'
          }}
        >
          {isWishlisted ? '❤️' : '🤍'}
        </button>
      </div>
      <div className="product-card-content">
        <div className="product-brand">{product.brand || 'Khác'}</div>
        <Link to={`/products/${product.slug}`} className="product-name" title={product.name}>
          {product.name}
        </Link>
        <div className="product-price">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}</div>
        <div className="product-footer">
          <span className="product-rating">⭐ {product.avgRating?.toFixed(1) || '0.0'} ({product.reviewCount})</span>
          <button className="btn-primary btn-sm" disabled={product.inStock <= 0} onClick={handleAddToCart}>Thêm giỏ</button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
