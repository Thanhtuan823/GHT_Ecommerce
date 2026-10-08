import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { getOrderStatus } from '../../utils/orderStatusHelper';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axiosClient.get('/orders/myorders');
        setOrders(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  if (isLoading) return <div style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '40px auto', padding: '0 24px' }}>
      <h2 style={{ marginBottom: '24px' }}>Lịch sử đơn hàng</h2>
      
      {orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', background: 'var(--color-bg-white)', borderRadius: '12px' }}>
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link to="/products" className="btn-primary" style={{ display: 'inline-block', marginTop: '16px', textDecoration: 'none' }}>Mua sắm ngay</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {orders.map(order => {
            const status = getOrderStatus(order.status);
            return (
              <div key={order.id} style={{ background: 'var(--color-bg-white)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Đơn hàng #{order.id}</strong>
                    <span style={{ marginLeft: '12px', color: 'var(--color-text-muted)', fontSize: '14px' }}>{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                    {order.orderItems?.length || 0} sản phẩm • Tổng tiền: <strong style={{ color: 'var(--color-accent)' }}>{new Intl.NumberFormat('vi-VN').format(order.totalPrice)} đ</strong>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                  <span className={`badge ${status.className}`}>{status.label}</span>
                  <Link to={`/orders/${order.id}`} className="btn-ghost">Chi tiết</Link>
                  {order.status === 'PENDING_PAYMENT' && (
                    <Link to={`/payment/${order.id}`} className="btn-primary">Thanh toán</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
