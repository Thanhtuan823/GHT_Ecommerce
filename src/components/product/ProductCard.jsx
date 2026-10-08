import { Link } from 'react-router-dom';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  return (
    <div className="product-card">
      <div className="product-card-image">
        <img 
          src={product.images && product.images.length > 0 ? product.images[0] : '/images/premium.png'} 
          alt={product.name} 
        />
        {product.inStock <= 0 && <span className="badge badge-sale">Hết hàng</span>}
      </div>
      <div className="product-card-content">
        <div className="product-brand">{product.brand || 'Khác'}</div>
        <Link to={`/products/${product.slug}`} className="product-name" title={product.name}>
          {product.name}
        </Link>
        <div className="product-price">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}</div>
        <div className="product-footer">
          <span className="product-rating">⭐ {product.avgRating?.toFixed(1) || '0.0'} ({product.reviewCount})</span>
          <button className="btn-primary btn-sm" disabled={product.inStock <= 0}>Thêm giỏ</button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
