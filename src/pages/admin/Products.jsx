import { useState, useEffect } from 'react';
import axiosClient from '../../utils/axiosClient';
import './AdminProducts.css';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(initialFormState());
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

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

  const fetchProducts = async () => {
    try {
      const [resProd, resCat] = await Promise.all([
        axiosClient.get('/products?limit=100'),
        axiosClient.get('/categories')
      ]);
      setProducts(resProd.data.data);
      setCategories(resCat.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

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
      // Ensure backend returns correct path mapping if needed, e.g. "http://localhost:5000/uploads/..." 
      // But relative /uploads/... is fine since vite proxy handles it if mapped, wait...
      // Usually static files on .NET run on port 5000, and vite proxies /api.
      // So if backend returns /uploads/xyz.png, we might need a full URL or map /uploads in vite config.
      // Let's use it directly, assuming frontend will handle it (in Vite, we can just proxy /uploads).
      // Wait, we can prepend backend URL. For simplicity, we just save what API returns.
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, `http://localhost:5000${res.data.url}`]
      }));
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi upload ảnh');
    } finally {
      setIsUploading(false);
      e.target.value = null; // reset input
    }
  };

  const handleAddImageUrl = () => {
    const url = prompt('Nhập URL hình ảnh:');
    if (url) {
      setFormData(prev => ({ ...prev, images: [...prev.images, url] }));
    }
  };

  const handleRemoveImage = (index) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        inStock: Number(formData.inStock),
        categoryId: Number(formData.categoryId),
        brand: formData.brand,
        images: formData.images,
        specs: formData.specs,
        tags: formData.tags
      };

      if (formData.id) {
        await axiosClient.put(`/products/${formData.id}`, payload);
      } else {
        await axiosClient.post('/products', payload);
      }
      setShowForm(false);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra');
    }
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
      specs: p.specs || {},
      tags: p.tags || []
    });
    setShowForm(true);
  };

  const deleteProduct = async (id) => {
    if (window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
      try {
        await axiosClient.delete(`/products/${id}`);
        fetchProducts();
      } catch (err) {
        alert(err.response?.data?.message || 'Không thể xóa');
      }
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h2>Quản lý sản phẩm</h2>
        <button className="btn-primary" onClick={() => { setFormData(initialFormState()); setShowForm(true); }}>
          + Thêm sản phẩm
        </button>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Hình ảnh</th>
            <th>Tên sản phẩm</th>
            <th>Giá</th>
            <th>Tồn kho</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>
                <img src={p.images?.[0] || '/images/premium.png'} alt="thumbnail" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
              </td>
              <td>{p.name}</td>
              <td>{new Intl.NumberFormat('vi-VN').format(p.price)} đ</td>
              <td>{p.inStock}</td>
              <td>
                <button className="btn-ghost btn-sm" onClick={() => editProduct(p)}>Sửa</button>
                <button className="btn-danger btn-sm" style={{ marginLeft: '8px' }} onClick={() => deleteProduct(p.id)}>Xóa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{formData.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
            {error && <div className="error-message" style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>{error}</div>}
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label>Tên sản phẩm</label>
                <input type="text" className="input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Giá (VND)</label>
                  <input type="number" className="input" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required min="0" />
                </div>
                <div>
                  <label>Tồn kho</label>
                  <input type="number" className="input" value={formData.inStock} onChange={e => setFormData({...formData, inStock: e.target.value})} required min="0" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label>Danh mục</label>
                  <select className="input" value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} required>
                    <option value="">-- Chọn --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label>Thương hiệu</label>
                  <input type="text" className="input" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} />
                </div>
              </div>

              <div style={{ marginBottom: '20px', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600' }}>Hình ảnh sản phẩm</label>
                
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <label className="btn-secondary" style={{ cursor: 'pointer', padding: '8px 16px', borderRadius: '4px', background: 'var(--color-bg-muted)' }}>
                    {isUploading ? 'Đang tải...' : 'Upload File'}
                    <input type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={handleFileChange} disabled={isUploading} />
                  </label>
                  <button type="button" className="btn-ghost" onClick={handleAddImageUrl}>+ Dán Link URL</button>
                </div>

                {formData.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {formData.images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '80px', height: '80px' }}>
                        <img src={img} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--color-border)' }} />
                        <button type="button" onClick={() => handleRemoveImage(idx)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Hủy</button>
                <button type="submit" className="btn-primary">Lưu sản phẩm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
