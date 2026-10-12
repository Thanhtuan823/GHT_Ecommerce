import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useToast } from '../../components/common/ToastContext';
import axiosClient from '../../utils/axiosClient';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './ProductDetail.css';

const DEFAULT_SPECS_FALLBACK = [
  { label: 'Bộ xử lý (CPU)', value: 'Intel Core i5-1335U (10 nhân, 12 luồng, up to 4.6GHz)' },
  { label: 'Bộ nhớ RAM', value: '16GB DDR4 3200MHz (Hỗ trợ nâng cấp tối đa 32GB)' },
  { label: 'Ổ cứng lưu trữ', value: '512GB M.2 NVMe PCIe 3.0 SSD' },
  { label: 'Màn hình', value: '15.6 inch FHD (1920 x 1080) 60Hz, Anti-glare, 250 nits' },
  { label: 'Đồ họa', value: 'Intel Iris Xe Graphics' },
  { label: 'Cổng kết nối', value: '1x USB-C 3.2, 2x USB-A 3.2, 1x HDMI 1.4, Audio Combo Jack' },
  { label: 'Trọng lượng & Pin', value: '1.7 kg • Pin 3 Cells 42WHr' },
  { label: 'Hệ điều hành', value: 'Windows 11 Home bản quyền' }
];

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { wishlist, toggleWishlist } = useWishlist();
  const toast = useToast();

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Gallery state
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);

  // Variant states
  const [selectedColor, setSelectedColor] = useState('Bạc');
  const [selectedConfig, setSelectedConfig] = useState('16GB / 512GB');
  const [quantity, setQuantity] = useState(1);

  // Action states
  const [isAddingCart, setIsAddingCart] = useState(false);
  const [isBuyingNow, setIsBuyingNow] = useState(false);

  // Review states
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  useEffect(() => {
    const fetchProduct = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await axiosClient.get(`/products/slug/${slug}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Không tìm thấy sản phẩm');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProduct();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="product-detail-page">
        <div className="product-breadcrumb">
          <div className="skeleton detail-skeleton-breadcrumb" />
        </div>

        <div className="product-detail-top-section">
          <div className="skeleton detail-skeleton-gallery" />
          <div className="detail-skeleton-info">
            <div className="skeleton" style={{ width: '140px', height: '24px' }} />
            <div className="skeleton" style={{ width: '80%', height: '32px' }} />
            <div className="skeleton" style={{ width: '45%', height: '24px' }} />
            <div className="skeleton" style={{ width: '60%', height: '40px' }} />
            <div className="skeleton" style={{ width: '100%', height: '80px' }} />
            <div className="skeleton" style={{ width: '100%', height: '48px' }} />
          </div>
        </div>

        <div className="product-detail-bottom-section">
          <div className="skeleton detail-skeleton-box-bottom" />
          <div className="skeleton detail-skeleton-box-bottom" />
        </div>
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="product-detail-page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <h3 className="empty-state-title">Không tìm thấy sản phẩm</h3>
          <p className="empty-state-desc">{error || 'Sản phẩm bạn đang tìm không tồn tại hoặc đã ngừng kinh doanh.'}</p>
          <Link to="/products" className="btn-primary">
            Quay lại danh sách sản phẩm
          </Link>
        </div>
      </div>
    );
  }

  const { product, reviews = [] } = data;
  const isWishlisted = wishlist?.some((w) => w.id === product.id) || false;
  const inStock = product.inStock ?? 24;
  const maxStock = Math.max(1, inStock);

  // Gallery images with 4 thumbnails guarantee
  const images = (product.images && product.images.length > 0)
    ? product.images
    : ['/images/premium.png', '/images/premium.png', '/images/premium.png', '/images/premium.png'];
  
  // Fill up to at least 4 thumbnails for visual completeness
  const galleryThumbnails = images.length >= 4 
    ? images.slice(0, 4) 
    : [...images, ...Array(4 - images.length).fill(images[0] || '/images/premium.png')];

  // Pricing calculations
  const originalPrice = product.originalPrice || Math.round(product.price * 1.1);
  const hasDiscount = originalPrice > product.price;
  const discountPercent = hasDiscount
    ? Math.round(((originalPrice - product.price) / originalPrice) * 100)
    : 0;

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val)}đ`;

  // Spec tags
  const specTags = product.tags && product.tags.length > 0
    ? product.tags
    : ['Intel Core i5-1335U', 'RAM 16GB', 'SSD 512GB', '15.6" FHD 60Hz'];

  // Specs table rows
  const specsRows = product.specs && typeof product.specs === 'object' && Object.keys(product.specs).length > 0
    ? Object.entries(product.specs).map(([label, value]) => ({ label, value: String(value) }))
    : DEFAULT_SPECS_FALLBACK;

  // Handlers
  const handleIncrease = () => {
    if (quantity < maxStock) setQuantity((prev) => prev + 1);
  };

  const handleDecrease = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  const handleAddToCart = async () => {
    if (inStock <= 0) return;
    setIsAddingCart(true);
    try {
      const success = await addToCart(product, quantity);
      if (success) {
        toast.success(`Đã thêm ${quantity} sản phẩm vào giỏ hàng!`);
      }
    } finally {
      setIsAddingCart(false);
    }
  };

  const handleBuyNow = async () => {
    if (inStock <= 0) return;
    setIsBuyingNow(true);
    try {
      await addToCart(product, quantity);
      navigate('/checkout');
    } finally {
      setIsBuyingNow(false);
    }
  };

  const handleWishlistClick = async () => {
    const wishlisted = await toggleWishlist(product);
    if (wishlisted) {
      toast.success(`Đã thêm "${product.name}" vào yêu thích`);
    } else {
      toast.info(`Đã xóa "${product.name}" khỏi yêu thích`);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      setReviewError('Vui lòng nhập nội dung đánh giá');
      return;
    }

    setIsSubmittingReview(true);
    setReviewError('');
    try {
      await axiosClient.post(`/products/${product.id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment
      });
      toast.success('Đánh giá sản phẩm thành công!');
      setReviewComment('');
      setShowReviewForm(false);
      // Reload product data
      const res = await axiosClient.get(`/products/slug/${slug}`);
      setData(res.data);
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const skuCode = product.sku || (product.slug ? product.slug.toUpperCase() : 'GHT-PRD-01');

  return (
    <div className="product-detail-page">
      {/* 1. Breadcrumb */}
      <nav className="product-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span className="product-breadcrumb-separator">/</span>
        <Link to={`/products?category=${product.category?.slug || ''}`}>
          {product.category?.name || 'Laptop'}
        </Link>
        <span className="product-breadcrumb-separator">/</span>
        <span>{product.brand || 'GHT'}</span>
        <span className="product-breadcrumb-separator">/</span>
        <span className="product-breadcrumb-current">{product.name}</span>
      </nav>

      {/* 2. Top Section: 2 Columns (Gallery 45% + Info 55%) */}
      <div className="product-detail-top-section">
        {/* Gallery Column (45%) */}
        <div className="product-gallery-box">
          <div className="product-main-image-container">
            <img
              src={galleryThumbnails[selectedImageIdx] || '/images/premium.png'}
              alt={product.name}
              className="product-main-image"
            />
          </div>

          <div className="product-thumbnails-row">
            {galleryThumbnails.map((img, idx) => (
              <button
                key={idx}
                type="button"
                className={`product-thumbnail-btn ${selectedImageIdx === idx ? 'is-active' : ''}`}
                onClick={() => setSelectedImageIdx(idx)}
                aria-label={`Xem ảnh ${idx + 1}`}
              >
                <img src={img} alt={`Thumbnail ${idx + 1}`} />
              </button>
            ))}
          </div>

          <p className="product-gallery-caption">
            Ảnh sản phẩm • Màu {selectedColor.toLowerCase()} • Thiết kế mỏng nhẹ
          </p>
        </div>

        {/* Info Column (55%) */}
        <div className="product-info-column">
          {/* Badge + Mã SP cùng dòng */}
          <div className="product-header-badge-row">
            <span className="product-header-badge">
              {product.isNew ? 'Mới' : 'Bán chạy'}
            </span>
            <span className="product-sku-code">
              Mã sản phẩm: {skuCode}
            </span>
          </div>

          {/* Tên sản phẩm */}
          <h1 className="product-title-heading">{product.name}</h1>

          {/* Rating + Tồn kho cùng dòng (space-between) */}
          <div className="product-rating-stock-row">
            <div className="product-rating-info">
              <i className="ti ti-star-filled" style={{ color: '#F59E0B' }}></i>
              <span>
                {data.avgRating ? data.avgRating.toFixed(1) : '5.0'} / 5 • {data.reviewCount || 0} đánh giá
              </span>
            </div>

            <div className={`product-stock-status ${inStock <= 0 ? 'is-out' : ''}`}>
              {inStock > 0 ? `Còn ${inStock} sản phẩm` : 'Tạm hết hàng'}
            </div>
          </div>

          {/* Giá + Giá gốc + Badge giảm cùng dòng */}
          <div className="product-pricing-box">
            <span className="product-price-current">{formatPrice(product.price)}</span>
            {hasDiscount && (
              <>
                <span className="product-price-original">{formatPrice(originalPrice)}</span>
                <span className="product-discount-pill">-{discountPercent}%</span>
              </>
            )}
          </div>

          {/* Spec Tags */}
          <div className="product-spec-tags-list">
            {specTags.map((tag, idx) => (
              <span key={idx} className="product-spec-tag-item">
                {tag}
              </span>
            ))}
          </div>

          {/* Mô tả ngắn */}
          <p className="product-short-desc">
            {product.description ||
              'Laptop chính hãng trang bị vi xử lý thế hệ mới, tối ưu hiệu năng làm việc đa nhiệm và học tập mượt mà. Thời lượng pin dài, độ bền đạt tiêu chuẩn quân đội.'}
          </p>

          {/* Chọn biến thể: Màu sắc */}
          <div className="product-variant-group">
            <span className="product-variant-label">Màu sắc:</span>
            <div className="product-variant-buttons">
              {['Bạc', 'Xám', 'Xanh đen'].map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`variant-btn ${selectedColor === color ? 'is-active' : ''}`}
                  onClick={() => setSelectedColor(color)}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Chọn biến thể: Cấu hình */}
          <div className="product-variant-group">
            <span className="product-variant-label">Cấu hình:</span>
            <div className="product-variant-buttons">
              {['16GB / 512GB', '32GB / 1TB'].map((config) => (
                <button
                  key={config}
                  type="button"
                  className={`variant-btn ${selectedConfig === config ? 'is-active' : ''}`}
                  onClick={() => setSelectedConfig(config)}
                >
                  {config}
                </button>
              ))}
            </div>
          </div>

          {/* Số lượng */}
          <div className="product-quantity-row">
            <span className="product-variant-label">Số lượng:</span>
            <div className="quantity-stepper">
              <button
                type="button"
                className="stepper-btn"
                onClick={handleDecrease}
                disabled={quantity <= 1 || inStock <= 0}
                aria-label="Giảm số lượng"
              >
                –
              </button>
              <span className="stepper-value">{quantity}</span>
              <button
                type="button"
                className="stepper-btn"
                onClick={handleIncrease}
                disabled={quantity >= maxStock || inStock <= 0}
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>
            <span className="quantity-max-note">
              Tối đa {inStock} sản phẩm
            </span>
          </div>

          {/* CTA Buttons */}
          <div className="product-cta-row">
            <button
              type="button"
              className="btn-primary product-cta-btn-cart"
              disabled={inStock <= 0 || isAddingCart}
              onClick={handleAddToCart}
            >
              {isAddingCart ? <ButtonSpinner /> : <><i className="ti ti-shopping-cart"></i> Thêm vào giỏ</>}
            </button>

            <button
              type="button"
              className="product-cta-btn-buy"
              disabled={inStock <= 0 || isBuyingNow}
              onClick={handleBuyNow}
            >
              {isBuyingNow ? <ButtonSpinner /> : 'Mua ngay'}
            </button>

            <button
              type="button"
              className={`product-cta-btn-wishlist ${isWishlisted ? 'is-active' : ''}`}
              onClick={handleWishlistClick}
              aria-label={isWishlisted ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
              title={isWishlisted ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'}
            >
              {isWishlisted ? <i className="ti ti-heart-filled"></i> : <i className="ti ti-heart"></i>}
            </button>
          </div>

          {/* Trust line dưới CTA */}
          <div className="product-trust-line">
            Giao hàng miễn phí • Bảo hành 24 tháng • Đổi trả 7 ngày
          </div>
        </div>
      </div>

      {/* 3. Bottom Section: 2 Columns (Specs left + Reviews & AI right) */}
      <div className="product-detail-bottom-section">
        {/* Box trái: Thông số kỹ thuật */}
        <div className="specs-card-box">
          <h2 className="specs-card-title">Thông số kỹ thuật</h2>
          <div className="specs-table-list">
            {specsRows.map((spec, idx) => (
              <div key={idx} className="specs-row-item">
                <span className="specs-row-label">{spec.label}</span>
                <span className="specs-row-value">{spec.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Box phải: Đánh giá + AI Suggestion Box */}
        <div className="reviews-card-box">
          <div className="reviews-header-row">
            <h2 className="reviews-header-title">
              Đánh giá từ người mua ({reviews.length})
            </h2>
            <span className="reviews-badge-verified">Đã mua hàng</span>
          </div>

          {/* Reviews list */}
          <div className="reviews-list-container">
            {reviews.length > 0 ? (
              reviews.map((rev) => (
                <div key={rev.id} className="review-card-item">
                  <div className="review-author-line">
                    <span>{rev.userName || 'Khách hàng GHT'}</span>
                    <span>•</span>
                    <span className="review-author-stars">
                      {rev.rating}.0 {'★'.repeat(rev.rating)}
                    </span>
                    <span className="review-author-date">
                      {new Date(rev.createdAt).toLocaleDateString('vi-VN')}
                    </span>
                  </div>
                  <p className="review-content-body">{rev.comment}</p>
                </div>
              ))
            ) : (
              <div className="review-card-item">
                <div className="review-author-line">
                  <span>Ngọc Linh</span>
                  <span>•</span>
                  <span className="review-author-stars">5.0 ★★★★★</span>
                  <span className="review-author-date">08/10/2026</span>
                </div>
                <p className="review-content-body">
                  Máy chạy rất êm, thiết kế mỏng nhẹ sang trọng đúng như mô tả. Đóng gói cẩn thận và giao hàng GHN nhanh chóng!
                </p>
              </div>
            )}
          </div>

          {/* Review form toggle */}
          {user ? (
            <div className="review-form-toggle-wrapper">
              {!showReviewForm ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setShowReviewForm(true)}
                >
                  ✎ Viết đánh giá sản phẩm
                </button>
              ) : (
                <form onSubmit={handleSubmitReview} noValidate>
                  {reviewError && (
                    <div className="auth-alert-box review-form-alert">
                      {reviewError}
                    </div>
                  )}
                  <div className="review-rating-select-row">
                    <span className="review-rating-label">Chọn số sao:</span>
                    <select
                      className="input review-rating-select"
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                    >
                      {[5, 4, 3, 2, 1].map((s) => (
                        <option key={s} value={s}>
                          {s} Sao {'★'.repeat(s)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <textarea
                    className="input review-textarea-field"
                    rows="3"
                    placeholder="Chia sẻ trải nghiệm sử dụng thực tế của bạn..."
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                  />

                  <div className="review-form-actions-row">
                    <button
                      type="submit"
                      className="btn-primary btn-sm"
                      disabled={isSubmittingReview}
                    >
                      {isSubmittingReview ? <ButtonSpinner /> : 'Gửi đánh giá'}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      onClick={() => setShowReviewForm(false)}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="review-login-prompt">
              <Link to="/login">
                Đăng nhập
              </Link>{' '}
              để gửi đánh giá cho sản phẩm này.
            </div>
          )}

          {/* AI Suggestion Box */}
          <div className="product-ai-suggestion-box">
            <span className="ai-suggestion-icon">✦</span>
            <div className="ai-suggestion-text">
              <div className="ai-suggestion-title">Bạn chưa biết chọn cấu hình nào?</div>
              <div className="ai-suggestion-sub">
                Trợ lý GHT giúp so sánh và tư vấn thiết bị phù hợp nhất với nhu cầu của bạn.
              </div>
            </div>
            <a href="#ai-assistant" className="btn-ghost ai-suggestion-btn">
              Hỏi trợ lý
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
