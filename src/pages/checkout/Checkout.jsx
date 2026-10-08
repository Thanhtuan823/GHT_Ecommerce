import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ButtonSpinner from '../../components/common/ButtonSpinner';

const Checkout = () => {
  const { cart, fetchCart } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  const [address, setAddress] = useState({ name: '', phone: '', provinceId: '', districtId: '', wardCode: '', address: '' });
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  
  const [shippingFee, setShippingFee] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountStatus, setDiscountStatus] = useState('default'); // default, success, error
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountMessage, setDiscountMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  
  const originalAmount = cart?.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
  const totalPrice = originalAmount - discountAmount + shippingFee;

  useEffect(() => {
    if (!cart?.items || cart.items.length === 0) {
      navigate('/cart');
      return;
    }
    axiosClient.get('/shipping/provinces').then(res => setProvinces(res.data.data || []));
  }, []);

  const handleProvinceChange = async (e) => {
    const pid = e.target.value;
    setAddress({ ...address, provinceId: pid, districtId: '', wardCode: '' });
    setWards([]);
    setShippingFee(0);
    if (pid) {
      const res = await axiosClient.get(`/shipping/districts/${pid}`);
      setDistricts(res.data.data || []);
    } else {
      setDistricts([]);
    }
  };

  const handleDistrictChange = async (e) => {
    const did = e.target.value;
    setAddress({ ...address, districtId: did, wardCode: '' });
    setShippingFee(0);
    if (did) {
      const res = await axiosClient.get(`/shipping/wards/${did}`);
      setWards(res.data.data || []);
    } else {
      setWards([]);
    }
  };

  const handleWardChange = async (e) => {
    const wid = e.target.value;
    setAddress({ ...address, wardCode: wid });
    if (wid) {
      try {
        const res = await axiosClient.post('/shipping/fee', {
          provinceId: address.provinceId,
          districtId: address.districtId,
          wardCode: wid,
          weight: 1000
        });
        setShippingFee(res.data.fee || 30000);
      } catch {
        setShippingFee(30000);
      }
    } else {
      setShippingFee(0);
    }
  };

  const handleApplyDiscount = async () => {
    if (!discountCode) return;
    try {
      const res = await axiosClient.post('/discounts/apply', {
        code: discountCode,
        originalAmount,
        items: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      });
      setDiscountAmount(res.data.discountAmount);
      setDiscountStatus('success');
      setDiscountMessage(`Đã áp dụng mã ${discountCode}. Tiết kiệm được ${new Intl.NumberFormat('vi-VN').format(res.data.discountAmount)}đ`);
    } catch (err) {
      setDiscountAmount(0);
      setDiscountStatus('error');
      setDiscountMessage(err.response?.data?.message || 'Lỗi áp dụng mã');
    }
  };

  const handleRemoveDiscount = () => {
    setDiscountCode('');
    setDiscountAmount(0);
    setDiscountStatus('default');
    setDiscountMessage('');
  };

  const handleBlur = (field) => {
    if (!address[field]) {
      setErrors(prev => ({ ...prev, [field]: 'Trường này không được để trống' }));
    } else {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    Object.keys(address).forEach(k => {
      if (!address[k]) newErrors[k] = 'Trường này không được để trống';
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.items.map(i => ({ productId: i.productId, quantity: i.quantity })),
        shippingAddress: address,
        discountCode: discountStatus === 'success' ? discountCode : null,
        shippingFee
      };
      const res = await axiosClient.post('/orders', payload);
      await fetchCart();
      navigate(`/payment/${res.data.orderId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi đặt hàng');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 24px', display: 'flex', gap: '32px' }}>
      <div style={{ flex: 2 }}>
        <h2>Thông tin giao hàng</h2>
        <form id="checkout-form" onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Họ tên</label>
            <input className={`input ${errors.name ? 'is-error' : ''}`} style={{ width: '100%' }} value={address.name} onChange={e => {setAddress({...address, name: e.target.value}); setErrors({...errors, name: null})}} onBlur={() => handleBlur('name')} />
            {errors.name && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{errors.name}</div>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Số điện thoại</label>
            <input className={`input ${errors.phone ? 'is-error' : ''}`} style={{ width: '100%' }} value={address.phone} onChange={e => {setAddress({...address, phone: e.target.value}); setErrors({...errors, phone: null})}} onBlur={() => handleBlur('phone')} />
            {errors.phone && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{errors.phone}</div>}
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Tỉnh/Thành</label>
              <select className={`input ${errors.provinceId ? 'is-error' : ''}`} style={{ width: '100%' }} value={address.provinceId} onChange={e => { handleProvinceChange(e); setErrors({...errors, provinceId: null}); }} onBlur={() => handleBlur('provinceId')}>
                <option value="">Chọn Tỉnh/Thành</option>
                {provinces.map(p => <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>)}
              </select>
              {errors.provinceId && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{errors.provinceId}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Quận/Huyện</label>
              <select className={`input ${errors.districtId ? 'is-error' : ''}`} style={{ width: '100%' }} value={address.districtId} onChange={e => { handleDistrictChange(e); setErrors({...errors, districtId: null}); }} onBlur={() => handleBlur('districtId')} disabled={!address.provinceId}>
                <option value="">Chọn Quận/Huyện</option>
                {districts.map(d => <option key={d.DistrictID} value={d.DistrictID}>{d.DistrictName}</option>)}
              </select>
              {errors.districtId && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{errors.districtId}</div>}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Phường/Xã</label>
              <select className={`input ${errors.wardCode ? 'is-error' : ''}`} style={{ width: '100%' }} value={address.wardCode} onChange={e => { handleWardChange(e); setErrors({...errors, wardCode: null}); }} onBlur={() => handleBlur('wardCode')} disabled={!address.districtId}>
                <option value="">Chọn Phường/Xã</option>
                {wards.map(w => <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>)}
              </select>
              {errors.wardCode && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{errors.wardCode}</div>}
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Địa chỉ cụ thể (Số nhà, đường...)</label>
            <input className={`input ${errors.address ? 'is-error' : ''}`} style={{ width: '100%' }} value={address.address} onChange={e => {setAddress({...address, address: e.target.value}); setErrors({...errors, address: null})}} onBlur={() => handleBlur('address')} />
            {errors.address && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{errors.address}</div>}
          </div>
        </form>
      </div>

      <div style={{ flex: 1, background: 'var(--color-bg-white)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', height: 'fit-content' }}>
        <h3>Đơn hàng của bạn</h3>
        <div style={{ margin: '24px 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '16px' }}>
          {cart?.items.map(item => (
            <div key={item.productId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <span>{item.productName} <strong style={{ color: 'var(--color-accent)' }}>x{item.quantity}</strong></span>
              <strong>{new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)} đ</strong>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '8px' }}>Mã giảm giá</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              className={`input ${discountStatus === 'error' ? 'is-error' : discountStatus === 'success' ? 'is-success' : ''}`} 
              style={{ flex: 1 }} 
              value={discountCode} 
              onChange={e => setDiscountCode(e.target.value)} 
              disabled={discountStatus === 'success'}
              placeholder="Nhập mã" 
            />
            {discountStatus === 'success' ? (
              <button type="button" className="btn-ghost" onClick={handleRemoveDiscount}>✕</button>
            ) : (
              <button type="button" className="btn-dark" onClick={handleApplyDiscount}>Áp dụng</button>
            )}
          </div>
          {discountMessage && (
            <div style={{ 
              marginTop: '8px', fontSize: '13px', 
              color: discountStatus === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              padding: '8px', background: discountStatus === 'success' ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              borderRadius: '8px'
            }}>
              {discountStatus === 'success' ? '✓ ' : ''}{discountMessage}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: 'var(--color-text-secondary)' }}>
          <span>Tiền gốc</span>
          <span>{new Intl.NumberFormat('vi-VN').format(originalAmount)} đ</span>
        </div>
        {discountAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', color: 'var(--color-success)', fontWeight: '600' }}>
            <span>Đã giảm</span>
            <span>- {new Intl.NumberFormat('vi-VN').format(discountAmount)} đ</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: 'var(--color-text-secondary)' }}>
          <span>Phí vận chuyển</span>
          <span>{shippingFee > 0 ? new Intl.NumberFormat('vi-VN').format(shippingFee) + ' đ' : 'Chưa tính'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed var(--color-border)', fontSize: '20px' }}>
          <span>Tổng cộng</span>
          <strong style={{ color: 'var(--color-accent)' }}>{new Intl.NumberFormat('vi-VN').format(totalPrice)} đ</strong>
        </div>

        <button type="submit" form="checkout-form" className="btn-primary" style={{ width: '100%', marginTop: '24px', padding: '14px', fontSize: '16px' }} disabled={isSubmitting}>
          {isSubmitting ? <><ButtonSpinner /> ĐANG XỬ LÝ...</> : 'ĐẶT HÀNG'}
        </button>
      </div>
    </div>
  );
};

export default Checkout;
