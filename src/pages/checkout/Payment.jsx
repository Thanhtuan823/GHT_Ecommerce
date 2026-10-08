import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';

const Payment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axiosClient.get(`/orders/${orderId}`);
        setOrder(res.data);
        
        if (res.data.status !== 'PENDING_PAYMENT') {
          navigate(`/orders/${orderId}`);
          return;
        }
        
        const expiredTime = new Date(res.data.paymentExpiredAt).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((expiredTime - now) / 1000);
        setTimeLeft(diff > 0 ? diff : 0);
        
      } catch (err) {
        alert('Lỗi tải đơn hàng');
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, navigate]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerId);
          navigate(`/orders/${orderId}`);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, orderId, navigate]);

  const handleConfirmPaid = async () => {
    try {
      await axiosClient.put(`/orders/${orderId}/payment-confirm`);
      navigate(`/orders/${orderId}`);
    } catch (err) {
      alert('Có lỗi xảy ra, vui lòng thử lại');
    }
  };

  if (isLoading) return <div style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>;
  if (!order) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  const bankAccount = "1234567890";
  const bankName = "MB";
  const accountName = "CONG TY GHT ECOM";
  const amount = order.totalPrice;
  const content = `DH${order.id}`;
  const qrUrl = `https://img.vietqr.io/image/${bankName}-${bankAccount}-compact2.jpg?amount=${amount}&addInfo=${content}&accountName=${encodeURIComponent(accountName)}`;

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', background: 'var(--color-bg-white)', padding: '32px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
      <h2 style={{ marginBottom: '24px' }}>Thanh toán đơn hàng #{order.id}</h2>
      
      <div style={{ marginBottom: '24px', background: 'var(--color-danger-bg)', padding: '16px', borderRadius: '8px', color: 'var(--color-danger)' }}>
        <div style={{ fontSize: '14px', marginBottom: '8px' }}>Thời gian thanh toán còn lại</div>
        <div style={{ fontSize: '32px', fontWeight: '700' }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      <img src={qrUrl} alt="VietQR" style={{ width: '300px', height: '300px', marginBottom: '24px', borderRadius: '12px', border: '1px solid var(--color-border)' }} />
      
      <div style={{ marginBottom: '24px', textAlign: 'left', background: 'var(--color-bg-muted)', padding: '16px', borderRadius: '8px' }}>
        <p style={{ marginBottom: '8px' }}><strong>Ngân hàng:</strong> Ngân hàng Quân Đội (MB Bank)</p>
        <p style={{ marginBottom: '8px' }}><strong>Số tài khoản:</strong> {bankAccount}</p>
        <p style={{ marginBottom: '8px' }}><strong>Chủ tài khoản:</strong> {accountName}</p>
        <p style={{ marginBottom: '8px' }}><strong>Số tiền:</strong> {new Intl.NumberFormat('vi-VN').format(amount)} đ</p>
        <p style={{ marginBottom: '0' }}><strong>Nội dung CK:</strong> <strong style={{ color: 'var(--color-accent)' }}>{content}</strong></p>
      </div>

      <button className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }} onClick={handleConfirmPaid}>
        TÔI ĐÃ CHUYỂN KHOẢN
      </button>
      <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        * Hệ thống sẽ tự động xác nhận ngay sau khi nhận được tiền. Bấm nút trên nếu bạn đã chuyển khoản nhưng sau 5 phút chưa được duyệt.
      </p>
    </div>
  );
};

export default Payment;
