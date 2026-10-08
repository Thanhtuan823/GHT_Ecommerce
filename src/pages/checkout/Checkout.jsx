import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import axiosClient from '../../utils/axiosClient';

const Checkout = () => {
  const { cart, fetchCart } = useCart();
  const navigate = useNavigate();

  const [address, setAddress] = useState({ name: '', phone: '', provinceId: '', districtId: '', wardCode: '', address: '' });
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  
  const [shippingFee, setShippingFee] = useState(0);
  const [discountCode, setDiscountCode] = useState('');
  const [discountStatus, setDiscountStatus] = useState('default'); // default, success, error
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountMessage, setDiscountMessage] = useState('');
  
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

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      alert(err.response?.data?.message || 'Lỗi đặt hàng');
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 24px', display: 'flex', gap: '32px' }}>
      <div style={{ flex: 2 }}>
        <h2>Thông tin giao hàng</h2>
        <form id="checkout-form" onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Họ tên</label>
            <input className="input" style={{ width: '100%' }} value={address.name} onChange={e => setAddress({...address, name: e.target.value})} required />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Số điện thoại</label>
            <input className="input" style={{ width: '100%' }} value={address.phone} onChange={e => setAddress({...address, phone: e.target.value})} required />
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Tỉnh/Thành</label>
              <select className="input" style={{ width: '100%' }} value={address.provinceId} onChange={handleProvinceChange} required>
                <option value="">Chọn Tỉnh/Thành</option>
                {provinces.map(p => <option key={p.ProvinceID} value={p.ProvinceID}>{p.ProvinceName}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Quận/Huyện</label>
              <select className="input" style={{ width: '100%' }} value={address.districtId} onChange={handleDistrictChange} required disabled={!address.provinceId}>
                <option value="">Chọn Quận/Huyện</option>
                {districts.map(d => <option key={d.DistrictID} value={d.DistrictID}>{d.DistrictName}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px' }}>Phường/Xã</label>
              <select className="input" style={{ width: '100%' }} value={address.wardCode} onChange={handleWardChange} required disabled={!address.districtId}>
                <option value="">Chọn Phường/Xã</option>
                {wards.map(w => <option key={w.WardCode} value={w.WardCode}>{w.WardName}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px' }}>Địa chỉ cụ thể (Số nhà, đường...)</label>
            <input className="input" style={{ width: '100%' }} value={address.address} onChange={e => setAddress({...address, address: e.target.value})} required />
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

        <button type="submit" form="checkout-form" className="btn-primary" style={{ width: '100%', marginTop: '24px', padding: '14px', fontSize: '16px' }}>
          ĐẶT HÀNG
        </button>
      </div>
    </div>
  );
};

export default Checkout;
