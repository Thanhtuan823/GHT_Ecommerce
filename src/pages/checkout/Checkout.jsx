import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import PaymentQrModal from './PaymentQrModal';
import './Checkout.css';

const Checkout = () => {
  const { cart, isCartLoading, fetchCart } = useCart();
  const { user, openVouchersModal } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Address State
  const [address, setAddress] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    provinceId: '',
    provinceName: '',
    districtId: '',
    districtName: '',
    wardCode: '',
    wardName: '',
    address: '',
    saveAddress: true
  });

  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  // Options State
  const [shippingMethod] = useState('ghn'); // GHN standard
  const [paymentMethod, setPaymentMethod] = useState('sepay'); // 'sepay' | 'cod'
  const [orderNote, setOrderNote] = useState('');

  // Discount & Fees State
  const [shippingFee, setShippingFee] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountStatus, setDiscountStatus] = useState('default'); // 'default' | 'success' | 'error'
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountMessage, setDiscountMessage] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);

  // Form Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // Created Order for Modal
  const [createdOrder, setCreatedOrder] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const items = cart?.items || [];
  const originalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalPrice = Math.max(0, originalAmount - discountAmount + shippingFee);

  // Redirect if cart is empty (only after cart is loaded)
  useEffect(() => {
    if (isCartLoading) return;
    if (!items || items.length === 0) {
      if (!createdOrder) {
        navigate('/cart');
      }
    }
  }, [items, isCartLoading, navigate, createdOrder]);

  // Load Provinces
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        const res = await axiosClient.get('/shipping/provinces');
        setProvinces(res.data.data || []);
      } catch (err) {
        console.error('Lỗi tải danh sách tỉnh/thành', err);
      }
    };
    loadProvinces();
  }, []);

  // Pre-fill user data & default shipping address
  useEffect(() => {
    if (user) {
      const def = user.defaultAddress || {};
      setAddress((prev) => ({
        ...prev,
        name: prev.name || def.name || user.name || '',
        phone: prev.phone || def.phone || user.phone || '',
        email: prev.email || user.email || '',
        provinceId: prev.provinceId || def.provinceId || '',
        provinceName: prev.provinceName || def.provinceName || '',
        districtId: prev.districtId || def.districtId || '',
        districtName: prev.districtName || def.districtName || '',
        wardCode: prev.wardCode || def.wardCode || '',
        wardName: prev.wardName || def.wardName || '',
        address: prev.address || def.address || ''
      }));

      if (def.provinceId) {
        axiosClient
          .get(`/shipping/districts/${def.provinceId}`)
          .then((res) => setDistricts(res.data?.data || []))
          .catch(() => {});
      }
      if (def.districtId) {
        axiosClient
          .get(`/shipping/wards/${def.districtId}`)
          .then((res) => setWards(res.data?.data || []))
          .catch(() => {});
      }
      if (def.districtId && def.wardCode) {
        axiosClient
          .post('/shipping/fee', {
            provinceId: Number(def.provinceId),
            districtId: Number(def.districtId),
            wardCode: def.wardCode,
            weight: 1000
          })
          .then((res) => {
            setShippingFee(originalAmount >= 5000000 ? 0 : res.data?.fee || 30000);
          })
          .catch(() => {
            setShippingFee(originalAmount >= 5000000 ? 0 : 30000);
          });
      }
    }
  }, [user]);

  // Handle Province change
  const handleProvinceChange = async (e) => {
    const pid = e.target.value;
    const selectedProv = provinces.find((p) => String(p.ProvinceID) === String(pid));
    setAddress((prev) => ({
      ...prev,
      provinceId: pid,
      provinceName: selectedProv?.ProvinceName || '',
      districtId: '',
      districtName: '',
      wardCode: '',
      wardName: ''
    }));
    setDistricts([]);
    setWards([]);
    setShippingFee(0);
    setErrors((prev) => ({ ...prev, provinceId: null }));

    if (pid) {
      try {
        const res = await axiosClient.get(`/shipping/districts/${pid}`);
        setDistricts(res.data.data || []);
      } catch (err) {
        console.error('Lỗi tải quận/huyện', err);
      }
    }
  };

  // Handle District change
  const handleDistrictChange = async (e) => {
    const did = e.target.value;
    const selectedDist = districts.find((d) => String(d.DistrictID) === String(did));
    setAddress((prev) => ({
      ...prev,
      districtId: did,
      districtName: selectedDist?.DistrictName || '',
      wardCode: '',
      wardName: ''
    }));
    setWards([]);
    setShippingFee(0);
    setErrors((prev) => ({ ...prev, districtId: null }));

    if (did) {
      try {
        const res = await axiosClient.get(`/shipping/wards/${did}`);
        setWards(res.data.data || []);
      } catch (err) {
        console.error('Lỗi tải phường/xã', err);
      }
    }
  };

  // Handle Ward change & calculate shipping fee
  const handleWardChange = async (e) => {
    const wid = e.target.value;
    const selectedWard = wards.find((w) => String(w.WardCode) === String(wid));
    setAddress((prev) => ({
      ...prev,
      wardCode: wid,
      wardName: selectedWard?.WardName || ''
    }));
    setErrors((prev) => ({ ...prev, wardCode: null }));

    if (wid) {
      try {
        const res = await axiosClient.post('/shipping/fee', {
          provinceId: Number(address.provinceId),
          districtId: Number(address.districtId),
          wardCode: wid,
          weight: 1000
        });
        // If order >= 5,000,000đ, policy is free shipping
        if (originalAmount >= 5000000) {
          setShippingFee(0);
        } else {
          setShippingFee(res.data.fee || 0);
        }
      } catch {
        setShippingFee(originalAmount >= 5000000 ? 0 : 30000);
      }
    } else {
      setShippingFee(0);
    }
  };

  // Validation
  const validateField = (field, val) => {
    if (!val || !val.toString().trim()) {
      return 'Trường này không được để trống';
    }
    if (field === 'email' && !/\S+@\S+\.\S+/.test(val)) {
      return 'Email không hợp lệ';
    }
    if (field === 'phone' && !/^[0-9+ ]{9,12}$/.test(val)) {
      return 'Số điện thoại không hợp lệ';
    }
    return null;
  };

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, address[field]);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  // Apply Discount
  const triggerApplyDiscount = async (codeToApply) => {
    const code = (codeToApply || discountCode).trim().toUpperCase();
    if (!code) return;
    setIsApplyingDiscount(true);
    setDiscountMessage('');
    try {
      const res = await axiosClient.post('/discounts/apply', {
        code,
        originalAmount,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      });
      setDiscountCode(code);
      setDiscountAmount(res.data.discountAmount || 0);
      setDiscountStatus('success');
      setDiscountMessage(
        res.data.message || `Đã áp dụng mã ${code}. Tiết kiệm được ${new Intl.NumberFormat('vi-VN').format(res.data.discountAmount)}đ`
      );
      toast.success(res.data.message || 'Áp dụng mã giảm giá thành công!');
    } catch (err) {
      setDiscountAmount(0);
      setDiscountStatus('error');
      const errMsg = err.response?.data?.message || 'Mã giảm giá không hợp lệ hoặc không đủ điều kiện';
      setDiscountMessage(errMsg);
      toast.error(errMsg);
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  const handleApplyDiscount = () => triggerApplyDiscount(discountCode);

  const handleRemoveDiscount = () => {
    setDiscountCode('');
    setDiscountAmount(0);
    setDiscountStatus('default');
    setDiscountMessage('');
  };

  // Submit Order
  const handleSubmitOrder = async (e) => {
    e.preventDefault();

    const requiredFields = ['name', 'phone', 'email', 'provinceId', 'districtId', 'wardCode', 'address'];
    const newErrors = {};
    requiredFields.forEach((field) => {
      const errorMsg = validateField(field, address[field]);
      if (errorMsg) newErrors[field] = errorMsg;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setTouched(requiredFields.reduce((acc, f) => ({ ...acc, [f]: true }), {}));
      toast.error('Vui lòng điền đầy đủ các thông tin giao hàng bắt buộc');
      return;
    }

    setIsSubmitting(true);
    try {
      const fullAddressString = [
        address.address,
        address.wardName,
        address.districtName,
        address.provinceName
      ].filter(Boolean).join(', ');

      const payload = {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: {
          ...address,
          fullAddress: fullAddressString
        },
        discountCode: discountStatus === 'success' ? discountCode.trim().toUpperCase() : null,
        shippingFee,
        orderNote,
        shippingMethod,
        paymentMethod: paymentMethod === 'cod' ? 'COD' : 'BANK_TRANSFER'
      };

      const res = await axiosClient.post('/orders', payload);
      await fetchCart();

      const newOrderId = res.data.orderId || res.data.order?.id;
      const newOrder = res.data.order || {
        id: newOrderId,
        totalPrice,
        paymentExpiredAt: res.data.paymentExpiredAt || new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };

      if (paymentMethod === 'cod') {
        toast.success(`Đặt hàng thành công! Đơn hàng COD #GHT${newOrderId} đang được xử lý đóng gói.`);
        navigate(`/orders/${newOrderId}`);
      } else {
        setCreatedOrder(newOrder);
        setShowQrModal(true);
        toast.success(`Đặt hàng thành công! Mã đơn: #GHT${newOrderId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi tạo đơn hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  if (isCartLoading) {
    return (
      <div className="checkout-loading-box" style={{ textAlign: 'center', padding: '100px 0' }}>
        <ButtonSpinner />
        <p style={{ marginTop: '12px', color: '#64748b' }}>Đang tải thông tin đơn hàng...</p>
      </div>
    );
  }

  return (
    <div className="checkout-page-wrapper">
      {/* Breadcrumb */}
      <nav className="checkout-breadcrumb" aria-label="Breadcrumb">
        <Link to="/cart">Giỏ hàng</Link>
        <span>/</span>
        <span className="checkout-breadcrumb-current">Thông tin giao hàng</span>
        <span>/</span>
        <span>Thanh toán</span>
      </nav>

      {/* Header */}
      <div className="checkout-header-box">
        <h1 className="checkout-header-title">Thanh toán đơn hàng</h1>
        <p className="checkout-header-sub">
          Vui lòng kiểm tra lại địa chỉ giao hàng và xác nhận phương thức thanh toán.
        </p>
      </div>

      {/* 2-Column Body Layout */}
      <div className="checkout-body-layout">
        {/* Left Column: Form Sections */}
        <div className="checkout-form-column">
          {/* Section 1: Thông tin nhận hàng */}
          <section className="checkout-section-card">
            <div className="checkout-section-header">
              <h2 className="checkout-section-title">1. Thông tin nhận hàng</h2>
              {user && (
                <button
                  type="button"
                  className="checkout-saved-address-link"
                  onClick={() => {
                    setAddress((prev) => ({
                      ...prev,
                      name: user.name || '',
                      phone: user.phone || '',
                      email: user.email || ''
                    }));
                    toast.info('Đã tải thông tin từ tài khoản của bạn');
                  }}
                >
                  Chọn địa chỉ đã lưu
                </button>
              )}
            </div>

            {/* Row 1: Họ tên + SĐT */}
            <div className="checkout-form-row">
              <div className="checkout-field-group">
                <label className="checkout-field-label">
                  Họ và tên <span className="checkout-required-star">*</span>
                </label>
                <input
                  type="text"
                  className={`input ${errors.name ? 'is-error' : touched.name && address.name ? 'is-success' : ''}`}
                  placeholder="Nguyễn Văn A"
                  value={address.name}
                  onChange={(e) => {
                    setAddress({ ...address, name: e.target.value });
                    setErrors({ ...errors, name: null });
                  }}
                  onBlur={() => handleBlur('name')}
                />
                {errors.name && <span className="error-message">{errors.name}</span>}
              </div>

              <div className="checkout-field-group">
                <label className="checkout-field-label">
                  Số điện thoại <span className="checkout-required-star">*</span>
                </label>
                <input
                  type="tel"
                  className={`input ${errors.phone ? 'is-error' : touched.phone && address.phone ? 'is-success' : ''}`}
                  placeholder="0901 234 567"
                  value={address.phone}
                  onChange={(e) => {
                    setAddress({ ...address, phone: e.target.value });
                    setErrors({ ...errors, phone: null });
                  }}
                  onBlur={() => handleBlur('phone')}
                />
                {errors.phone && <span className="error-message">{errors.phone}</span>}
              </div>
            </div>

            {/* Row 2: Email */}
            <div className="checkout-field-group">
              <label className="checkout-field-label">
                Email nhận thông tin đơn hàng <span className="checkout-required-star">*</span>
              </label>
              <input
                type="email"
                className={`input ${errors.email ? 'is-error' : touched.email && address.email ? 'is-success' : ''}`}
                placeholder="name@example.com"
                value={address.email}
                onChange={(e) => {
                  setAddress({ ...address, email: e.target.value });
                  setErrors({ ...errors, email: null });
                }}
                onBlur={() => handleBlur('email')}
              />
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            {/* Row 3: Tỉnh/Thành + Quận/Huyện */}
            <div className="checkout-form-row">
              <div className="checkout-field-group">
                <label className="checkout-field-label">
                  Tỉnh / Thành phố <span className="checkout-required-star">*</span>
                </label>
                <select
                  className={`input ${errors.provinceId ? 'is-error' : touched.provinceId && address.provinceId ? 'is-success' : ''}`}
                  value={address.provinceId}
                  onChange={handleProvinceChange}
                  onBlur={() => handleBlur('provinceId')}
                >
                  <option value="">Chọn Tỉnh / Thành phố</option>
                  {provinces.map((p) => (
                    <option key={p.ProvinceID} value={p.ProvinceID}>
                      {p.ProvinceName}
                    </option>
                  ))}
                </select>
                {errors.provinceId && <span className="error-message">{errors.provinceId}</span>}
              </div>

              <div className="checkout-field-group">
                <label className="checkout-field-label">
                  Quận / Huyện <span className="checkout-required-star">*</span>
                </label>
                <select
                  className={`input ${errors.districtId ? 'is-error' : touched.districtId && address.districtId ? 'is-success' : ''}`}
                  value={address.districtId}
                  onChange={handleDistrictChange}
                  onBlur={() => handleBlur('districtId')}
                  disabled={!address.provinceId}
                >
                  <option value="">Chọn Quận / Huyện</option>
                  {districts.map((d) => (
                    <option key={d.DistrictID} value={d.DistrictID}>
                      {d.DistrictName}
                    </option>
                  ))}
                </select>
                {errors.districtId && <span className="error-message">{errors.districtId}</span>}
              </div>
            </div>

            {/* Row bổ sung: Phường/Xã (khi đã chọn quận) */}
            {address.districtId && (
              <div className="checkout-field-group">
                <label className="checkout-field-label">
                  Phường / Xã <span className="checkout-required-star">*</span>
                </label>
                <select
                  className={`input ${errors.wardCode ? 'is-error' : touched.wardCode && address.wardCode ? 'is-success' : ''}`}
                  value={address.wardCode}
                  onChange={handleWardChange}
                  onBlur={() => handleBlur('wardCode')}
                >
                  <option value="">Chọn Phường / Xã</option>
                  {wards.map((w) => (
                    <option key={w.WardCode} value={w.WardCode}>
                      {w.WardName}
                    </option>
                  ))}
                </select>
                {errors.wardCode && <span className="error-message">{errors.wardCode}</span>}
              </div>
            )}

            {/* Row 4: Số nhà, tên đường */}
            <div className="checkout-field-group">
              <label className="checkout-field-label">
                Số nhà, tên đường <span className="checkout-required-star">*</span>
              </label>
              <input
                type="text"
                className={`input ${errors.address ? 'is-error' : touched.address && address.address ? 'is-success' : ''}`}
                placeholder="Ví dụ: 123 Nguyễn Huệ, Phường Bến Nghé"
                value={address.address}
                onChange={(e) => {
                  setAddress({ ...address, address: e.target.value });
                  setErrors({ ...errors, address: null });
                }}
                onBlur={() => handleBlur('address')}
              />
              {errors.address && <span className="error-message">{errors.address}</span>}
            </div>

            {/* Checkbox: Lưu địa chỉ */}
            <label className="auth-checkbox-label">
              <input
                type="checkbox"
                checked={address.saveAddress}
                onChange={(e) => setAddress({ ...address, saveAddress: e.target.checked })}
              />
              <span>Lưu địa chỉ cho lần mua sau</span>
            </label>
          </section>

          {/* Section 2: Vận chuyển & thanh toán */}
          {/* Section 2: Vận chuyển & thanh toán */}
          <section className="checkout-section-card">
            <div className="checkout-section-header">
              <h2 className="checkout-section-title">2. Vận chuyển & thanh toán</h2>
            </div>

            {/* KHỐI TRÊN: Phương thức thanh toán (Radio group chọn 1 trong 2) */}
            <div className="checkout-sub-section">
              <h3 className="checkout-sub-title">
                <i className="ti ti-wallet"></i> Phương thức thanh toán
              </h3>

              <div className="checkout-methods-group">
                {/* Option 1: SePay QR */}
                <div
                  className={`checkout-radio-option-card ${paymentMethod === 'sepay' ? 'is-selected' : ''}`}
                  onClick={() => setPaymentMethod('sepay')}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="checkout-radio-input"
                    checked={paymentMethod === 'sepay'}
                    onChange={() => setPaymentMethod('sepay')}
                  />
                  <div className="checkout-radio-content">
                    <div className="checkout-radio-title-row">
                      <span className="checkout-radio-name">
                        🏦 Chuyển khoản ngân hàng qua QR (SePay)
                      </span>
                      <span className="checkout-badge-method">SePay QR</span>
                    </div>
                    <p className="checkout-radio-sub">
                      Quét mã QR qua app ngân hàng, chuyển đúng số tiền và nội dung đơn hàng để kích hoạt tự động.
                    </p>
                  </div>
                </div>

                {/* Option 2: COD Tiền mặt */}
                <div
                  className={`checkout-radio-option-card ${paymentMethod === 'cod' ? 'is-selected' : ''}`}
                  onClick={() => setPaymentMethod('cod')}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="checkout-radio-input"
                    checked={paymentMethod === 'cod'}
                    onChange={() => setPaymentMethod('cod')}
                  />
                  <div className="checkout-radio-content">
                    <div className="checkout-radio-title-row">
                      <span className="checkout-radio-name">
                        💵 Thanh toán bằng tiền mặt khi nhận hàng (COD)
                      </span>
                      <span className="checkout-badge-cod">Tiền mặt</span>
                    </div>
                    <p className="checkout-radio-sub">
                      Thanh toán tiền mặt trực tiếp cho nhân viên giao hàng khi nhận máy.
                    </p>
                    <div className="checkout-cod-notice-box">
                      <i className="ti ti-info-circle"></i>
                      <span>
                        Với đơn hàng công nghệ giá trị cao (từ 5.000.000đ trở lên), nhân viên sẽ liên hệ hướng dẫn quý khách đặt cọc trước 200.000đ – 500.000đ qua mã QR để kích hoạt giao hàng, số tiền còn lại thanh toán cho shipper khi nhận máy.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KHỐI DƯỚI: Đơn vị vận chuyển (GHN Express) */}
            <div className="checkout-sub-section">
              <h3 className="checkout-sub-title">
                <i className="ti ti-truck-delivery"></i> Đơn vị vận chuyển
              </h3>

              <div className="checkout-radio-option-card is-selected is-shipping-fixed">
                <div className="checkout-shipping-icon-dot">
                  <i className="ti ti-check"></i>
                </div>
                <div className="checkout-radio-content">
                  <div className="checkout-radio-title-row">
                    <span className="checkout-radio-name">
                      🚚 Giao Hàng Nhanh (GHN Express)
                    </span>
                    <span className="checkout-badge-free">
                      {shippingFee > 0 ? formatPrice(shippingFee) : 'Miễn phí'}
                    </span>
                  </div>
                  <p className="checkout-radio-sub">
                    Dự kiến nhận sau 2–3 ngày làm việc • Giao hàng tận nhà toàn quốc • Bảo hiểm 100% hàng hóa
                  </p>
                </div>
              </div>
            </div>

            {/* Order Note */}
            <div className="checkout-field-group">
              <label className="checkout-field-label">Ghi chú cho đơn hàng (tùy chọn)</label>
              <textarea
                className="input checkout-note-textarea"
                rows="2"
                placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
              />
            </div>

            <p className="checkout-section-note">
              {paymentMethod === 'sepay'
                ? 'Trạng thái thanh toán chỉ được cập nhật sau khi giao dịch chuyển khoản được ngân hàng xác nhận.'
                : 'Đơn hàng COD sẽ được nhân viên GHT xác nhận và đóng gói chuyển phát sớm nhất.'}
            </p>
          </section>
        </div>

        {/* Right Column: Order Summary (Sticky) */}
        <aside className="checkout-summary-column">
          <h2 className="checkout-summary-title">Đơn hàng của bạn</h2>

          {/* Items compact list */}
          <div className="checkout-items-list">
            {items.map((item) => (
              <div key={item.productId} className="checkout-item-compact-row">
                <div className="checkout-item-image-wrapper">
                  <img
                    src={item.image || '/images/premium.png'}
                    alt={item.productName}
                    className="checkout-item-image"
                  />
                  <span className="checkout-item-qty-badge">{item.quantity}</span>
                </div>

                <div className="checkout-item-name-col">
                  <span className="checkout-item-name" title={item.productName}>
                    {item.productName}
                  </span>
                </div>

                <span className="checkout-item-price-val">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Discount Box */}
          {discountStatus === 'success' ? (
            <div className="checkout-discount-applied-box">
              <div className="checkout-discount-header">
                <span>✓ Đã áp dụng mã {discountCode.toUpperCase()}</span>
                <button
                  type="button"
                  className="checkout-discount-remove-btn"
                  onClick={handleRemoveDiscount}
                  title="Xóa mã giảm giá"
                >
                  ✕
                </button>
              </div>
              <p className="checkout-discount-saving">
                Tiết kiệm được {formatPrice(discountAmount)}
              </p>
              <p className="checkout-discount-sub">
                {discountMessage || 'Mã ưu đãi đã được áp dụng thành công'}
              </p>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text-secondary)' }}>Mã ưu đãi / Voucher</span>
                <button
                  id="checkout-open-vouchers-btn"
                  type="button"
                  onClick={() => openVouchersModal({
                    currentOrderAmount: originalAmount,
                    onApply: (selectedCode) => {
                      setDiscountCode(selectedCode);
                      triggerApplyDiscount(selectedCode);
                    }
                  })}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-primary, #2563eb)',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '0'
                  }}
                >
                  <i className="ti ti-ticket"></i> 🎟️ Chọn mã ưu đãi
                </button>
              </div>
              <div className="checkout-discount-input-row">
                <input
                  id="checkout-discount-input"
                  type="text"
                  className={`input checkout-discount-input ${discountStatus === 'error' ? 'is-error' : ''}`}
                  placeholder="Nhập mã ưu đãi (VD: GHTSALE10)"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value);
                    if (discountStatus === 'error') setDiscountStatus('default');
                  }}
                  disabled={isApplyingDiscount}
                />
                <button
                  id="checkout-apply-discount-btn"
                  type="button"
                  className="btn-dark"
                  onClick={handleApplyDiscount}
                  disabled={!discountCode.trim() || isApplyingDiscount}
                >
                  {isApplyingDiscount ? <ButtonSpinner /> : 'Áp dụng'}
                </button>
              </div>
              {discountStatus === 'error' && (
                <span id="checkout-discount-error-msg" className="error-message checkout-discount-error-msg">
                  {discountMessage}
                </span>
              )}
            </div>
          )}

          {/* Price Calculation Table */}
          <div className="checkout-calc-table">
            <div className="checkout-calc-row">
              <span>Tổng tiền gốc</span>
              <span className={`checkout-calc-original-amount ${discountAmount > 0 ? 'has-discount' : ''}`}>
                {formatPrice(originalAmount)}
              </span>
            </div>

            <div className="checkout-calc-row">
              <span>Vận chuyển GHN</span>
              <span className="checkout-calc-free">Miễn phí</span>
            </div>

            {discountAmount > 0 && (
              <div className="checkout-calc-row is-discount">
                <span>Giảm giá</span>
                <span>– {formatPrice(discountAmount)}</span>
              </div>
            )}

            <div className="checkout-calc-divider" />

            <div className="checkout-total-row">
              <span className="checkout-total-label">Tổng thanh toán</span>
              <span className="checkout-total-amount">{formatPrice(totalPrice)}</span>
            </div>

            <p className="checkout-vat-note">
              Đã bao gồm VAT. Miễn phí vận chuyển toàn quốc cho mọi đơn hàng.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="button"
            className="btn-primary checkout-submit-btn"
            onClick={handleSubmitOrder}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <ButtonSpinner /> Đang xử lý...
              </>
            ) : (
              'Đặt hàng ngay'
            )}
          </button>

          <p className="checkout-terms-note">
            Bằng việc đặt hàng, bạn đồng ý với Điều khoản sử dụng và Chính sách giao dịch của GHT.
          </p>
        </aside>
      </div>

      {/* Payment QR Modal Popup */}
      {showQrModal && createdOrder && (
        <PaymentQrModal
          order={createdOrder}
          onClose={() => {
            setShowQrModal(false);
            navigate(`/orders/${createdOrder.id}`);
          }}
        />
      )}
    </div>
  );
};

export default Checkout;
