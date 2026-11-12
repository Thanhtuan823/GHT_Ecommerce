import { useState, useEffect, useMemo, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './Categories.css';

// Slug generator preview helper
function generateSlugPreview(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminCategories() {
  const { user } = useAuth();
  const toast = useToast();

  if (user?.role === 'Staff') {
    return <Navigate to="/staff/orders" replace />;
  }

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal create/edit
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Delete modal
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosClient.get('/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải danh mục:', err);
      toast.error('Không thể tải danh sách danh mục');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const term = searchTerm.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.slug && c.slug.toLowerCase().includes(term)) ||
        (c.description && c.description.toLowerCase().includes(term))
    );
  }, [categories, searchTerm]);

  // Stats
  const stats = useMemo(() => {
    const total = categories.length;
    const withProducts = categories.filter((c) => (c.productCount || 0) > 0).length;
    const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);
    return { total, withProducts, totalProducts };
  }, [categories]);

  // Open Create
  const handleOpenCreate = () => {
    setFormData({ id: null, name: '', description: '' });
    setError('');
    setShowModal(true);
  };

  // Open Edit
  const handleOpenEdit = (cat) => {
    setFormData({
      id: cat.id,
      name: cat.name,
      description: cat.description || ''
    });
    setError('');
    setShowModal(true);
  };

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Vui lòng nhập tên danh mục');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      if (formData.id) {
        await axiosClient.put(`/categories/${formData.id}`, {
          name: formData.name.trim(),
          description: formData.description.trim() || null
        });
        toast.success(`Cập nhật danh mục "${formData.name}" thành công!`);
      } else {
        await axiosClient.post('/categories', {
          name: formData.name.trim(),
          description: formData.description.trim() || null
        });
        toast.success(`Tạo danh mục mới "${formData.name}" thành công!`);
      }
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      const msg = err.response?.data?.message || 'Có lỗi xảy ra khi lưu danh mục';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    if (categoryToDelete.productCount > 0) {
      toast.error('Không thể xóa danh mục đang có sản phẩm!');
      setCategoryToDelete(null);
      return;
    }

    setIsDeleting(true);
    try {
      await axiosClient.delete(`/categories/${categoryToDelete.id}`);
      toast.success(`Đã xóa danh mục "${categoryToDelete.name}" thành công!`);
      fetchCategories();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể xóa danh mục');
    } finally {
      setIsDeleting(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <div className="admin-categories-page">
      {/* Header */}
      <div className="admin-categories-header">
        <div>
          <h1 className="admin-categories-title">Quản lý Danh mục sản phẩm</h1>
          <p className="admin-categories-subtitle">
            Hệ thống phân loại nhóm hàng hóa, chuẩn hóa đường dẫn slug và kiểm soát liên kết sản phẩm
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={handleOpenCreate}>
          <i className="ti ti-plus"></i> Thêm danh mục
        </button>
      </div>

      {/* Stats Cards */}
      <div className="admin-categories-stats">
        <div className="admin-cat-stat-card">
          <div className="admin-cat-stat-icon blue">
            <i className="ti ti-category"></i>
          </div>
          <div className="admin-cat-stat-info">
            <span className="admin-cat-stat-label">Tổng danh mục</span>
            <span className="admin-cat-stat-value">{stats.total}</span>
          </div>
        </div>

        <div className="admin-cat-stat-card">
          <div className="admin-cat-stat-icon green">
            <i className="ti ti-box-model-2"></i>
          </div>
          <div className="admin-cat-stat-info">
            <span className="admin-cat-stat-label">Đang có sản phẩm</span>
            <span className="admin-cat-stat-value">{stats.withProducts}</span>
          </div>
        </div>

        <div className="admin-cat-stat-card">
          <div className="admin-cat-stat-icon purple">
            <i className="ti ti-packages"></i>
          </div>
          <div className="admin-cat-stat-info">
            <span className="admin-cat-stat-label">Tổng sản phẩm liên kết</span>
            <span className="admin-cat-stat-value">{stats.totalProducts}</span>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="admin-categories-card">
        {/* Toolbar */}
        <div className="admin-categories-toolbar">
          <div className="admin-cat-search-box">
            <i className="ti ti-search admin-cat-search-icon"></i>
            <input
              type="text"
              className="admin-cat-search-input"
              placeholder="Tìm kiếm danh mục theo tên, slug..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn-secondary"
            onClick={fetchCategories}
            disabled={loading}
            title="Làm mới danh sách"
          >
            <i className="ti ti-refresh"></i> Làm mới
          </button>
        </div>

        {/* Table */}
        <div className="admin-cat-table-container">
          <table className="admin-cat-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>Tên danh mục</th>
                <th>Đường dẫn (Slug)</th>
                <th>Mô tả</th>
                <th style={{ textAlign: 'center', width: '160px' }}>Sản phẩm</th>
                <th style={{ textAlign: 'right', width: '120px' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                      <ButtonSpinner /> Đang tải danh sách danh mục...
                    </div>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
                    <i className="ti ti-folder-off" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}></i>
                    {searchTerm ? 'Không tìm thấy danh mục phù hợp' : 'Chưa có danh mục nào'}
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => {
                  const hasProducts = (cat.productCount || 0) > 0;
                  return (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>#{cat.id}</td>
                      <td>
                        <div className="cat-name-cell">
                          <div className="cat-name-icon">
                            <i className="ti ti-folder"></i>
                          </div>
                          <span>{cat.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="cat-slug-badge">{cat.slug}</span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', maxWidth: '300px' }}>
                        {cat.description || <em style={{ color: '#94a3b8' }}>Chưa có mô tả</em>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`cat-count-badge ${hasProducts ? 'has-products' : 'empty'}`}>
                          <i className={`ti ${hasProducts ? 'ti-package' : 'ti-box-off'}`}></i>
                          {cat.productCount || 0} sản phẩm
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="cat-action-btns" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn-cat-action"
                            onClick={() => handleOpenEdit(cat)}
                            title="Sửa thông tin danh mục"
                          >
                            <i className="ti ti-edit"></i>
                          </button>
                          <button
                            type="button"
                            className="btn-cat-action delete"
                            disabled={hasProducts}
                            onClick={() => setCategoryToDelete(cat)}
                            title={hasProducts ? 'Không thể xóa danh mục đang có sản phẩm' : 'Xóa danh mục'}
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
      </div>

      {/* Modal Add / Edit Category */}
      {showModal && (
        <div className="admin-cat-modal-overlay" onClick={() => !isSaving && setShowModal(false)}>
          <div className="admin-cat-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-cat-modal-header">
              <h3 className="admin-cat-modal-title">
                {formData.id ? 'Sửa danh mục sản phẩm' : 'Thêm danh mục mới'}
              </h3>
              <button
                type="button"
                className="admin-cat-modal-close-btn"
                onClick={() => !isSaving && setShowModal(false)}
                disabled={isSaving}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="admin-cat-modal-body">
                {error && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                    <i className="ti ti-alert-circle"></i> {error}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Tên danh mục <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Ví dụ: Máy tính bảng, Đồng hồ thông minh..."
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    autoFocus
                  />
                  {formData.name.trim() && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      Đường dẫn (slug) tự sinh: <strong style={{ color: '#2563eb' }}>{generateSlugPreview(formData.name)}</strong>
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Mô tả danh mục
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    placeholder="Mô tả ngắn gọn về nhóm sản phẩm này..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="admin-cat-modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                >
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? <><ButtonSpinner /> Đang lưu...</> : (formData.id ? 'Cập nhật' : 'Tạo danh mục')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {categoryToDelete && (
        <ConfirmModal
          isOpen={true}
          title="Xác nhận xóa danh mục"
          message={`Bạn có chắc chắn muốn xóa danh mục "${categoryToDelete.name}"? Hành động này không thể hoàn tác.`}
          confirmText={isDeleting ? 'Đang xóa...' : 'Xóa danh mục'}
          cancelText="Hủy"
          isDanger={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => !isDeleting && setCategoryToDelete(null)}
        />
      )}
    </div>
  );
}
