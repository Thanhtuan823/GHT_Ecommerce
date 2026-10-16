import { useState, useEffect } from 'react';
import axiosClient from '../../utils/axiosClient';
import ProductCard from '../product/ProductCard';
import './HomeFeaturedSections.css';

const HomeFeaturedSections = () => {
  const [featuredData, setFeaturedData] = useState({
    onSale: [],
    bestSellers: [],
    newArrivals: [],
    featured: []
  });
  const [loading, setLoading] = useState(true);

  // Countdown timer for Flash Sale
  const [timeLeft, setTimeLeft] = useState({ hours: 7, minutes: 24, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 12, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchHomeFeatured = async () => {
      try {
        const res = await axiosClient.get('/products/home-featured');
        if (isMounted && res.data) {
          setFeaturedData(res.data);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu sản phẩm trang chủ:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHomeFeatured();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatTime = (num) => String(num).padStart(2, '0');

  if (loading) {
    return (
      <div className="home-featured-skeleton-container">
        <div className="section-skeleton-box skeleton"></div>
        <div className="section-skeleton-box skeleton"></div>
      </div>
    );
  }

  const { onSale, bestSellers, newArrivals } = featuredData;

  return (
    <div className="home-featured-wrapper">
      {/* SECTION 1: Deal Giảm Giá Sốc (Flash Sale / Hot Deals) */}
      {onSale && onSale.length > 0 && (
        <section className="featured-section section-flash-sale">
          <div className="featured-section-header">
            <div className="section-title-wrap">
              <div className="section-icon-badge flash-icon">
                <i className="ti ti-bolt"></i>
              </div>
              <div>
                <div className="section-badge-row">
                  <h3 className="featured-section-title">Deal Giảm Giá Sốc</h3>
                  <span className="flash-sale-live-pill">
                    <span className="live-dot"></span> ĐANG DIỄN RA
                  </span>
                </div>
                <p className="featured-section-sub">
                  Ưu đãi chấn động với mức giảm giá trực tiếp hấp dẫn nhất thị trường
                </p>
              </div>
            </div>

            {/* Countdown Box */}
            <div className="flash-countdown-box">
              <span className="countdown-label">
                <i className="ti ti-clock"></i> Kết thúc trong:
              </span>
              <div className="countdown-digits">
                <span className="digit-box">{formatTime(timeLeft.hours)}</span>
                <span className="digit-sep">:</span>
                <span className="digit-box">{formatTime(timeLeft.minutes)}</span>
                <span className="digit-sep">:</span>
                <span className="digit-box">{formatTime(timeLeft.seconds)}</span>
              </div>
            </div>
          </div>

          <div className="featured-product-grid">
            {onSale.slice(0, 4).map((product) => (
              <ProductCard
                key={`sale-${product.id}`}
                product={{
                  ...product,
                  badgeText: `-${product.discountPercent || Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}%`,
                  badgeClass: 'badge-discount'
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 2: Sản phẩm Bán chạy nhất (Best Sellers) */}
      {bestSellers && bestSellers.length > 0 && (
        <section className="featured-section section-best-sellers">
          <div className="featured-section-header">
            <div className="section-title-wrap">
              <div className="section-icon-badge fire-icon">
                <i className="ti ti-flame"></i>
              </div>
              <div>
                <h3 className="featured-section-title">Sản Phẩm Bán Chạy Nhất</h3>
                <p className="featured-section-sub">
                  Được cộng đồng tin tưởng và lựa chọn nhiều nhất theo số lượng đơn thực tế
                </p>
              </div>
            </div>

            <div className="section-trust-stat">
              <i className="ti ti-trophy"></i>
              <span>Top Doanh Số Tháng</span>
            </div>
          </div>

          <div className="featured-product-grid">
            {bestSellers.slice(0, 4).map((product, idx) => (
              <ProductCard
                key={`best-${product.id}`}
                product={{
                  ...product,
                  badgeRank: `#${idx + 1}`
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* SECTION 3: Sản phẩm Mới cập bến (New Arrivals) */}
      {newArrivals && newArrivals.length > 0 && (
        <section className="featured-section section-new-arrivals">
          <div className="featured-section-header">
            <div className="section-title-wrap">
              <div className="section-icon-badge new-icon">
                <i className="ti ti-sparkles"></i>
              </div>
              <div>
                <h3 className="featured-section-title">Sản Phẩm Mới Lên Kệ</h3>
                <p className="featured-section-sub">
                  Các model cấu hình thế hệ mới nhất vừa cập bến hệ thống GHT
                </p>
              </div>
            </div>

            <div className="section-trust-stat new-tag">
              <i className="ti ti-certificate"></i>
              <span>Hàng Mới 100% Nguyên Seal</span>
            </div>
          </div>

          <div className="featured-product-grid">
            {newArrivals.slice(0, 4).map((product) => (
              <ProductCard
                key={`new-${product.id}`}
                product={{
                  ...product,
                  badgeText: '✨ Mới ra mắt',
                  badgeClass: 'badge-new'
                }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default HomeFeaturedSections;
