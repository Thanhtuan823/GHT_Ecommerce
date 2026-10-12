import { Link } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../common/ToastContext';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { wishlist, toggleWishlist } = useWishlist();
  const toast = useToast();
  
  if (!product) return null;

  const isWishlisted = wishlist?.some(w => w.id === product.id) || false;
  const isOutOfStock = product.inStock !== undefined && product.inStock <= 0;
  
  // Format currency
  const formatPrice = (val) => {
    if (!val && val !== 0) return '0đ';
    return `${new Intl.NumberFormat('vi-VN').format(val)}đ`;
  };

  // Determine badge
  const renderBadge = () => {
    if (isOutOfStock) {
      return <span className="product-card-badge badge-out-of-stock">Hết hàng</span>;
    }
    if (product.isBestSeller || product.badge === 'bestseller') {
      return <span className="product-card-badge badge-best-seller">Bán chạy</span>;
    }
    if (product.isNew || product.badge === 'new') {
      return <span className="product-card-badge badge-new">Mới</span>;
    }
    if (product.originalPrice && product.originalPrice > product.price) {
      return <span className="product-card-badge badge-discount">Giảm giá</span>;
    }
    return null;
  };

  // Form specs string
  const getSpecsText = () => {
    if (product.specsLine) return product.specsLine;
    const parts = [];
    if (product.cpu) parts.push(product.cpu);
    if (product.ram) parts.push(product.ram);
    if (product.storage) parts.push(product.storage);
    if (parts.length > 0) return parts.join(' • ');
    if (product.category?.name) return `${product.category.name} • Chính hãng`;
    return 'Chính hãng • Bảo hành 24 tháng';
  };

  const handleWishlistClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const wishlisted = await toggleWishlist(product);
    if (wishlisted) {
      toast.success(`Đã thêm "${product.name}" vào yêu thích`);
    } else {
      toast.info(`Đã xóa "${product.name}" khỏi yêu thích`);
    }
  };

  const productUrl = `/products/${product.slug || product.id}`;
  const imageUrl = product.images && product.images.length > 0 ? product.images[0] : '/images/premium.png';

  const rating = product.avgRating ? product.avgRating.toFixed(1) : (product.rating ? Number(product.rating).toFixed(1) : '5.0');
  const reviewCount = product.reviewCount || 0;

  return (
    <article className="product-card">
      {/* Image Area (Height 160px, bg #F5F7FA) */}
      <div className="product-card-image-box">
        {renderBadge()}
        <Link to={productUrl} className="product-card-image-link" tabIndex={-1}>
          <img 
            src={imageUrl} 
            alt={product.name} 
            className="product-card-image"
            loading="lazy"
          />
        </Link>
      </div>

      {/* Content Area */}
      <div className="product-card-content">
        <span className="product-card-brand">{product.brand || 'GHT'}</span>
        <Link to={productUrl} className="product-card-name" title={product.name}>
          {product.name}
        </Link>
        <div className="product-card-specs" title={getSpecsText()}>
          {getSpecsText()}
        </div>
      </div>

      {/* Footer Area */}
      <div className="product-card-footer">
        <div className="product-card-price-row">
          <div className="product-card-prices">
            <span className="product-card-price">{formatPrice(product.price)}</span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="product-card-original-price">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          
          <button 
            type="button"
            className={`product-card-wishlist-btn ${isWishlisted ? 'is-active' : ''}`}
            onClick={handleWishlistClick}
            aria-label={isWishlisted ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
            title={isWishlisted ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
          >
            {isWishlisted ? <i className="ti ti-heart-filled"></i> : <i className="ti ti-heart"></i>}
          </button>
        </div>

        <div className="product-card-meta-row">
          <span className={`product-card-stock ${isOutOfStock ? 'is-out' : ''}`}>
            {isOutOfStock ? 'Tạm hết hàng' : 'Còn hàng • Giao nhanh'}
          </span>
          <span className="product-card-rating">
            <i className="ti ti-star-filled" style={{color:'#F59E0B'}}></i> {rating} ({reviewCount})
          </span>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
