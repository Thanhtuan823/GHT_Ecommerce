import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/common/ToastContext';
import Skeleton from '../../components/common/Skeleton';
import './ProductDetail.css';

const ProductDetail = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [activeTab, setActiveTab] = useState('specs'); // specs, reviews
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitReviewError, setSubmitReviewError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await axiosClient.get(`/products/slug/${slug}`);
        setData(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Không tìm thấy sản phẩm');
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [slug]);

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmitReviewError('');
    try {
      await axiosClient.post(`/products/${data.product.id}/reviews`, { rating, comment });
      // Reload detail
      const res = await axiosClient.get(`/products/slug/${slug}`);
      setData(res.data);
      setComment('');
      setRating(5);
    } catch (err) {
      setSubmitReviewError(err.response?.data?.message || 'Gửi đánh giá thất bại');
    }
  };

  const handleAddToCart = async () => {
    const success = await addToCart(data.product, 1);
    if (success) {
      toast.success('Đã thêm vào giỏ hàng thành công!');
    }
  };

  if (isLoading) return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 24px', display: 'flex', gap: '40px' }}>
      <Skeleton width="50%" height="500px" borderRadius="12px" />
      <div style={{ flex: 1 }}>
        <Skeleton width="80%" height="32px" style={{ marginBottom: '16px' }} />
        <Skeleton width="40%" height="24px" style={{ marginBottom: '24px' }} />
        <Skeleton width="100%" height="150px" style={{ marginBottom: '24px' }} />
      </div>
    </div>
  );
  if (error) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-danger)' }}>{error}</div>;
  if (!data) return null;

  const { product, reviews } = data;
  const specEntries = product.specs ? Object.entries(product.specs) : [];

  return (
    <div className="product-detail-page">
      <div style={{ marginBottom: '20px', fontSize: '14px' }}>
        <Link to="/" style={{ color: 'var(--color-text-muted)' }}>Trang chủ</Link>
        {' / '}
        <Link to="/products" style={{ color: 'var(--color-text-muted)' }}>Sản phẩm</Link>
        {' / '}
        <span style={{ color: 'var(--color-text-primary)' }}>{product.name}</span>
      </div>

      <div className="product-detail-top">
        <div className="product-gallery">
          <img 
            src={product.images && product.images.length > 0 ? product.images[0] : '/images/premium.png'} 
            alt={product.name} 
            className="main-image" 
          />
        </div>
        
        <div className="product-info">
          <h1 className="product-title">{product.name}</h1>
          <div className="product-meta">
            <span>Thương hiệu: <strong>{product.brand || 'Khác'}</strong></span>
            <span>Trạng thái: <strong style={{ color: product.inStock > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{product.inStock > 0 ? 'Còn hàng' : 'Hết hàng'}</strong></span>
            <span>Đã bán: <strong>{product.soldCount}</strong></span>
          </div>
          
          <div className="product-price-large">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
          </div>
          
          <div className="product-actions">
            <button className="btn-primary" style={{ padding: '12px 24px', fontSize: '16px' }} disabled={product.inStock <= 0} onClick={handleAddToCart}>
              THÊM VÀO GIỎ HÀNG
            </button>
          </div>
        </div>
      </div>

      <div className="product-detail-bottom">
        <div className="tabs">
          <button className={`tab ${activeTab === 'specs' ? 'active' : ''}`} onClick={() => setActiveTab('specs')}>
            Thông số kỹ thuật
          </button>
          <button className={`tab ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
            Đánh giá ({data.reviewCount})
          </button>
        </div>
        
        <div className="tab-content">
          {activeTab === 'specs' && (
            <div className="specs-table">
              {specEntries.length > 0 ? (
                <table>
                  <tbody>
                    {specEntries.map(([key, val]) => (
                      <tr key={key}>
                        <th>{key}</th>
                        <td>{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>Đang cập nhật thông số.</p>
              )}
            </div>
          )}
          
          {activeTab === 'reviews' && (
            <div className="reviews-section">
              <div className="reviews-list">
                {reviews.length > 0 ? (
                  reviews.map(r => (
                    <div key={r.id} className="review-item">
                      <div className="review-header">
                        <img src={r.userAvatar || 'https://via.placeholder.com/40'} alt="Avatar" className="review-avatar" />
                        <div>
                          <strong>{r.userName}</strong>
                          <div style={{ fontSize: '12px', color: 'var(--color-accent)' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                          {new Date(r.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p className="review-comment">{r.comment}</p>
                    </div>
                  ))
                ) : (
                  <p>Chưa có đánh giá nào.</p>
                )}
              </div>
              
              {user ? (
                <div className="review-form">
                  <h3>Viết đánh giá</h3>
                  {submitReviewError && <div className="error-message" style={{ marginBottom: '16px', color: 'var(--color-danger)' }}>{submitReviewError}</div>}
                  <form onSubmit={handleSubmitReview}>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Số sao</label>
                      <select className="input" value={rating} onChange={e => setRating(Number(e.target.value))}>
                        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} Sao</option>)}
                      </select>
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Nội dung</label>
                      <textarea className="input" rows="4" value={comment} onChange={e => setComment(e.target.value)} required></textarea>
                    </div>
                    <button type="submit" className="btn-primary">Gửi đánh giá</button>
                  </form>
                </div>
              ) : (
                <div style={{ marginTop: '24px', padding: '16px', background: 'var(--color-bg-muted)', borderRadius: '8px', textAlign: 'center' }}>
                  Vui lòng <Link to="/login" style={{ color: 'var(--color-accent)' }}>đăng nhập</Link> để đánh giá.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
