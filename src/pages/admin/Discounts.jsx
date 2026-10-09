import { useState, useEffect } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import { getDiscountStatus } from '../../utils/discountStatusHelper';
import './Discounts.css';

const AdminDiscounts = () => {
  const toast = useToast();
  const [discounts, setDiscounts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [discountToDelete, setDiscountToDelete] = useState(null);

  const initialFormState = () => ({
    id: null,
    code: '',
    description: '',
    discountType: 'PERCENTAGE', // PERCENTAGE, FIXED
    discountValue: 0,
    maxDiscountAmount: '',
    minOrderAmount: 0,
    usageLimit: '',
    perUserLimit: 1,
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().slice(0, 16),
    isActive: true,
    conditions: 'ALL',
    conditionValues: []
  });

  const [formData, setFormData] = useState(initialFormState());

  const fetchDiscounts = async () => {
    try {
      const res = await axiosClient.get('/discounts');
      setDiscounts(res.data);
    } catch (err) {
      toast.error('Lỗi tải danh sách mã giảm giá');
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        ...formData,
        maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
      };

      if (formData.id) {
        await axiosClient.put(`/discounts/${formData.id}`, payload);
        toast.success('Cập nhật thành công');
      } else {
        await axiosClient.post('/discounts', payload);
        toast.success('Thêm mới thành công');
      }
      setShowForm(false);
      fetchDiscounts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra');
    } finally {
      setIsSubmitting(false);
    }
  };

  const editDiscount = (d) => {
    setFormData({
      id: d.id,
      code: d.code,
      description: d.description || '',
      discountType: d.discountType,
      discountValue: d.discountValue,
      maxDiscountAmount: d.maxDiscountAmount || '',
      minOrderAmount: d.minOrderAmount,
      usageLimit: d.usageLimit || '',
      perUserLimit: d.perUserLimit,
      startDate: new Date(d.startDate).toISOString().slice(0, 16),
      endDate: new Date(d.endDate).toISOString().slice(0, 16),
      isActive: d.isActive,
      conditions: d.conditions,
      conditionValues: d.conditionValues || []
    });
    setShowForm(true);
  };

  const confirmDelete = async () => {
    if (discountToDelete) {
      try {
        await axiosClient.delete(`/discounts/${discountToDelete}`);
        toast.success('Xóa mã giảm giá thành công');
        fetchDiscounts();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Không thể xóa');
      } finally {
        setDiscountToDelete(null);
      }
    }
  };

  return (
    <div className="admin-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Quản lý mã giảm giá</h2>
        <button className="btn-primary" onClick={() => { setFormData(initialFormState()); setShowForm(true); }}>
          + Thêm mã mới
        </button>
      </div>

      <div style={{ background: 'var(--color-bg-white)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-muted)', textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '16px' }}>Mã Code</th>
              <th style={{ padding: '16px' }}>Loại & Giá trị</th>
              <th style={{ padding: '16px' }}>Tiến độ</th>
              <th style={{ padding: '16px' }}>Thời hạn</th>
              <th style={{ padding: '16px' }}>Trạng thái</th>
              <th style={{ padding: '16px' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {discounts.map(d => {
              const status = getDiscountStatus(d);
              return (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '16px', fontWeight: 'bold', color: 'var(--color-accent)' }}>{d.code}</td>
                  <td style={{ padding: '16px' }}>
                    {d.discountType === 'PERCENTAGE' ? `${d.discountValue}%` : `${new Intl.NumberFormat('vi-VN').format(d.discountValue)}đ`}
                  </td>
                  <td style={{ padding: '16px' }}>
                    {d.usedCount} / {d.usageLimit || '∞'}
                  </td>
                  <td style={{ padding: '16px', fontSize: '13px' }}>
                    Từ: {new Date(d.startDate).toLocaleString('vi-VN')}<br/>
                    Đến: {new Date(d.endDate).toLocaleString('vi-VN')}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className={`badge ${status.className}`}>{status.label}</span>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <button className="btn-ghost btn-sm" onClick={() => editDiscount(d)}>Sửa</button>
                    <button className="btn-danger btn-sm" style={{ marginLeft: '8px' }} onClick={() => setDiscountToDelete(d.id)}>Xóa</button>
                  </td>
                </tr>
              );
            })}
            {discounts.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>Chưa có mã giảm giá nào.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal--large" onClick={e => e.stopPropagation()} style={{ width: '860px' }}>
            <h3 style={{ marginBottom: '24px' }}>{formData.id ? 'Cập nhật mã giảm giá' : 'Thêm mã giảm giá mới'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                
                {/* Cột 1: Thông tin chung */}
                <div>
                  <h4 style={{ marginBottom: '16px', color: 'var(--color-text-secondary)' }}>Thông tin chung</h4>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Mã Code (Viết liền không dấu)</label>
                    <input type="text" className="input" style={{ width: '100%' }} value={formData.code} onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})} required />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Mô tả ngắn</label>
                    <input type="text" className="input" style={{ width: '100%' }} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Loại giảm</label>
                      <select className="input" style={{ width: '100%' }} value={formData.discountType} onChange={e => setFormData({...formData, discountType: e.target.value})}>
                        <option value="PERCENTAGE">Phần trăm (%)</option>
                        <option value="FIXED">Giá tiền trực tiếp</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Giá trị</label>
                      <input type="number" className="input" style={{ width: '100%' }} value={formData.discountValue} onChange={e => setFormData({...formData, discountValue: Number(e.target.value)})} min="1" required />
                    </div>
                  </div>
                  {formData.discountType === 'PERCENTAGE' && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Giảm tối đa (VNĐ) - Tùy chọn</label>
                      <input type="number" className="input" style={{ width: '100%' }} value={formData.maxDiscountAmount} onChange={e => setFormData({...formData, maxDiscountAmount: e.target.value})} />
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', marginTop: '24px' }}>
                    <input type="checkbox" id="isActive" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
                    <label htmlFor="isActive" style={{ fontWeight: '500' }}>Kích hoạt (Cho phép sử dụng)</label>
                  </div>
                </div>

                {/* Cột 2: Cài đặt điều kiện */}
                <div>
                  <h4 style={{ marginBottom: '16px', color: 'var(--color-text-secondary)' }}>Điều kiện áp dụng</h4>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Đơn hàng tối thiểu (VNĐ)</label>
                    <input type="number" className="input" style={{ width: '100%' }} value={formData.minOrderAmount} onChange={e => setFormData({...formData, minOrderAmount: Number(e.target.value)})} min="0" required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Giới hạn lượt dùng (Để trống = ∞)</label>
                      <input type="number" className="input" style={{ width: '100%' }} value={formData.usageLimit} onChange={e => setFormData({...formData, usageLimit: e.target.value})} min="1" />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Lượt/Mỗi user</label>
                      <input type="number" className="input" style={{ width: '100%' }} value={formData.perUserLimit} onChange={e => setFormData({...formData, perUserLimit: Number(e.target.value)})} min="1" required />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Ngày bắt đầu</label>
                      <input type="datetime-local" className="input" style={{ width: '100%' }} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '8px' }}>Ngày kết thúc</label>
                      <input type="datetime-local" className="input" style={{ width: '100%' }} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} required />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px' }}>Phạm vi áp dụng</label>
                    <select className="input" style={{ width: '100%' }} value={formData.conditions} onChange={e => setFormData({...formData, conditions: e.target.value})}>
                      <option value="ALL">Tất cả sản phẩm</option>
                      <option value="CATEGORY">Theo danh mục (Chưa hỗ trợ UI)</option>
                      <option value="BRAND">Theo thương hiệu (Chưa hỗ trợ UI)</option>
                    </select>
                  </div>
                </div>

              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
                <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Hủy bỏ</button>
                <button type="submit" className="btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? <><ButtonSpinner /> ĐANG LƯU...</> : 'Lưu cài đặt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!discountToDelete}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa mã giảm giá này không? Hành động này không thể hoàn tác."
        onConfirm={confirmDelete}
        onCancel={() => setDiscountToDelete(null)}
      />
    </div>
  );
};

export default AdminDiscounts;
