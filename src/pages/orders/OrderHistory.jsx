import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { getOrderStatus } from '../../utils/orderStatusHelper';
import { useToast } from '../../components/common/ToastContext';
import './OrderHistory.css';

// 5 Standard Stepper Steps
const STEPPER_STEPS = [
  { id: 'placed', label: 'Đã đặt hàng', icon: <i className="ti ti-check"></i> },
  { id: 'paid', label: 'Đã thanh toán', icon: <i className="ti ti-credit-card"></i> },
  { id: 'processing', label: 'Đang xử lý', icon: <i className="ti ti-settings"></i> },
  { id: 'shipping', label: 'Đang giao', icon: <i className="ti ti-truck"></i> },
  { id: 'completed', label: 'Hoàn thành', icon: <i className="ti ti-star"></i> }
];

const getStepIndex = (status) => {
  switch (status) {
    case 'PENDING_PAYMENT':
      return 0; // step 1 done/current
    case 'PENDING_REVIEW':
      return 1;
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

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [featuredOrderId, setFeaturedOrderId] = useState(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const res = await axiosClient.get('/orders/myorders');
        const list = res.data || [];
        setOrders(list);
        if (list.length > 0) {
          setFeaturedOrderId(list[0].id);
        }
      } catch (err) {
        console.error('Lỗi lấy danh sách đơn hàng', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrders();
  }, []);

  // Filter Counts
  const counts = useMemo(() => {
    return {
      ALL: orders.length,
      PENDING_PAYMENT: orders.filter((o) => o.status === 'PENDING_PAYMENT').length,
      SHIPPING: orders.filter((o) => o.status === 'SHIPPING' || o.status === 'PROCESSING').length,
      COMPLETED: orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED').length,
      CANCELLED: orders.filter((o) => o.status === 'CANCELLED' || o.status === 'EXPIRED').length
    };
  }, [orders]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    if (activeTab === 'ALL') return orders;
    if (activeTab === 'PENDING_PAYMENT') return orders.filter((o) => o.status === 'PENDING_PAYMENT');
    if (activeTab === 'SHIPPING') return orders.filter((o) => o.status === 'SHIPPING' || o.status === 'PROCESSING');
    if (activeTab === 'COMPLETED') return orders.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED');
    if (activeTab === 'CANCELLED') return orders.filter((o) => o.status === 'CANCELLED' || o.status === 'EXPIRED');
    return orders;
  }, [orders, activeTab]);

  // Featured Order
  const featuredOrder = useMemo(() => {
    if (!orders.length) return null;
    return orders.find((o) => o.id === featuredOrderId) || orders[0];
  }, [orders, featuredOrderId]);

  // Other orders in table
  const otherOrders = useMemo(() => {
    if (!featuredOrder) return [];
    return orders.filter((o) => o.id !== featuredOrder.id);
  }, [orders, featuredOrder]);

  const handleDownloadInvoice = async (orderId) => {
    setIsDownloadingPdf(true);
    try {
      const res = await axiosClient.get(`/orders/${orderId}/invoice`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Hoa_don_GHT${orderId}.pdf`);
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
      <div className="orders-page-wrapper">
        <div className="orders-header-box">
          <div className="skeleton" style={{ width: '240px', height: '32px', borderRadius: '4px' }} />
          <div className="skeleton" style={{ width: '360px', height: '18px', marginTop: '8px', borderRadius: '4px' }} />
        </div>
        <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
        <div className="skeleton" style={{ height: '200px', borderRadius: '16px' }} />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="orders-page-wrapper">
        <div className="orders-header-box">
          <h1>Đơn hàng của tôi</h1>
          <p>Theo dõi hành trình giao hàng và quản lý các đơn hàng đã đặt.</p>
        </div>

        <div className="orders-empty-state">
          <div className="orders-empty-icon"><i className="ti ti-package"></i></div>
          <h2 className="orders-empty-title">Bạn chưa có đơn hàng nào</h2>
          <p className="orders-empty-desc">
            Khám phá ngay hàng trăm sản phẩm công nghệ chính hãng với giá ưu đãi tại GHT.
          </p>
          <Link to="/products" className="btn-primary">
            Mua sắm ngay
          </Link>
        </div>
      </div>
    );
  }

  const currentStepIdx = featuredOrder ? getStepIndex(featuredOrder.status) : 0;
  const featuredStatus = featuredOrder ? getOrderStatus(featuredOrder.status) : null;
  const isCancelled = featuredOrder?.status === 'CANCELLED' || featuredOrder?.status === 'EXPIRED';

  let addressObj = null;
  if (featuredOrder?.shippingAddress) {
    try {
      addressObj = JSON.parse(featuredOrder.shippingAddress);
    } catch {
      addressObj = { fullAddress: featuredOrder.shippingAddress };
    }
  }

  const orderItems = featuredOrder?.orderItems || [];
  const progressPercent = Math.min(100, Math.max(0, (currentStepIdx / (STEPPER_STEPS.length - 1)) * 100));

  return (
    <div className="orders-page-wrapper">
      {/* Header */}
      <div className="orders-header-box">
        <h1>Đơn hàng của tôi</h1>
        <p>Theo dõi hành trình giao hàng và quản lý các đơn hàng đã đặt.</p>
      </div>

      {/* Filter Tabs */}
      <div className="orders-filter-tabs">
        <button
          type="button"
          className={`order-tab-btn ${activeTab === 'ALL' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('ALL')}
        >
          Tất cả ({counts.ALL})
        </button>
        <button
          type="button"
          className={`order-tab-btn ${activeTab === 'PENDING_PAYMENT' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('PENDING_PAYMENT')}
        >
          Chờ thanh toán ({counts.PENDING_PAYMENT})
        </button>
        <button
          type="button"
          className={`order-tab-btn ${activeTab === 'SHIPPING' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('SHIPPING')}
        >
          Đang giao ({counts.SHIPPING})
        </button>
        <button
          type="button"
          className={`order-tab-btn ${activeTab === 'COMPLETED' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('COMPLETED')}
        >
          Hoàn thành ({counts.COMPLETED})
        </button>
        <button
          type="button"
          className={`order-tab-btn ${activeTab === 'CANCELLED' ? 'is-active' : ''}`}
          onClick={() => setActiveTab('CANCELLED')}
        >
          Đã huỷ ({counts.CANCELLED})
        </button>
      </div>

      {/* Featured Order Box */}
      {featuredOrder && (
        <section className="featured-order-card">
          <div className="featured-order-header">
            <div className="featured-order-title-group">
              <span className="featured-order-code">
                Đơn #GHT{featuredOrder.id}
              </span>
              <span className="featured-order-date">
                Đặt ngày {new Date(featuredOrder.createdAt).toLocaleDateString('vi-VN')} • {orderItems.length} sản phẩm
              </span>
            </div>

            <div className="featured-order-actions-header">
              {featuredStatus && (
                <span className={`badge ${featuredStatus.className}`}>
                  {featuredStatus.label}
                </span>
              )}
              <button
                type="button"
                className="btn-ghost btn-invoice-pdf"
                onClick={() => handleDownloadInvoice(featuredOrder.id)}
                disabled={isDownloadingPdf}
              >
                {isDownloadingPdf ? 'Đang tải...' : '↓ Tải hóa đơn PDF'}
              </button>
            </div>
          </div>

          {/* Stepper (Horizontal on Desktop, Vertical on Mobile) */}
          {!isCancelled && (
            <>
              {/* Horizontal Stepper (Desktop) */}
              <div className="order-stepper-horizontal">
                <div className="stepper-connecting-line">
                  <div
                    className="stepper-line-progress"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {STEPPER_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div
                      key={step.id}
                      className={`stepper-step-item ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                    >
                      <div className="stepper-circle-icon">
                        {isDone ? <i className="ti ti-check"></i> : step.icon}
                      </div>
                      <div className="stepper-step-labels">
                        <span className="stepper-step-name">{step.label}</span>
                        <span className="stepper-step-time">
                          {isCurrent || isDone ? new Date(featuredOrder.createdAt).toLocaleDateString('vi-VN') : '—'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vertical Stepper (Mobile) */}
              <div className="order-stepper-vertical">
                {STEPPER_STEPS.map((step, idx) => {
                  const isDone = idx < currentStepIdx;
                  const isCurrent = idx === currentStepIdx;
                  return (
                    <div
                      key={step.id}
                      className={`stepper-vertical-step ${isDone ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}`}
                    >
                      <div className="stepper-vertical-icon">
                        {isDone ? <i className="ti ti-check"></i> : step.icon}
                      </div>
                      {idx < STEPPER_STEPS.length - 1 && (
                        <div className="stepper-vertical-line" />
                      )}
                      <div className="stepper-vertical-content">
                        <span className="stepper-vertical-name">{step.label}</span>
                        <span className="stepper-vertical-time">
                          {isCurrent || isDone ? new Date(featuredOrder.createdAt).toLocaleDateString('vi-VN') : 'Chờ xử lý'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Products List */}
          <div className="featured-order-items-list">
            {orderItems.map((item) => (
              <div key={item.id} className="featured-order-product-item">
                <img
                  src={item.product?.images?.[0] || '/images/premium.png'}
                  alt={item.product?.name || 'Sản phẩm'}
                  className="featured-product-image"
                />
                <div className="featured-product-info">
                  <Link
                    to={`/products/${item.product?.slug || item.productId}`}
                    className="featured-product-name"
                  >
                    {item.product?.name || `Sản phẩm #${item.productId}`}
                  </Link>
                  <span className="featured-product-meta">
                    {item.product?.brand || 'GHT'} • Số lượng: {item.quantity}
                  </span>
                </div>
                <span className="featured-product-price">
                  {formatPrice(item.price * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* 2 Columns Bottom: Address + Summary */}
          <div className="featured-order-bottom-grid">
            <div className="featured-address-box">
              <h3 className="featured-address-title">Địa chỉ nhận hàng</h3>
              <p>
                <strong>{addressObj?.name || 'Khách hàng'}</strong> • {addressObj?.phone || ''}
              </p>
              <p>{addressObj?.fullAddress || addressObj?.address || 'Địa chỉ đang cập nhật'}</p>
              <span className="featured-shipping-badge">
                🚚 Vận chuyển: Giao Hàng Nhanh (GHN) • Miễn phí
              </span>
            </div>

            <div className="featured-summary-price-box">
              <div className="featured-summary-row">
                <span>Tổng tiền gốc</span>
                <span>{formatPrice(featuredOrder.originalAmount || featuredOrder.totalPrice)}</span>
              </div>

              {featuredOrder.discount && (
                <div className="featured-summary-row is-code">
                  <span>Mã đã áp dụng</span>
                  <span>{featuredOrder.discount.code}</span>
                </div>
              )}

              {featuredOrder.discountAmount > 0 && (
                <div className="featured-summary-row is-discount">
                  <span>Đã giảm</span>
                  <span>– {formatPrice(featuredOrder.discountAmount)}</span>
                </div>
              )}

              <div className="featured-summary-divider" />

              <div className="featured-summary-total-row">
                <span className="featured-summary-total-label">Tổng thanh toán</span>
                <span className="featured-summary-total-amount">
                  {formatPrice(featuredOrder.totalPrice)}
                </span>
              </div>

              <p className="featured-summary-paid-note">
                {featuredOrder.isPaid
                  ? 'Đã thanh toán qua chuyển khoản ngân hàng SePay.'
                  : 'Chờ thanh toán qua chuyển khoản ngân hàng.'}
              </p>
            </div>
          </div>

          {/* Footer Order Actions */}
          <div className="featured-order-footer">
            <div className="featured-order-support-group">
              <span>🎧</span>
              <span>Cần hỗ trợ đơn hàng này?</span>
              <a href="mailto:support@ght.vn" className="auth-link">
                Liên hệ hỗ trợ
              </a>
            </div>

            <div className="featured-order-actions-group">
              <Link to={`/orders/${featuredOrder.id}`} className="btn-ghost">
                Xem chi tiết đơn
              </Link>
              {featuredOrder.status === 'PENDING_PAYMENT' ? (
                <Link to={`/payment/${featuredOrder.id}`} className="btn-primary">
                  Thanh toán ngay
                </Link>
              ) : (
                <Link to={`/orders/${featuredOrder.id}`} className="btn-primary">
                  Theo dõi giao hàng
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Table: Các đơn hàng khác */}
      {otherOrders.length > 0 && (
        <section className="other-orders-section">
          <h2 className="other-orders-title">Các đơn hàng khác</h2>
          <div className="other-orders-table-wrapper">
            <table className="other-orders-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Ngày đặt</th>
                  <th>Sản phẩm</th>
                  <th>Tổng thanh toán</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {otherOrders.map((ord) => {
                  const st = getOrderStatus(ord.status);
                  const firstItem = ord.orderItems?.[0]?.product?.name || `${ord.orderItems?.length || 1} sản phẩm`;
                  const moreCount = (ord.orderItems?.length || 1) - 1;
                  return (
                    <tr key={ord.id}>
                      <td>
                        <button
                          type="button"
                          className="other-orders-action-link"
                          onClick={() => setFeaturedOrderId(ord.id)}
                        >
                          #GHT{ord.id}
                        </button>
                      </td>
                      <td>{new Date(ord.createdAt).toLocaleDateString('vi-VN')}</td>
                      <td>
                        {firstItem}
                        {moreCount > 0 && ` (+${moreCount})`}
                      </td>
                      <td>
                        <strong>{formatPrice(ord.totalPrice)}</strong>
                      </td>
                      <td>
                        <span className={`badge ${st.className}`}>{st.label}</span>
                      </td>
                      <td>
                        {ord.status === 'PENDING_PAYMENT' ? (
                          <Link to={`/payment/${ord.id}`} className="other-orders-action-link">
                            Thanh toán →
                          </Link>
                        ) : (
                          <button
                            type="button"
                            className="other-orders-action-link"
                            onClick={() => setFeaturedOrderId(ord.id)}
                          >
                            Xem chi tiết
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
};

export default OrderHistory;
