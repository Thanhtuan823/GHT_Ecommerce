import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { getOrderStatus } from '../../utils/orderStatusHelper';
import { useToast } from '../../components/common/ToastContext';
import './OrderDetail.css';

const STEPPER_STEPS = [
  { id: 'placed', label: 'Đã đặt hàng', icon: '✓' },
  { id: 'paid', label: 'Đã thanh toán', icon: '💳' },
  { id: 'processing', label: 'Đang xử lý', icon: '⚙️' },
  { id: 'shipping', label: 'Đang giao', icon: '🚚' },
  { id: 'completed', label: 'Hoàn thành', icon: '★' }
];

const getStepIndex = (status) => {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 0;
    case 'PENDING_REVIEW':
    case 'PAID':
    case 'CONFIRMED':
      return 1;
    case 'PROCESSING':
      return 2;
    case 'SHIPPING':
      return 3;
    case 'COMPLETED':
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
};

const OrderDetail = () => {
  const { id } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
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

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingPdf(true);
    try {
      const res = await axiosClient.get(`/orders/${order.id}/invoice`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Hoa_don_GHT${order.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      toast.success('Đã tải hóa đơn PDF thành công!');
    } catch {
      toast.error('Không thể tải hóa đơn. Vui lòng thử lại sau.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  if (isLoading) {
    return (
      <div className="order-detail-page-wrapper">
        <div className="order-detail-breadcrumb">
          <div className="skeleton" style={{ width: '260px', height: '16px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton" style={{ height: '450px', borderRadius: '16px' }} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="order-detail-page-wrapper">
        <div className="orders-empty-state">
          <div className="orders-empty-icon">⚠</div>
          <h2 className="orders-empty-title">Không tìm thấy đơn hàng</h2>
          <p className="orders-empty-desc">Đơn hàng không tồn tại hoặc bạn không có quyền truy cập.</p>
          <Link to="/orders" className="btn-primary">
            Quay lại danh sách đơn hàng
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getOrderStatus(order.status);
  const currentStepIdx = getStepIndex(order.status);
  const isCancelled = order.status === 'CANCELLED' || order.status === 'EXPIRED';

  let addressObj = null;
  if (order.shippingAddress) {
    try {
      addressObj = JSON.parse(order.shippingAddress);
    } catch {
      addressObj = { fullAddress: order.shippingAddress };
    }
  }

  const orderItems = order.orderItems || [];
  const progressPercent = Math.min(100, Math.max(0, (currentStepIdx / (STEPPER_STEPS.length - 1)) * 100));

  return (
    <div className="order-detail-page-wrapper">
      {/* Breadcrumb */}
      <nav className="order-detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/orders">Đơn hàng của tôi</Link>
        <span>/</span>
        <span>Chi tiết đơn #GHT{order.id}</span>
      </nav>

      {/* Main Order Card */}
      <section className="order-detail-main-card">
        {/* Header Row */}
        <div className="order-detail-header-row">
          <div className="order-detail-title-group">
            <h1 className="order-detail-h1">Đơn #GHT{order.id}</h1>
            <span className="order-detail-date">
              Đặt ngày {new Date(order.createdAt).toLocaleDateString('vi-VN')} • {orderItems.length} sản phẩm
            </span>
          </div>

          <div className="order-detail-header-actions">
            <span className={`badge ${statusInfo.className}`}>
              {statusInfo.label}
            </span>
            <button
              type="button"
              className="btn-ghost btn-invoice-pdf"
              onClick={handleDownloadInvoice}
              disabled={isDownloadingPdf}
            >
              {isDownloadingPdf ? 'Đang tải...' : '↓ Tải hóa đơn PDF'}
            </button>
          </div>
        </div>

        {/* Stepper (Horizontal desktop, Vertical mobile) */}
        {!isCancelled && (
          <>
            <div className="order-detail-stepper-horizontal">
              <div className="order-detail-connecting-line">
                <div
                  className="order-detail-line-progress"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {STEPPER_STEPS.map((step, idx) => {
                const isDone = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div
                    key={step.id}
                    className={`order-detail-stepper-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div className="order-detail-circle-icon">
                      {isDone ? '✓' : step.icon}
                    </div>
                    <div className="order-detail-step-labels">
                      <span className="order-detail-step-name">{step.label}</span>
                      <span className="order-detail-step-time">
                        {isCurrent || isDone ? new Date(order.createdAt).toLocaleDateString('vi-VN') : '—'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vertical Stepper for Mobile */}
            <div className="order-detail-stepper-vertical">
              {STEPPER_STEPS.map((step, idx) => {
                const isDone = idx < currentStepIdx;
                const isCurrent = idx === currentStepIdx;
                return (
                  <div
                    key={step.id}
                    className={`order-detail-vstep ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                  >
                    <div className="order-detail-vicon">
                      {isDone ? '✓' : step.icon}
                    </div>
                    {idx < STEPPER_STEPS.length - 1 && (
                      <div className="order-detail-vline" />
                    )}
                    <div className="order-detail-vcontent">
                      <span className="order-detail-vname">{step.label}</span>
                      <span className="order-detail-vtime">
                        {isCurrent || isDone ? new Date(order.createdAt).toLocaleDateString('vi-VN') : 'Chờ xử lý'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Product Items */}
        <div className="order-detail-items-section">
          {orderItems.map((item) => (
            <div key={item.id} className="order-detail-product-row">
              <img
                src={item.product?.images?.[0] || '/images/premium.png'}
                alt={item.product?.name || 'Sản phẩm'}
                className="order-detail-product-image"
              />
              <div className="order-detail-product-info">
                <Link
                  to={`/products/${item.product?.slug || item.productId}`}
                  className="order-detail-product-name"
                >
                  {item.product?.name || `Sản phẩm #${item.productId}`}
                </Link>
                <span className="order-detail-product-meta">
                  {item.product?.brand || 'GHT'} • Số lượng: {item.quantity}
                </span>
              </div>
              <span className="order-detail-product-price">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          ))}
        </div>

        {/* 2-Column Bottom: Address + Summary */}
        <div className="order-detail-bottom-grid">
          <div className="order-detail-shipping-info-box">
            <h2 className="order-detail-shipping-title">Địa chỉ nhận hàng</h2>
            <p>
              <strong>{addressObj?.name || 'Khách hàng'}</strong> • {addressObj?.phone || ''}
            </p>
            <p>{addressObj?.fullAddress || addressObj?.address || 'Địa chỉ đang cập nhật'}</p>
            <span style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 600, marginTop: '4px' }}>
              🚚 Vận chuyển: Giao Hàng Nhanh (GHN) • Miễn phí
            </span>
          </div>

          <div className="order-detail-price-summary-box">
            <div className="order-detail-summary-row">
              <span>Tổng tiền gốc</span>
              <span>{formatPrice(order.originalAmount || order.totalPrice)}</span>
            </div>

            {order.discount && (
              <div className="order-detail-summary-row is-code">
                <span>Mã đã áp dụng</span>
                <span>{order.discount.code}</span>
              </div>
            )}

            {order.discountAmount > 0 && (
              <div className="order-detail-summary-row is-discount">
                <span>Đã giảm</span>
                <span>– {formatPrice(order.discountAmount)}</span>
              </div>
            )}

            <div className="order-detail-summary-divider" />

            <div className="order-detail-summary-total-row">
              <span className="order-detail-summary-total-label">Tổng thanh toán</span>
              <span className="order-detail-summary-total-amount">
                {formatPrice(order.totalPrice)}
              </span>
            </div>

            <p className="order-detail-paid-note">
              {order.isPaid
                ? 'Đã thanh toán qua chuyển khoản ngân hàng SePay.'
                : 'Chờ thanh toán qua chuyển khoản ngân hàng.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="order-detail-footer-actions">
          <div className="order-detail-support-link">
            <span>🎧 Cần trợ giúp?</span>
            <a href="mailto:support@ght.vn">Liên hệ hỗ trợ GHT</a>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Link to="/orders" className="btn-ghost">
              ← Quay lại danh sách
            </Link>
            {order.status === 'PENDING_PAYMENT' && (
              <Link to={`/payment/${order.id}`} className="btn-primary">
                Tiến hành thanh toán ngay
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default OrderDetail;
