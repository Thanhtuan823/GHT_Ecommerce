import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ProductCard from '../../components/product/ProductCard';
import CouponRail from '../../components/home/CouponRail';
import HomeFeaturedSections from '../../components/home/HomeFeaturedSections';
import './ProductList.css';

const DEFAULT_CATEGORIES = [
  { id: '', name: 'Tất cả' },
  { id: 'laptop', name: 'Laptop' },
  { id: 'pc', name: 'PC & màn hình' },
  { id: 'phukien', name: 'Phụ kiện' },
  { id: 'dienthoai', name: 'Điện thoại' },
  { id: 'khuyenmai', name: 'Khuyến mãi' }
];

const BRANDS = ['ASUS', 'Apple', 'Dell', 'Lenovo', 'HP', 'Acer'];

const PRICE_RANGES = [
  { id: 'all', label: 'Tất cả mức giá', min: null, max: null },
  { id: 'under15', label: 'Dưới 15 triệu', min: null, max: 15000000 },
  { id: '15to25', label: '15 - 25 triệu', min: 15000000, max: 25000000 },
  { id: 'above25', label: 'Trên 25 triệu', min: 25000000, max: null }
];

const USAGE_TAGS = ['Học tập - Văn phòng', 'Đồ họa - Kỹ thuật', 'Gaming', 'Mỏng nhẹ cao cấp'];
const RAM_OPTIONS = ['8GB', '16GB', '32GB'];

const PILL_FILTERS = [
  { id: 'all', label: 'Chính hãng' },
  { id: 'fast_delivery', label: 'Giao hàng nhanh' },
  { id: 'all_brands', label: 'Khám phá tất cả thương hiệu' }
];

const ProductList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  // Local filter states
  const [selectedUsage, setSelectedUsage] = useState([]);
  const [selectedRam, setSelectedRam] = useState([]);
  const [activePill, setActivePill] = useState('all');

  // Query params from URL
  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const categoryParam = searchParams.get('category') || '';
  const brandParam = searchParams.get('brand') || '';
  const sortParam = searchParams.get('sort') || 'bestseller';
  const priceParam = searchParams.get('priceRange') || 'all';

  // Fetch categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosClient.get('/categories');
        setDbCategories(res.data || []);
      } catch (err) {
        console.error('Lỗi tải danh mục', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('page', page.toString());
        params.set('limit', '12');

        if (search) params.set('search', search);
        if (sortParam) params.set('sort', sortParam);

        // Map category
        if (categoryParam) {
          const matchCat = dbCategories.find(
            (c) => c.slug === categoryParam || c.name.toLowerCase().includes(categoryParam.toLowerCase()) || c.id.toString() === categoryParam
          );
          if (matchCat) {
            params.set('category', matchCat.id.toString());
          }
        }

        // Map brand
        if (brandParam) params.set('brand', brandParam);

        // Map price range
        const currentPriceObj = PRICE_RANGES.find((p) => p.id === priceParam);
        if (currentPriceObj) {
          if (currentPriceObj.min !== null) params.set('minPrice', currentPriceObj.min.toString());
          if (currentPriceObj.max !== null) params.set('maxPrice', currentPriceObj.max.toString());
        }

        const res = await axiosClient.get(`/products?${params.toString()}`);
        setProducts(res.data.data || []);
        setPagination(res.data.pagination || { page: 1, totalPages: 1, total: 0 });
      } catch (err) {
        console.error('Lỗi tải sản phẩm', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [searchParams, dbCategories, page, search, categoryParam, brandParam, sortParam, priceParam]);

  // Update URL Query Params
  const updateParam = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handleResetFilters = () => {
    setSelectedUsage([]);
    setSelectedRam([]);
    setActivePill('all');
    setSearchParams({});
  };

  // Client-side refinement for RAM and usage tags if selected
  const displayedProducts = useMemo(() => {
    let result = products;
    if (selectedRam.length > 0) {
      result = result.filter((p) => {
        const specStr = JSON.stringify(p.specs || '') + (p.specsLine || '');
        return selectedRam.some((ram) => specStr.includes(ram));
      });
    }
    if (selectedUsage.length > 0) {
      result = result.filter((p) => {
        const tags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
        const name = p.name || '';
        return selectedUsage.some((usage) => tags.includes(usage) || name.includes(usage));
      });
    }
    return result;
  }, [products, selectedRam, selectedUsage]);

  const toggleUsage = (usage) => {
    setSelectedUsage((prev) =>
      prev.includes(usage) ? prev.filter((item) => item !== usage) : [...prev, usage]
    );
  };

  const toggleRam = (ram) => {
    setSelectedRam((prev) =>
      prev.includes(ram) ? prev.filter((item) => item !== ram) : [...prev, ram]
    );
  };

  const isFilteringOrSearching = useMemo(() => {
    return Boolean(
      search ||
      categoryParam ||
      brandParam ||
      (priceParam && priceParam !== 'all') ||
      page > 1 ||
      selectedUsage.length > 0 ||
      selectedRam.length > 0
    );
  }, [search, categoryParam, brandParam, priceParam, page, selectedUsage, selectedRam]);

  return (
    <div className="product-list-page-wrapper">
      {/* Main Content Container */}
      <div className="products-page-container">
        {/* 1. Hero Banner */}
        <section className="products-hero-banner">
          <div className="hero-banner-content">
            <span className="hero-banner-label">🚀 GHT E-COMMERCE • ĐỈNH CAO CÔNG NGHỆ</span>
            <h1 className="hero-banner-title">Chọn Đúng Thiết Bị. Bứt Phá Năng Suất.</h1>
            <p className="hero-banner-sub">
              Trang bị laptop, PC đồ họa và phụ kiện thế hệ mới từ các thương hiệu hàng đầu thế giới với mức giá ưu đãi và bảo hành 24 tháng chính hãng.
            </p>
            <div className="hero-banner-trust">
              <span><i className="ti ti-truck-delivery"></i> Giao nhanh toàn quốc</span>
              <span><i className="ti ti-shield-check"></i> 100% Chính hãng</span>
              <span><i className="ti ti-rotate-2"></i> Đổi trả 7 ngày</span>
              <span><i className="ti ti-percentage"></i> Trả góp 0%</span>
            </div>
          </div>

          <div className="hero-banner-card">
            <div className="hero-card-badge">HOT PROMO 2026</div>
            <div className="hero-card-title">Săn Voucher Giảm Tới 20%</div>
            <p className="hero-card-desc">Lưu mã vào ví ngay bên dưới để nhận chiết khấu trực tiếp khi đặt hàng</p>
            <div className="hero-card-stats">
              <div className="hero-stat-item">
                <strong>1000+</strong>
                <span>Sản phẩm</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat-item">
                <strong>24/7</strong>
                <span>Hỗ trợ kỹ thuật</span>
              </div>
              <div className="hero-stat-divider"></div>
              <div className="hero-stat-item">
                <strong>100%</strong>
                <span>Chính hãng</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Kho Voucher Độc Quyền Hôm Nay (Coupon Rail) */}
        <CouponRail />

        {/* 3. Cụm Sản Phẩm Trang Chủ: Flash Sale, Best Sellers, New Arrivals (Khi không lọc) */}
        {!isFilteringOrSearching && (
          <HomeFeaturedSections />
        )}

        {/* 4. Section Toàn Bộ Danh Mục & Bộ Lọc (Catalog Explorer) */}
        <section className="catalog-explorer-section">
          {/* Products Body Layout (Sidebar 200px + Main Grid) */}
          <div className="products-body-layout">
            {/* Sidebar Filters (200px) */}
            <aside className="products-sidebar">
              <div className="products-sidebar-header">
                <h3 className="products-sidebar-title">Bộ lọc</h3>
                <button
                  type="button"
                  className="products-sidebar-reset"
                  onClick={handleResetFilters}
                >
                  Đặt lại
                </button>
              </div>

              {/* Thương hiệu */}
              <div className="filter-group">
                <h4 className="filter-group-title">Thương hiệu</h4>
                <div className="filter-options-list">
                  {BRANDS.map((b) => (
                    <label key={b} className="filter-checkbox-item">
                      <input
                        type="radio"
                        name="brand"
                        checked={brandParam === b}
                        onChange={() => updateParam('brand', brandParam === b ? '' : b)}
                      />
                      <span>{b}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group-divider" />

              {/* Khoảng giá */}
              <div className="filter-group">
                <h4 className="filter-group-title">Khoảng giá</h4>
                <div className="filter-options-list">
                  {PRICE_RANGES.map((r) => (
                    <label key={r.id} className="filter-checkbox-item">
                      <input
                        type="radio"
                        name="priceRange"
                        checked={priceParam === r.id}
                        onChange={() => updateParam('priceRange', r.id)}
                      />
                      <span>{r.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group-divider" />

              {/* Nhu cầu sử dụng */}
              <div className="filter-group">
                <h4 className="filter-group-title">Nhu cầu sử dụng</h4>
                <div className="filter-options-list">
                  {USAGE_TAGS.map((u) => (
                    <label key={u} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedUsage.includes(u)}
                        onChange={() => toggleUsage(u)}
                      />
                      <span>{u}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="filter-group-divider" />

              {/* Bộ nhớ RAM */}
              <div className="filter-group">
                <h4 className="filter-group-title">Bộ nhớ RAM</h4>
                <div className="filter-options-list">
                  {RAM_OPTIONS.map((ram) => (
                    <label key={ram} className="filter-checkbox-item">
                      <input
                        type="checkbox"
                        checked={selectedRam.includes(ram)}
                        onChange={() => toggleRam(ram)}
                      />
                      <span>{ram}</span>
                    </label>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content Column */}
            <main className="products-main-content">
              {/* Header row: Title + Count + Sort */}
              <div className="products-header-row">
                <div className="products-title-box">
                  <h3 className="products-main-heading">Danh mục thiết bị</h3>
                  <p>
                    {pagination.total || displayedProducts.length} sản phẩm phù hợp với bạn
                  </p>
                </div>

                <div className="products-sort-wrapper">
                  <select
                    className="products-sort-select"
                    value={sortParam}
                    onChange={(e) => updateParam('sort', e.target.value)}
                    aria-label="Sắp xếp sản phẩm"
                  >
                    <option value="bestseller">Sắp xếp: Bán chạy nhất ▾</option>
                    <option value="newest">Sắp xếp: Mới nhất</option>
                    <option value="price_asc">Giá: Thấp đến cao</option>
                    <option value="price_desc">Giá: Cao đến thấp</option>
                  </select>
                </div>
              </div>

              {/* Filter pills dạng underline (không phải button) */}
              <div className="products-filter-pills">
                {PILL_FILTERS.map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    className={`filter-pill-underline ${activePill === pill.id ? 'is-active' : ''}`}
                    onClick={() => setActivePill(pill.id)}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>

              {/* Grid 4 columns or Skeleton */}
              {isLoading ? (
                <div className="products-grid">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="product-skeleton-card">
                      <div className="skeleton-card-image skeleton" />
                      <div className="skeleton-card-body">
                        <div className="skeleton-card-line short skeleton" />
                        <div className="skeleton-card-line long skeleton" />
                        <div className="skeleton-card-line medium skeleton" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : displayedProducts.length > 0 ? (
                <>
                  <div className="products-grid">
                    {displayedProducts.map((p) => (
                      <ProductCard key={p.id} product={p} />
                    ))}
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="products-pagination">
                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={page <= 1}
                        onClick={() => updateParam('page', (page - 1).toString())}
                      >
                        ‹
                      </button>

                      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          className={`pagination-btn ${pageNum === page ? 'is-active' : ''}`}
                          onClick={() => updateParam('page', pageNum.toString())}
                        >
                          {pageNum}
                        </button>
                      ))}

                      <button
                        type="button"
                        className="pagination-btn"
                        disabled={page >= pagination.totalPages}
                        onClick={() => updateParam('page', (page + 1).toString())}
                      >
                        ›
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon"><i className="ti ti-search"></i></div>
                  <h3 className="empty-state-title">Không tìm thấy sản phẩm phù hợp</h3>
                  <p className="empty-state-desc">
                    Thử từ khóa khác hoặc xóa bớt tiêu chí trong bộ lọc.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={handleResetFilters}
                  >
                    Xóa bộ lọc
                  </button>
                </div>
              )}
            </main>
          </div>
        </section>
      </div>
    </div>
  );
};

export default ProductList;
