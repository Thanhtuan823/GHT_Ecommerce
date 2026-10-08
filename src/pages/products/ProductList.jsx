import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import ProductCard from '../../components/product/ProductCard';
import './ProductList.css';

const ProductList = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);

  // Sync state from URL
  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const category = searchParams.get('category') || '';
  const brand = searchParams.get('brand') || '';
  const sort = searchParams.get('sort') || 'newest';
  
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosClient.get('/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Lỗi lấy danh mục', err);
      }
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const query = new URLSearchParams(searchParams).toString();
        const res = await axiosClient.get(`/products?${query}`);
        setProducts(res.data.data);
        setPagination(res.data.pagination);
      } catch (err) {
        console.error('Lỗi lấy sản phẩm', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProducts();
  }, [searchParams]);

  const updateParam = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    if (key !== 'page') newParams.set('page', '1'); // Reset to page 1 on filter change
    setSearchParams(newParams);
  };

  return (
    <div className="product-list-page">
      <aside className="sidebar">
        <h3>Bộ lọc</h3>
        <div className="filter-group">
          <label>Danh mục</label>
          <select className="input" value={category} onChange={(e) => updateParam('category', e.target.value)}>
            <option value="">Tất cả danh mục</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Tìm kiếm</label>
          <input type="text" className="input" placeholder="Tên sản phẩm..." value={search} onChange={(e) => updateParam('search', e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Thương hiệu</label>
          <input type="text" className="input" placeholder="VD: Apple, Samsung" value={brand} onChange={(e) => updateParam('brand', e.target.value)} />
        </div>
      </aside>

      <div className="main-content">
        <div className="toolbar">
          <h2>Danh sách sản phẩm</h2>
          <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => updateParam('sort', e.target.value)}>
            <option value="newest">Mới nhất</option>
            <option value="price_asc">Giá tăng dần</option>
            <option value="price_desc">Giá giảm dần</option>
            <option value="bestseller">Bán chạy</option>
          </select>
        </div>

        {isLoading ? (
          <div className="grid">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: '300px', borderRadius: '10px' }}></div>)}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="grid">
              {products.map(p => <ProductCard key={p.id} product={p} />)}
            </div>
            
            <div className="pagination">
              <button 
                className="btn-ghost" 
                disabled={page <= 1} 
                onClick={() => updateParam('page', (page - 1).toString())}
              >
                Trước
              </button>
              <span>Trang {page} / {pagination.totalPages}</span>
              <button 
                className="btn-ghost" 
                disabled={page >= pagination.totalPages} 
                onClick={() => updateParam('page', (page + 1).toString())}
              >
                Sau
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '16px' }}>Không tìm thấy sản phẩm nào phù hợp.</p>
            <button className="btn-primary" onClick={() => setSearchParams({})}>Xóa bộ lọc</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductList;
