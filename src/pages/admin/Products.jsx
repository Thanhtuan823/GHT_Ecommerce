import { useState, useEffect, useCallback, useTransition } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './AdminProducts.css';

export default function AdminProducts() {
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

  // Modal create/edit
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState());
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [productToDelete, setProductToDelete] = useState(null);

  function initialFormState() {
    return {
      id: null,
      name: '',
      price: 0,
      inStock: 0,
      categoryId: '',
      brand: '',
      images: [],
      specs: {},
      tags: []
    };
  }

  // Debounce search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm);
        setPagination((prev) => ({ ...prev, page: 1 }));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load categories once
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await axiosClient.get('/categories');
        setCategories(res.data || []);
      } catch (err) {
        console.error('Không thể tải danh mục', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch products server-side
  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10'
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (categoryFilter) params.append('category', categoryFilter);

      const res = await axiosClient.get(`/products?${params.toString()}`);
      let list = res.data?.data || [];

      // Filter by stock status if requested
      if (stockFilter === 'IN_STOCK') {
        list = list.filter((p) => p.inStock > 5);
      } else if (stockFilter === 'LOW_STOCK') {
        list = list.filter((p) => p.inStock > 0 && p.inStock <= 5);
      } else if (stockFilter === 'OUT_OF_STOCK') {
        list = list.filter((p) => p.inStock <= 0);
      }

      setProducts(list);
      setPagination(res.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, stockFilter, toast]);

  useEffect(() => {
    fetchProducts(pagination.page);
  }, [fetchProducts, pagination.page]);

  // Handle image upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    setIsUploading(true);
    try {
      const res = await axiosClient.post('/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const imgUrl = res.data?.url?.startsWith('http')
        ? res.data.url
        : `http://localhost:5000${res.data?.url}`;

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, imgUrl]
      }));
      toast.success('Tải ảnh thành công');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi upload ảnh');
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const handleAddImageUrl = () => {
    const url = prompt('Nhập URL hình ảnh:');
    if (url && url.trim()) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, url.trim()] }));
    }
  };

  const handleRemoveImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const editProduct = (p) => {
    setFormData({
      id: p.id,
      name: p.name,
      price: p.price,
      inStock: p.inStock,
      categoryId: p.categoryId,
      brand: p.brand || '',
      images: p.images || [],
      specs: typeof p.specs === 'string' ? JSON.parse(p.specs || '{}') : p.specs || {},
      tags: p.tags ? p.tags.split(',') : []
    });
    setError('');
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        inStock: Number(formData.inStock),
        categoryId: Number(formData.categoryId),
        brand: formData.brand,
        images: formData.images,
        specs: JSON.stringify(formData.specs),
        tags: formData.tags.join(',')
      };

      if (formData.id) {
        await axiosClient.put(`/products/${formData.id}`, payload);
        toast.success('Cập nhật sản phẩm thành công');
      } else {
        await axiosClient.post('/products', payload);
        toast.success('Thêm sản phẩm mới thành công');
      }

      setShowForm(false);
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu');
      toast.error(err.response?.data?.message || 'Không thể lưu sản phẩm');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await axiosClient.delete(`/products/${productToDelete}`);
        toast.success('Xóa sản phẩm thành công');
        fetchProducts(pagination.page);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Không thể xóa sản phẩm');
      } finally {
        setProductToDelete(null);
      }
    }
  };

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  return (
    <div className="admin-products-page">
      {/* Header */}
      <div className="admin-products-header">
        <div>
          <h1 className="admin-products-title">Quản lý Sản phẩm</h1>
          <p className="admin-products-subtitle">
            Quản trị danh mục hàng hóa, theo dõi biến động tồn kho và giá niêm yết
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setFormData(initialFormState());
            setError('');
            setShowForm(true);
          }}
        >
          <i className="ti ti-plus"></i> Thêm sản phẩm
        </button>
      </div>

      {/* Main Content Card */}
      <div className="admin-products-content-card">
        {/* Toolbar */}
        <div className="admin-products-toolbar">
          <div className="admin-products-search-box">
            <i className="ti ti-search admin-products-search-icon"></i>
            <input
              type="text"
              className="admin-products-search-input"
              placeholder="Tìm theo tên sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="admin-products-filters">
            {/* Category Filter */}
            <select
              className="admin-products-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              className="admin-products-select"
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="ALL">Tất cả tồn kho</option>
              <option value="IN_STOCK">Còn hàng (&gt; 5)</option>
              <option value="LOW_STOCK">Sắp hết (1 - 5)</option>
              <option value="OUT_OF_STOCK">Hết hàng (0)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="admin-products-table-container">
          <table className="admin-products-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá bán</th>
                <th>Tồn kho</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <ButtonSpinner /> Đang tải dữ liệu sản phẩm...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="admin-empty-table">
                      <i className="ti ti-package-off"></i>
                      <span>Không tìm thấy sản phẩm nào theo điều kiện lọc</span>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const categoryName = categories.find((c) => c.id === p.categoryId)?.name || 'Chung';
                  const isOutOfStock = p.inStock <= 0;
                  const isLowStock = p.inStock > 0 && p.inStock <= 5;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>#{p.id}</td>
                      <td>
                        <div className="admin-product-cell">
                          <img
                            src={p.images?.[0] || '/images/premium.png'}
                            alt={p.name}
                            className="admin-product-thumb"
                            onError={(e) => { e.target.src = '/images/premium.png'; }}
                          />
                          <div className="admin-product-meta">
                            <span className="admin-product-name">{p.name}</span>
                            {p.brand && <span className="admin-product-brand">{p.brand}</span>}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge-category">{categoryName}</span>
                      </td>
                      <td>
                        <span className="admin-product-price">{formatPrice(p.price)}</span>
                      </td>
                      <td>
                        <span
                          className={`badge-stock ${
                            isOutOfStock ? 'out-stock' : isLowStock ? 'low-stock' : 'in-stock'
                          }`}
                        >
                          {isOutOfStock
                            ? 'Hết hàng (0)'
                            : isLowStock
                            ? `Sắp hết (${p.inStock})`
                            : `Còn ${p.inStock} cái`}
                        </span>
                      </td>
                      <td>
                        <div className="admin-products-actions">
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="Sửa sản phẩm"
                            onClick={() => editProduct(p)}
                          >
                            <i className="ti ti-edit"></i>
                          </button>
                          <button
                            type="button"
                            className="btn-action-icon danger"
                            title="Xóa sản phẩm"
                            onClick={() => setProductToDelete(p.id)}
                          >
                            <i className="ti ti-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="admin-products-pagination">
            <span>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> (Tổng cộng {pagination.total} sản phẩm)
            </span>

            <div className="admin-pagination-btns">
              <button
                type="button"
                className="admin-page-btn"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Trước
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                if (
                  p === 1 ||
                  p === pagination.totalPages ||
                  (p >= pagination.page - 1 && p <= pagination.page + 1)
                ) {
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`admin-page-btn ${p === pagination.page ? 'is-active' : ''}`}
                      disabled={loading}
                      onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                    >
                      {p}
                    </button>
                  );
                }
                return null;
              })}

              <button
                type="button"
                className="admin-page-btn"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Product */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {formData.id ? 'Sửa thông tin sản phẩm' : 'Thêm sản phẩm mới'}
              </h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={() => setShowForm(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {error && (
              <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: MacBook Pro 16 Space Black"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Giá bán (VND) *
                  </label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Tồn kho *
                  </label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.inStock}
                    onChange={(e) => setFormData({ ...formData, inStock: e.target.value })}
                    required
                    min="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Danh mục *
                  </label>
                  <select
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Thương hiệu
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Ví dụ: Apple, ASUS, Dell..."
                  />
                </div>
              </div>

              {/* Images */}
              <div style={{ marginBottom: '20px', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', fontSize: '13px' }}>
                  Hình ảnh sản phẩm
                </label>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <label className="btn-outline" style={{ cursor: 'pointer', fontSize: '13px' }}>
                    {isUploading ? <><ButtonSpinner /> Đang tải...</> : <><i className="ti ti-upload"></i> Upload File</>}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </label>
                  <button type="button" className="btn-outline" onClick={handleAddImageUrl}>
                    + Dán Link URL
                  </button>
                </div>

                {formData.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {formData.images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '70px', height: '70px' }}>
                        <img
                          src={img}
                          alt="preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowForm(false)}
                  disabled={isSaving}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? <><ButtonSpinner /> Đang lưu...</> : 'Lưu sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="Xác nhận xóa sản phẩm"
        message="Bạn có chắc chắn muốn xóa sản phẩm này không? Hành động này sẽ loại bỏ sản phẩm khỏi danh mục bán."
        onConfirm={confirmDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
