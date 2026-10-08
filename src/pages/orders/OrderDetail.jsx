import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { getOrderStatus } from '../../utils/orderStatusHelper';

const OrderDetail = () => {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axiosClient.get(`/orders/${id}`);
        setOrder(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [id]);

  if (isLoading) return <div style={{ textAlign: 'center', padding: '40px' }}>Đang tải...</div>;
  if (!order) return <div style={{ textAlign: 'center', padding: '40px' }}>Không tìm thấy đơn hàng.</div>;

  const status = getOrderStatus(order.status);
  const address = order.shippingAddress ? JSON.parse(order.shippingAddress) : null;

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Chi tiết đơn hàng #{order.id}</h2>
        <span className={`badge ${status.className}`}>{status.label}</span>
      </div>

      <div style={{ background: 'var(--color-bg-white)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>Sản phẩm</h3>
        {order.orderItems.map(item => (
          <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <Link to={`/products/${item.product?.slug}`} style={{ color: 'var(--color-text-primary)', textDecoration: 'none', fontWeight: '500' }}>
                {item.product?.name || 'Sản phẩm'}
              </Link>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>x{item.quantity}</div>
            </div>
            <strong>{new Intl.NumberFormat('vi-VN').format(item.price * item.quantity)} đ</strong>
          </div>
        ))}

        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px dashed var(--color-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
            <span>Tiền gốc</span>
            <span>{new Intl.NumberFormat('vi-VN').format(order.originalAmount)} đ</span>
          </div>
          
          {order.discountAmount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-success)' }}>
                <span>Mã đã áp dụng {order.discount?.code ? `(${order.discount.code})` : ''}</span>
                <span>- {new Intl.NumberFormat('vi-VN').format(order.discountAmount)} đ</span>
              </div>
            </>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', color: 'var(--color-text-secondary)' }}>
            <span>Phí vận chuyển</span>
            <span>{new Intl.NumberFormat('vi-VN').format(order.shippingFee)} đ</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)', fontSize: '18px', fontWeight: 'bold' }}>
            <span>Tổng thanh toán</span>
            <span style={{ color: 'var(--color-accent)' }}>{new Intl.NumberFormat('vi-VN').format(order.totalPrice)} đ</span>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--color-bg-white)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
        <h3 style={{ marginBottom: '16px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>Thông tin giao hàng</h3>
        {address ? (
          <div>
            <p style={{ marginBottom: '8px' }}><strong>Họ tên:</strong> {address.Name}</p>
            <p style={{ marginBottom: '8px' }}><strong>Điện thoại:</strong> {address.Phone}</p>
            <p style={{ marginBottom: '8px' }}><strong>Địa chỉ:</strong> {address.Address}</p>
            <p style={{ marginBottom: '8px' }}><strong>Xã/Phường:</strong> {address.WardCode}</p>
            <p style={{ marginBottom: '8px' }}><strong>Quận/Huyện:</strong> {address.DistrictId}</p>
            <p style={{ marginBottom: '0' }}><strong>Tỉnh/Thành:</strong> {address.ProvinceId}</p>
          </div>
        ) : (
          <p>Không có thông tin.</p>
        )}
      </div>

      {order.status === 'PENDING_PAYMENT' && (
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <Link to={`/payment/${order.id}`} className="btn-primary" style={{ padding: '12px 24px', textDecoration: 'none' }}>Tiến hành thanh toán</Link>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
