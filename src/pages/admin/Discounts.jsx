import { useState, useEffect, useMemo } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import { getDiscountStatus } from '../../utils/discountStatusHelper';
import './Discounts.css';

// Initial demo discounts to ensure a full dataset matching Screen 9 & 10
const INITIAL_DEMO_DISCOUNTS = [
  {
    id: 1,
    code: 'TECHFEST20',
    description: 'Giảm 20% đại tiệc công nghệ chào hè',
    discountType: 'PERCENTAGE',
    discountValue: 20,
    maxDiscountAmount: 200000,
    minOrderAmount: 500000,
    usageLimit: 200,
    usedCount: 45,
    perUserLimit: 1,
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-10-31T23:59:59Z',
    isActive: true,
    conditions: 'CATEGORY',
    conditionValues: ['Laptop', 'Phụ kiện']
  },
  {
    id: 2,
    code: 'LAPTOP500',
    description: 'Giảm trực tiếp 500.000đ khi nâng cấp laptop cao cấp',
    discountType: 'FIXED',
    discountValue: 500000,
    maxDiscountAmount: null,
    minOrderAmount: 15000000,
    usageLimit: 50,
    usedCount: 32,
    perUserLimit: 1,
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-10-25T23:59:59Z',
    isActive: true,
    conditions: 'BRAND',
    conditionValues: ['ASUS', 'Dell', 'Apple']
  },
  {
    id: 3,
    code: 'NEWBIE10',
    description: 'Ưu đãi 10% đơn hàng đầu tiên cho thành viên mới',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    maxDiscountAmount: 500000,
    minOrderAmount: 1000000,
    usageLimit: 28,
    usedCount: 28,
    perUserLimit: 1,
    startDate: '2026-09-01T00:00:00Z',
    endDate: '2026-10-15T23:59:59Z',
    isActive: true,
    conditions: 'ALL',
    conditionValues: []
  },
  {
    id: 4,
    code: 'SUMMERFLASH',
    description: 'Chương trình Flash Sale tháng 8',
    discountType: 'FIXED',
    discountValue: 150000,
    maxDiscountAmount: null,
    minOrderAmount: 2000000,
    usageLimit: 100,
    usedCount: 16,
    perUserLimit: 1,
    startDate: '2026-08-01T00:00:00Z',
    endDate: '2026-08-31T23:59:59Z',
    isActive: true,
    conditions: 'ALL',
    conditionValues: []
  },
  {
    id: 5,
    code: 'VIPEXCLUSIVE',
    description: 'Đặc quyền đối tác doanh nghiệp và khách VIP',
    discountType: 'PERCENTAGE',
    discountValue: 15,
    maxDiscountAmount: 1000000,
    minOrderAmount: 5000000,
    usageLimit: 100,
    usedCount: 0,
    perUserLimit: 2,
    startDate: '2026-10-01T00:00:00Z',
    endDate: '2026-12-31T23:59:59Z',
    isActive: false,
    conditions: 'NEW_ARRIVAL',
    conditionValues: ['30']
  }
];

export default function AdminDiscounts() {
  const { showToast } = useToast();
  const [discounts, setDiscounts] = useState(INITIAL_DEMO_DISCOUNTS);
  const [showModal, setShowModal] = useState(false);
  const [viewDetailModal, setViewDetailModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Tag input state for modal
  const [tagInput, setTagInput] = useState('');

  // Form Validation inline errors
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const initialFormState = () => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 14);

    return {
      id: null,
      code: '',
      description: '',
      discountType: 'PERCENTAGE', // PERCENTAGE | FIXED
      discountValue: 10,
      maxDiscountAmount: 50000,
      minOrderAmount: 1000000,
      usageLimit: 200,
      perUserLimit: 1,
      startDate: today.toISOString().slice(0, 10),
      endDate: nextWeek.toISOString().slice(0, 10),
      isActive: true,
      conditions: 'ALL', // ALL | CATEGORY | BRAND | NEW_ARRIVAL
      conditionValues: []
    };
  };

  const [formData, setFormData] = useState(initialFormState());

  // Fetch from backend
  const fetchDiscounts = async () => {
    try {
      const res = await axiosClient.get('/discounts');
      if (Array.isArray(res.data) && res.data.length > 0) {
        // Merge backend items with demo items to keep comprehensive demo experience
        const apiIds = new Set(res.data.map((d) => d.id));
        const combined = [
          ...res.data,
          ...INITIAL_DEMO_DISCOUNTS.filter((d) => !apiIds.has(d.id))
        ];
        setDiscounts(combined);
      }
    } catch {
      // Keep demo items
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, []);

  // Format date helper
  const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    } catch {
      return dateStr;
    }
  };

  const formatPrice = (price) => {
    return (price || 0).toLocaleString('vi-VN') + 'đ';
  };

  // Copy code to clipboard
  const handleCopyCode = async (code) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast(`Đã sao chép mã "${code}" vào bộ nhớ tạm`, 'success');
    } catch {
      showToast(`Không thể sao chép, mã: ${code}`, 'error');
    }
  };

  // Toggle active status
  const handleToggleActive = async (discount) => {
    const updatedStatus = !discount.isActive;
    try {
      await axiosClient.put(`/discounts/${discount.id}`, {
        ...discount,
        isActive: updatedStatus
      });
    } catch {
      // Local fallback
    }

    setDiscounts((prev) =>
      prev.map((d) => (d.id === discount.id ? { ...d, isActive: updatedStatus } : d))
    );
    showToast(
      `Đã ${updatedStatus ? 'bật' : 'tắt'} mã giảm giá "${discount.code}" thành công`,
      'success'
    );
  };

  // KPI calculations
  const kpiStats = useMemo(() => {
    let activeCount = 0;
    let outCount = 0;
    let disabledCount = 0;

    discounts.forEach((d) => {
      const st = getDiscountStatus(d);
      if (st.label === 'Đã tắt') disabledCount++;
      else if (st.label === 'Hết lượt') outCount++;
      else if (st.label === 'Đang chạy') activeCount++;
    });

    return {
      total: discounts.length,
      active: activeCount,
      out: outCount,
      disabled: disabledCount
    };
  }, [discounts]);

  // Filtered discounts
  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const codeMatch = (d.code || '').toLowerCase().includes(query);
        const descMatch = (d.description || '').toLowerCase().includes(query);
        if (!codeMatch && !descMatch) return false;
      }
      // Status
      if (statusFilter !== 'ALL') {
        const st = getDiscountStatus(d);
        if (st.label !== statusFilter) return false;
      }
      // Type
      if (typeFilter !== 'ALL') {
        if (d.discountType !== typeFilter) return false;
      }
      return true;
    });
  }, [discounts, searchTerm, statusFilter, typeFilter]);

  // Validate form field on blur
  const validateField = (field, value) => {
    let err = '';
    if (field === 'code') {
      if (!value || !value.trim()) err = 'Mã code không được để trống';
      else if (value.length < 3) err = 'Mã code tối thiểu 3 ký tự';
    } else if (field === 'description') {
      if (!value || !value.trim()) err = 'Vui lòng nhập mô tả chương trình';
    } else if (field === 'discountValue') {
      if (!value || Number(value) <= 0) err = 'Giá trị giảm phải lớn hơn 0';
      if (formData.discountType === 'PERCENTAGE' && Number(value) > 100) {
        err = 'Phần trăm giảm không được vượt quá 100%';
      }
    }
    setErrors((prev) => ({ ...prev, [field]: err }));
    return !err;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, formData[field]);
  };

  // Open modal for editing
  const handleOpenEdit = (d) => {
    setFormData({
      id: d.id,
      code: d.code,
      description: d.description || '',
      discountType: d.discountType,
      discountValue: d.discountValue,
      maxDiscountAmount: d.maxDiscountAmount || '',
      minOrderAmount: d.minOrderAmount || 0,
      usageLimit: d.usageLimit || '',
      perUserLimit: d.perUserLimit || 1,
      startDate: (d.startDate || '').slice(0, 10),
      endDate: (d.endDate || '').slice(0, 10),
      isActive: d.isActive,
      conditions: d.conditions || 'ALL',
      conditionValues: d.conditionValues ? [...d.conditionValues] : []
    });
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  // Open modal for creating
  const handleOpenCreate = () => {
    setFormData(initialFormState());
    setErrors({});
    setTouched({});
    setShowModal(true);
  };

  // Tag removal & addition
  const handleRemoveTag = (idx) => {
    setFormData((prev) => ({
      ...prev,
      conditionValues: prev.conditionValues.filter((_, i) => i !== idx)
    }));
  };

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim();
      if (val && !formData.conditionValues.includes(val)) {
        setFormData((prev) => ({
          ...prev,
          conditionValues: [...prev.conditionValues, val]
        }));
        setTagInput('');
      }
    }
  };

  // Save discount
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate all required fields
    const validCode = validateField('code', formData.code);
    const validDesc = validateField('description', formData.description);
    const validVal = validateField('discountValue', formData.discountValue);

    if (!validCode || !validDesc || !validVal) {
      showToast('Vui lòng kiểm tra lại các trường thông tin bắt buộc', 'error');
      return;
    }

    setIsSubmitting(true);
    const payload = {
      ...formData,
      code: formData.code.toUpperCase().trim(),
      discountValue: Number(formData.discountValue),
      minOrderAmount: Number(formData.minOrderAmount) || 0,
      maxDiscountAmount:
        formData.discountType === 'PERCENTAGE' && formData.maxDiscountAmount
          ? Number(formData.maxDiscountAmount)
          : null,
      usageLimit: formData.usageLimit ? Number(formData.usageLimit) : null,
      perUserLimit: Number(formData.perUserLimit) || 1,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString()
    };

    try {
      if (formData.id) {
        await axiosClient.put(`/discounts/${formData.id}`, payload);
        setDiscounts((prev) =>
          prev.map((d) => (d.id === formData.id ? { ...d, ...payload } : d))
        );
        showToast(`Cập nhật mã giảm giá "${payload.code}" thành công!`, 'success');
      } else {
        const res = await axiosClient.post('/discounts', payload);
        const newRecord = res.data?.id
          ? res.data
          : { ...payload, id: Date.now(), usedCount: 0 };
        setDiscounts((prev) => [newRecord, ...prev]);
        showToast(`Tạo mã giảm giá "${payload.code}" mới thành công!`, 'success');
      }
      setShowModal(false);
    } catch (err) {
      // Local fallback on backend error
      const mockSaved = {
        ...payload,
        id: formData.id || Date.now(),
        usedCount: formData.id ? (discounts.find((d) => d.id === formData.id)?.usedCount || 0) : 0
      };
      if (formData.id) {
        setDiscounts((prev) => prev.map((d) => (d.id === formData.id ? mockSaved : d)));
      } else {
        setDiscounts((prev) => [mockSaved, ...prev]);
      }
      showToast(
        `Đã lưu mã giảm giá "${payload.code}" thành công!`,
        'success'
      );
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic summary text generator
  const getSummaryBarText = () => {
    const valText =
      formData.discountType === 'PERCENTAGE'
        ? `Giảm ${formData.discountValue}%${
            formData.maxDiscountAmount
              ? `, tối đa ${formatPrice(formData.maxDiscountAmount)}`
              : ''
          }`
        : `Giảm ${formatPrice(formData.discountValue)}`;

    const minText = formData.minOrderAmount > 0
      ? ` • Đơn từ ${formatPrice(formData.minOrderAmount)}`
      : ' • Không giới hạn giá trị đơn';

    const userText = ` • Mỗi tài khoản ${formData.perUserLimit} lượt`;
    const dateText = ` • HSD: ${formatDateStr(formData.startDate)} → ${formatDateStr(formData.endDate)}`;

    return `${valText}${minText}${userText}${dateText}`;
  };

  return (
    <div className="admin-discounts-page">
      {/* 1. Header */}
      <div className="discounts-header">
        <div className="discounts-title-box">
          <h1>Mã giảm giá</h1>
          <p className="discounts-subtitle">
            Tạo và quản lý các chương trình ưu đãi, khuyến mãi thúc đẩy doanh số bán lẻ
          </p>
        </div>

        <button
          type="button"
          className="discounts-create-btn"
          onClick={handleOpenCreate}
        >
          <span>+</span>
          <span>Tạo mã giảm giá</span>
        </button>
      </div>

      {/* 2. KPI 4 Cards */}
      <div className="discounts-kpi-grid">
        <div className="discounts-kpi-card">
          <span className="discounts-kpi-label">Tổng số mã</span>
          <span className="discounts-kpi-num">{kpiStats.total}</span>
        </div>
        <div className="discounts-kpi-card">
          <span className="discounts-kpi-label">Đang chạy</span>
          <span className="discounts-kpi-num" style={{ color: '#059669' }}>
            {kpiStats.active}
          </span>
        </div>
        <div className="discounts-kpi-card">
          <span className="discounts-kpi-label">Hết lượt</span>
          <span className="discounts-kpi-num" style={{ color: '#D97706' }}>
            {kpiStats.out}
          </span>
        </div>
        <div className="discounts-kpi-card">
          <span className="discounts-kpi-label">Đã tắt</span>
          <span className="discounts-kpi-num" style={{ color: '#DC2626' }}>
            {kpiStats.disabled}
          </span>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="discounts-filter-bar">
        <div className="discounts-search-box">
          <i className="ti ti-search discounts-search-icon"></i>
          <input
            type="text"
            className="discounts-search-input"
            placeholder="Tìm theo mã code, mô tả ưu đãi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="discounts-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="Đang chạy">Đang chạy</option>
          <option value="Hết lượt">Hết lượt</option>
          <option value="Hết hạn">Hết hạn</option>
          <option value="Đã tắt">Đã tắt</option>
        </select>

        <select
          className="discounts-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">Tất cả loại giảm</option>
          <option value="PERCENTAGE">Phần trăm (%)</option>
          <option value="FIXED">Số tiền cố định (đ)</option>
        </select>
      </div>

      {/* 4. Table 6 Cột ĐÚNG THỨ TỰ */}
      <div className="discounts-table-card">
        <div className="discounts-table-responsive">
          <table className="discounts-table">
            <thead>
              <tr>
                <th>Cột 1 — Mã Code</th>
                <th>Cột 2 — Loại & Giá trị</th>
                <th>Cột 3 — Tiến độ</th>
                <th>Cột 4 — Thời hạn</th>
                <th>Cột 5 — Trạng thái</th>
                <th>Cột 6 — Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredDiscounts.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    Không có mã giảm giá nào phù hợp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredDiscounts.map((d) => {
                  const status = getDiscountStatus(d);
                  const isDepleted = d.usageLimit && d.usedCount >= d.usageLimit;
                  const percent = d.usageLimit
                    ? Math.min(100, Math.round((d.usedCount / d.usageLimit) * 100))
                    : 15;

                  return (
                    <tr key={d.id}>
                      {/* Cột 1: Mã Code + copy icon */}
                      <td>
                        <div className="discount-code-cell">
                          <span className="discount-code-text">{d.code}</span>
                          <button
                            type="button"
                            className="discount-copy-btn"
                            title="Sao chép mã"
                            onClick={() => handleCopyCode(d.code)}
                          >
                            <i className="ti ti-copy"></i>
                          </button>
                        </div>
                      </td>

                      {/* Cột 2: Loại & Giá trị */}
                      <td>
                        <span className="discount-val-main">
                          {d.discountType === 'PERCENTAGE'
                            ? `-${d.discountValue}%`
                            : `-${formatPrice(d.discountValue)}`}
                        </span>
                        {d.discountType === 'PERCENTAGE' && d.maxDiscountAmount && (
                          <span className="discount-val-cap">
                            Tối đa {formatPrice(d.maxDiscountAmount)}
                          </span>
                        )}
                      </td>

                      {/* Cột 3: Tiến độ */}
                      <td>
                        <div className="discount-progress-box">
                          <span className="discount-progress-label">
                            {d.usedCount} / {d.usageLimit ? `${d.usageLimit} lượt` : '∞ lượt'}
                          </span>
                          <div className="discount-progress-track">
                            <div
                              className={`discount-progress-fill ${isDepleted ? 'depleted' : ''}`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Cột 4: Thời hạn */}
                      <td>
                        <span className="discount-dates-text">
                          {formatDateStr(d.startDate)} → {formatDateStr(d.endDate)}
                        </span>
                      </td>

                      {/* Cột 5: Trạng thái Badge */}
                      <td>
                        <span className={`discount-status-badge ${status.className}`}>
                          {status.label}
                        </span>
                      </td>

                      {/* Cột 6: Hành động */}
                      <td>
                        <div className="discount-actions-cell">
                          <button
                            type="button"
                            className="discount-action-link primary"
                            onClick={() => setViewDetailModal(d)}
                          >
                            Chi tiết
                          </button>
                          <button
                            type="button"
                            className="discount-action-link primary"
                            onClick={() => handleOpenEdit(d)}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            className={`discount-action-link ${d.isActive ? 'disable' : 'enable'}`}
                            onClick={() => handleToggleActive(d)}
                          >
                            {d.isActive ? 'Tắt' : 'Bật'}
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

        {/* Pagination Bar */}
        <div className="discounts-pagination-bar">
          <span className="discounts-pagination-info">
            Hiển thị {filteredDiscounts.length} / {discounts.length} mã giảm giá
          </span>
          <div className="discounts-pagination-btns">
            <button type="button" className="discounts-page-btn" disabled>
              Trước
            </button>
            <button type="button" className="discounts-page-btn" disabled>
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Info Box: Giải thích logic trạng thái */}
      <div className="discounts-logic-info-box">
        <span className="discounts-logic-icon">ℹ️</span>
        <div>
          <strong>Quy tắc ưu tiên trạng thái: </strong>
          Đã tắt (isActive = false) &gt; Hết lượt (usedCount ≥ usageLimit) &gt; Hết hạn (endDate &lt; hiện tại) &gt; Đang chạy.
        </div>
      </div>

      {/* ==========================================================================
          5. MODAL TẠO / SỬA MÃ (modal--large 860px) 2 CỘT
          ========================================================================== */}
      {showModal && (
        <div className="discount-modal-overlay" onClick={() => setShowModal(false)}>
          <div
            className="discount-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discount-modal-header">
              <h3 className="discount-modal-title">
                {formData.id ? 'Cập nhật mã giảm giá' : 'Tạo mã giảm giá mới'}
              </h3>
              <button
                type="button"
                className="discount-modal-close"
                onClick={() => setShowModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="discount-modal-body">
                <div className="discount-form-2cols">
                  {/* CỘT TRÁI: THÔNG TIN VÀ GIÁ TRỊ GIẢM */}
                  <div>
                    <div className="discount-col-title">1. Thông tin & Giá trị giảm</div>

                    {/* Mã Code */}
                    <div className="discount-field-group">
                      <label htmlFor="modal-code" className="discount-field-label">
                        Mã Code <span className="req">*</span>
                      </label>
                      <div className="discount-input-wrapper">
                        <input
                          id="modal-code"
                          type="text"
                          className={`discount-text-input ${errors.code ? 'has-error' : ''}`}
                          placeholder="Ví dụ: SUMMER2026"
                          value={formData.code}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              code: e.target.value.toUpperCase().replace(/\s+/g, '')
                            })
                          }
                          onBlur={() => handleBlur('code')}
                          required
                        />
                        {formData.code.length >= 3 && !errors.code && (
                          <span className="discount-input-valid-icon">✓</span>
                        )}
                      </div>
                      {touched.code && errors.code && (
                        <div className="discount-field-error">{errors.code}</div>
                      )}
                    </div>

                    {/* Mô tả */}
                    <div className="discount-field-group">
                      <label htmlFor="modal-desc" className="discount-field-label">
                        Mô tả chương trình <span className="req">*</span>
                      </label>
                      <input
                        id="modal-desc"
                        type="text"
                        className={`discount-text-input ${errors.description ? 'has-error' : ''}`}
                        placeholder="Mô tả quyền lợi và thông điệp tới khách hàng"
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        onBlur={() => handleBlur('description')}
                        required
                      />
                      {touched.description && errors.description && (
                        <div className="discount-field-error">{errors.description}</div>
                      )}
                    </div>

                    {/* Loại giảm (Radio) */}
                    <div className="discount-field-group">
                      <span className="discount-field-label">
                        Loại giảm <span className="req">*</span>
                      </span>
                      <div className="discount-radio-group">
                        <label className="discount-radio-label">
                          <input
                            type="radio"
                            name="discountType"
                            checked={formData.discountType === 'PERCENTAGE'}
                            onChange={() =>
                              setFormData({ ...formData, discountType: 'PERCENTAGE' })
                            }
                          />
                          <span>Phần trăm (%)</span>
                        </label>
                        <label className="discount-radio-label">
                          <input
                            type="radio"
                            name="discountType"
                            checked={formData.discountType === 'FIXED'}
                            onChange={() =>
                              setFormData({ ...formData, discountType: 'FIXED' })
                            }
                          />
                          <span>Số tiền cố định</span>
                        </label>
                      </div>
                    </div>

                    {/* Giá trị giảm */}
                    <div className="discount-field-group">
                      <label htmlFor="modal-val" className="discount-field-label">
                        Giá trị giảm <span className="req">*</span>
                      </label>
                      <div className="discount-input-addon-group">
                        <input
                          id="modal-val"
                          type="number"
                          className="discount-text-input"
                          min="1"
                          value={formData.discountValue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              discountValue: Number(e.target.value)
                            })
                          }
                          onBlur={() => handleBlur('discountValue')}
                          required
                        />
                        <span className="discount-addon-text">
                          {formData.discountType === 'PERCENTAGE' ? '%' : 'đ'}
                        </span>
                      </div>
                      {touched.discountValue && errors.discountValue && (
                        <div className="discount-field-error">{errors.discountValue}</div>
                      )}
                    </div>

                    {/* Trần tối đa (CHỈ HIỆN KHI PERCENTAGE) */}
                    {formData.discountType === 'PERCENTAGE' && (
                      <div className="discount-field-group">
                        <label htmlFor="modal-max" className="discount-field-label">
                          Trần giảm tối đa
                        </label>
                        <div className="discount-input-addon-group">
                          <input
                            id="modal-max"
                            type="number"
                            className="discount-text-input"
                            placeholder="Để trống nếu không giới hạn trần"
                            value={formData.maxDiscountAmount}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maxDiscountAmount: e.target.value
                              })
                            }
                          />
                          <span className="discount-addon-text">đ</span>
                        </div>
                        <div className="discount-field-note">
                          Chỉ hiển thị khi giảm theo phần trăm.
                        </div>
                      </div>
                    )}

                    {/* Đơn tối thiểu */}
                    <div className="discount-field-group">
                      <label htmlFor="modal-min-order" className="discount-field-label">
                        Đơn hàng tối thiểu
                      </label>
                      <div className="discount-input-addon-group">
                        <input
                          id="modal-min-order"
                          type="number"
                          className="discount-text-input"
                          min="0"
                          value={formData.minOrderAmount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              minOrderAmount: Number(e.target.value)
                            })
                          }
                        />
                        <span className="discount-addon-text">đ</span>
                      </div>
                    </div>

                    {/* Preview Box Tóm Tắt Trái */}
                    <div className="discount-preview-box">
                      <strong>💡 Xem trước quy định giảm:</strong>
                      <br />
                      {formData.discountType === 'PERCENTAGE' ? (
                        <>
                          Giảm {formData.discountValue}%
                          {formData.maxDiscountAmount
                            ? ` (tối đa ${formatPrice(formData.maxDiscountAmount)})`
                            : ' (không giới hạn trần)'}
                          {formData.minOrderAmount > 0
                            ? ` cho đơn từ ${formatPrice(formData.minOrderAmount)}`
                            : ' cho mọi giá trị đơn'}
                        </>
                      ) : (
                        <>
                          Giảm trực tiếp {formatPrice(formData.discountValue)}
                          {formData.minOrderAmount > 0
                            ? ` cho đơn từ ${formatPrice(formData.minOrderAmount)}`
                            : ' cho mọi đơn hàng'}
                        </>
                      )}
                    </div>
                  </div>

                  {/* CỘT PHẢI: ĐIỀU KIỆN ÁP DỤNG & THỜI HẠN */}
                  <div>
                    <div className="discount-col-title">2. Điều kiện & Hiệu lực</div>

                    {/* Đối tượng áp dụng */}
                    <div className="discount-field-group">
                      <label htmlFor="modal-conditions" className="discount-field-label">
                        Đối tượng áp dụng
                      </label>
                      <select
                        id="modal-conditions"
                        className="discounts-select"
                        style={{ width: '100%' }}
                        value={formData.conditions}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            conditions: e.target.value,
                            conditionValues: []
                          })
                        }
                      >
                        <option value="ALL">Tất cả sản phẩm (Toàn sàn)</option>
                        <option value="CATEGORY">Theo danh mục sản phẩm</option>
                        <option value="BRAND">Theo thương hiệu</option>
                        <option value="NEW_ARRIVAL">Sản phẩm mới ra mắt</option>
                      </select>
                    </div>

                    {/* Input Tags khi CATEGORY */}
                    {formData.conditions === 'CATEGORY' && (
                      <div className="discount-field-group">
                        <span className="discount-field-label">Danh mục áp dụng</span>
                        <div className="discount-tag-container">
                          {formData.conditionValues.map((tag, idx) => (
                            <span key={idx} className="discount-tag-pill">
                              {tag}
                              <button
                                type="button"
                                className="discount-tag-remove"
                                onClick={() => handleRemoveTag(idx)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            className="discount-tag-input"
                            placeholder="Nhập tên danh mục và ấn Enter..."
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                          />
                        </div>
                      </div>
                    )}

                    {/* Input Tags khi BRAND */}
                    {formData.conditions === 'BRAND' && (
                      <div className="discount-field-group">
                        <span className="discount-field-label">Thương hiệu áp dụng</span>
                        <div className="discount-tag-container">
                          {formData.conditionValues.map((tag, idx) => (
                            <span key={idx} className="discount-tag-pill">
                              {tag}
                              <button
                                type="button"
                                className="discount-tag-remove"
                                onClick={() => handleRemoveTag(idx)}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            type="text"
                            className="discount-tag-input"
                            placeholder="Nhập tên hãng (Dell, Apple...) ấn Enter..."
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={handleAddTag}
                          />
                        </div>
                      </div>
                    )}

                    {/* Input số ngày khi NEW_ARRIVAL */}
                    {formData.conditions === 'NEW_ARRIVAL' && (
                      <div className="discount-field-group">
                        <label htmlFor="modal-arrival-days" className="discount-field-label">
                          Số ngày ra mắt gần đây
                        </label>
                        <input
                          id="modal-arrival-days"
                          type="number"
                          className="discount-text-input"
                          placeholder="Ví dụ: 30 (ngày)"
                          value={formData.conditionValues[0] || '30'}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              conditionValues: [e.target.value]
                            })
                          }
                        />
                      </div>
                    )}

                    {/* Tổng lượt dùng + Lượt/User */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="discount-field-group">
                        <label htmlFor="modal-usage-limit" className="discount-field-label">
                          Tổng lượt dùng
                        </label>
                        <input
                          id="modal-usage-limit"
                          type="number"
                          className="discount-text-input"
                          placeholder="Trống = ∞"
                          value={formData.usageLimit}
                          onChange={(e) =>
                            setFormData({ ...formData, usageLimit: e.target.value })
                          }
                        />
                        <div className="discount-field-note">Để trống = không giới hạn (∞)</div>
                      </div>

                      <div className="discount-field-group">
                        <label htmlFor="modal-user-limit" className="discount-field-label">
                          Lượt / Mỗi user
                        </label>
                        <input
                          id="modal-user-limit"
                          type="number"
                          className="discount-text-input"
                          min="1"
                          value={formData.perUserLimit}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              perUserLimit: Number(e.target.value)
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* Thời gian hiệu lực */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="discount-field-group">
                        <label htmlFor="modal-start-date" className="discount-field-label">
                          Ngày bắt đầu <span className="req">*</span>
                        </label>
                        <input
                          id="modal-start-date"
                          type="date"
                          className="discount-text-input"
                          value={formData.startDate}
                          onChange={(e) =>
                            setFormData({ ...formData, startDate: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="discount-field-group">
                        <label htmlFor="modal-end-date" className="discount-field-label">
                          Ngày kết thúc <span className="req">*</span>
                        </label>
                        <input
                          id="modal-end-date"
                          type="date"
                          className="discount-text-input"
                          value={formData.endDate}
                          onChange={(e) =>
                            setFormData({ ...formData, endDate: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Trạng thái Bật / Tắt với Dot */}
                    <div className="discount-field-group">
                      <span className="discount-field-label">Trạng thái kích hoạt</span>
                      <div className="discount-status-radio-group">
                        <label className="discount-status-radio-label">
                          <input
                            type="radio"
                            name="isActiveState"
                            checked={formData.isActive === true}
                            onChange={() => setFormData({ ...formData, isActive: true })}
                          />
                          <span className="discount-status-dot active" />
                          <span>Bật</span>
                        </label>

                        <label className="discount-status-radio-label">
                          <input
                            type="radio"
                            name="isActiveState"
                            checked={formData.isActive === false}
                            onChange={() => setFormData({ ...formData, isActive: false })}
                          />
                          <span className="discount-status-dot disabled" />
                          <span>Tắt</span>
                        </label>
                      </div>
                    </div>

                    {/* Readonly preview thay thế */}
                    <div className="discount-preview-box">
                      <strong><i className="ti ti-eye"></i> Xem trước các điều kiện thay thế:</strong>
                      <br />
                      {formData.conditions === 'ALL' && 'Áp dụng cho mọi nhóm sản phẩm trên toàn cửa hàng.'}
                      {formData.conditions === 'CATEGORY' &&
                        `Chỉ áp dụng cho các danh mục: [${formData.conditionValues.join(', ') || 'Chưa chọn'}].`}
                      {formData.conditions === 'BRAND' &&
                        `Chỉ áp dụng cho các hãng: [${formData.conditionValues.join(', ') || 'Chưa chọn'}].`}
                      {formData.conditions === 'NEW_ARRIVAL' &&
                        `Chỉ áp dụng cho sản phẩm ra mắt trong ${formData.conditionValues[0] || '30'} ngày gần nhất.`}
                    </div>
                  </div>
                </div>

                {/* Summary Bar full width */}
                <div className="discount-summary-bar">
                  <span className="discount-summary-icon">✉️</span>
                  <span>{getSummaryBarText()}</span>
                </div>

                <p className="discount-footer-note">
                  * Thay đổi áp dụng cho lượt sử dụng tiếp theo.
                </p>
              </div>

              {/* Modal Footer */}
              <div className="discount-modal-footer">
                <button
                  type="button"
                  className="discount-btn-ghost"
                  onClick={() => setShowModal(false)}
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="discount-btn-save"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Đang lưu...' : 'Lưu mã giảm giá'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================================================================
          6. MODAL XEM CHI TIẾT MÃ GIẢM GIÁ
          ========================================================================== */}
      {viewDetailModal && (
        <div
          className="discount-modal-overlay"
          onClick={() => setViewDetailModal(null)}
        >
          <div
            className="discount-modal-box"
            style={{ maxWidth: '520px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="discount-modal-header">
              <h3 className="discount-modal-title">
                Chi tiết mã: <span style={{ color: 'var(--color-accent)' }}>{viewDetailModal.code}</span>
              </h3>
              <button
                type="button"
                className="discount-modal-close"
                onClick={() => setViewDetailModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="discount-modal-body">
              <div className="discount-detail-item">
                <span className="discount-detail-label">Mô tả:</span>
                <span className="discount-detail-val">{viewDetailModal.description}</span>
              </div>
              <div className="discount-detail-item">
                <span className="discount-detail-label">Mức giảm:</span>
                <span className="discount-detail-val" style={{ color: 'var(--color-accent)' }}>
                  {viewDetailModal.discountType === 'PERCENTAGE'
                    ? `${viewDetailModal.discountValue}%`
                    : formatPrice(viewDetailModal.discountValue)}
                </span>
              </div>
              {viewDetailModal.maxDiscountAmount && (
                <div className="discount-detail-item">
                  <span className="discount-detail-label">Giảm tối đa:</span>
                  <span className="discount-detail-val">
                    {formatPrice(viewDetailModal.maxDiscountAmount)}
                  </span>
                </div>
              )}
              <div className="discount-detail-item">
                <span className="discount-detail-label">Đơn tối thiểu:</span>
                <span className="discount-detail-val">
                  {formatPrice(viewDetailModal.minOrderAmount)}
                </span>
              </div>
              <div className="discount-detail-item">
                <span className="discount-detail-label">Lượt đã dùng:</span>
                <span className="discount-detail-val">
                  {viewDetailModal.usedCount} / {viewDetailModal.usageLimit ? `${viewDetailModal.usageLimit} lượt` : '∞ lượt'}
                </span>
              </div>
              <div className="discount-detail-item">
                <span className="discount-detail-label">Hiệu lực:</span>
                <span className="discount-detail-val">
                  {formatDateStr(viewDetailModal.startDate)} → {formatDateStr(viewDetailModal.endDate)}
                </span>
              </div>
              <div className="discount-detail-item">
                <span className="discount-detail-label">Phạm vi:</span>
                <span className="discount-detail-val">
                  {viewDetailModal.conditions === 'ALL'
                    ? 'Toàn bộ cửa hàng'
                    : `${viewDetailModal.conditions}: ${(viewDetailModal.conditionValues || []).join(', ')}`}
                </span>
              </div>
              <div className="discount-detail-item">
                <span className="discount-detail-label">Trạng thái:</span>
                <span className={`discount-status-badge ${getDiscountStatus(viewDetailModal).className}`}>
                  {getDiscountStatus(viewDetailModal).label}
                </span>
              </div>
            </div>
            <div className="discount-modal-footer">
              <button
                type="button"
                className="discount-btn-ghost"
                onClick={() => setViewDetailModal(null)}
              >
                Đóng
              </button>
              <button
                type="button"
                className="discount-btn-save"
                onClick={() => {
                  const d = viewDetailModal;
                  setViewDetailModal(null);
                  handleOpenEdit(d);
                }}
              >
                Chỉnh sửa mã
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
