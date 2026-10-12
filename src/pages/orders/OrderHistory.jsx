import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { getOrderStatus } from '../../utils/orderStatusHelper';
import { useToast } from '../../components/common/ToastContext';
import { useCart } from '../../context/CartContext';
import CancelOrderModal from '../../components/orders/CancelOrderModal';
import './OrderHistory.css';

const OrderHistory = () => {
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL');
  const [downloadingOrderId, setDownloadingOrderId] = useState(null);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [reorderingOrderId, setReorderingOrderId] = useState(null);

  const toast = useToast();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  useEffect(() => {
    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const res = await axiosClient.get('/orders/myorders');
        setOrders(res.data || []);
      } catch (err) {
        console.error('Lỗi lấy danh sách đơn hàng', err);
        toast.error('Không thể tải danh sách đơn hàng.');
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

  const handleDownloadInvoice = async (orderId) => {
    setDownloadingOrderId(orderId);
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
      setDownloadingOrderId(null);
    }
  };

  const handleConfirmCancel = async (reason) => {
    if (!orderToCancel) return;
    setIsCancelling(true);
    try {
      await axiosClient.put(`/orders/${orderToCancel.id}/cancel`, { reason });
      toast.success(`Đã hủy thành công đơn hàng #GHT${orderToCancel.id}`);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderToCancel.id ? { ...o, status: 'CANCELLED', cancelReason: reason } : o))
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng này.');
    } finally {
      setIsCancelling(false);
      setOrderToCancel(null);
    }
  };

  const handleReorder = async (order) => {
    setReorderingOrderId(order.id);
    try {
      const items = order.orderItems || [];
      if (!items.length) {
        toast.error('Đơn hàng không có sản phẩm.');
        return;
      }
      let added = 0;
      for (const item of items) {
        if (item.product) {
          const ok = await addToCart(item.product, item.quantity);
          if (ok !== false) added++;
        }
      }
      if (added > 0) {
        toast.success(`Đã thêm ${added} sản phẩm vào giỏ hàng!`);
        navigate('/cart');
      } else {
        toast.error('Sản phẩm trong đơn hàng hiện không khả dụng.');
      }
    } catch {
      toast.error('Lỗi khi mua lại đơn hàng.');
    } finally {
      setReorderingOrderId(null);
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
        <div className="orders-feed-container">
          {[1, 2, 3].map((n) => (
            <div key={n} className="skeleton" style={{ height: '220px', borderRadius: '16px', marginBottom: '16px' }} />
          ))}
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="orders-page-wrapper">
        <div className="orders-header-box">
          <h1>Đơn hàng của tôi</h1>
          <p>Quản lý lịch sử mua sắm và theo dõi trạng thái các đơn hàng của bạn.</p>
        </div>

        <div className="orders-empty-state">
          <div className="orders-empty-icon">
            <i className="ti ti-package"></i>
          </div>
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

  return (
    <div className="orders-page-wrapper">
      {/* Header */}
      <div className="orders-header-box">
        <h1>Đơn hàng của tôi</h1>
        <p>Quản lý lịch sử mua sắm và theo dõi trạng thái các đơn hàng của bạn.</p>
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

      {/* Order Cards Feed */}
      {filteredOrders.length === 0 ? (
        <div className="orders-empty-state" style={{ padding: '48px 24px' }}>
          <div className="orders-empty-icon" style={{ fontSize: '36px' }}>
            <i className="ti ti-filter-off"></i>
          </div>
          <h3 className="orders-empty-title" style={{ fontSize: '16px' }}>Không có đơn hàng nào trong mục này</h3>
          <p className="orders-empty-desc">Thử chọn tab khác hoặc tiếp tục khám phá sản phẩm.</p>
        </div>
      ) : (
        <div className="orders-feed-container">
          {filteredOrders.map((order) => {
            const statusInfo = getOrderStatus(order.status);
            const items = order.orderItems || [];
            const isPendingPayment = order.status === 'PENDING_PAYMENT';
            const isCancellable = ['PENDING_PAYMENT', 'PENDING_REVIEW', 'CONFIRMED', 'PROCESSING'].includes(order.status);
            const isShipping = order.status === 'SHIPPING';
            const isCompleted = order.status === 'COMPLETED' || order.status === 'DELIVERED';
            const isCancelled = order.status === 'CANCELLED' || order.status === 'EXPIRED';

            return (
              <article key={order.id} className="order-feed-card">
                {/* Header Card */}
                <div className="order-feed-card-header">
                  <div className="order-feed-header-left">
                    <Link to={`/orders/${order.id}`} className="order-feed-code">
                      #GHT{order.id}
                    </Link>
                    <span className="order-feed-divider">•</span>
                    <span className="order-feed-date">
                      {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="order-feed-header-right">
                    <span className={`badge ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                {/* Body Card: Product list */}
                <div className="order-feed-card-body">
                  {items.map((item) => (
                    <div key={item.id} className="order-feed-item-row">
                      <img
                        src={item.product?.images?.[0] || '/images/premium.png'}
                        alt={item.product?.name || 'Sản phẩm'}
                        className="order-feed-item-thumb"
                        loading="lazy"
                      />
                      <div className="order-feed-item-details">
                        <Link
                          to={`/products/${item.product?.slug || item.productId}`}
                          className="order-feed-item-title"
                        >
                          {item.product?.name || `Sản phẩm #${item.productId}`}
                        </Link>
                        <div className="order-feed-item-meta">
                          {item.product?.brand && <span className="order-feed-brand-tag">{item.product.brand}</span>}
                          <span>Số lượng: <strong>{item.quantity}</strong></span>
                          <span>Đơn giá: {formatPrice(item.price)}</span>
                        </div>
                      </div>
                      <div className="order-feed-item-subtotal">
                        {formatPrice(item.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer Card */}
                <div className="order-feed-card-footer">
                  <div className="order-feed-summary">
                    <span className="order-feed-items-count">
                      Tổng {items.reduce((s, it) => s + it.quantity, 0)} món:
                    </span>
                    <span className="order-feed-total-amount">
                      {formatPrice(order.totalPrice)}
                    </span>
                    {order.discountAmount > 0 && (
                      <span className="order-feed-discount-pill">
                        Tiết kiệm {formatPrice(order.discountAmount)}
                      </span>
                    )}
                  </div>

                  <div className="order-feed-actions">
                    {/* Contextual Action Buttons */}
                    {isPendingPayment && (
                      <>
                        <button
                          type="button"
                          className="btn-danger-outline"
                          onClick={() => setOrderToCancel(order)}
                        >
                          Hủy đơn
                        </button>
                        <Link to={`/payment/${order.id}`} className="btn-primary">
                          Thanh toán ngay
                        </Link>
                      </>
                    )}

                    {isShipping && (
                      <>
                        <Link to={`/orders/${order.id}`} className="btn-primary">
                          <i className="ti ti-truck-delivery"></i> Theo dõi hành trình
                        </Link>
                      </>
                    )}

                    {isCompleted && (
                      <>
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => handleDownloadInvoice(order.id)}
                          disabled={downloadingOrderId === order.id}
                        >
                          {downloadingOrderId === order.id ? (
                            'Đang tải...'
                          ) : (
                            <>
                              <i className="ti ti-file-download"></i> Tải hóa đơn PDF
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleReorder(order)}
                          disabled={reorderingOrderId === order.id}
                        >
                          {reorderingOrderId === order.id ? 'Đang thêm...' : 'Mua lại'}
                        </button>
                        <Link to={`/orders/${order.id}`} className="btn-outline">
                          Xem chi tiết
                        </Link>
                      </>
                    )}

                    {isCancelled && (
                      <>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleReorder(order)}
                          disabled={reorderingOrderId === order.id}
                        >
                          {reorderingOrderId === order.id ? 'Đang thêm...' : 'Mua lại'}
                        </button>
                        <Link to={`/orders/${order.id}`} className="btn-ghost">
                          Xem chi tiết
                        </Link>
                      </>
                    )}

                    {!isPendingPayment && isCancellable && (
                      <>
                        <button
                          type="button"
                          className="btn-danger-outline"
                          onClick={() => setOrderToCancel(order)}
                        >
                          Hủy đơn
                        </button>
                        <Link to={`/orders/${order.id}`} className="btn-outline">
                          Xem chi tiết
                        </Link>
                      </>
                    )}

                    {!isCancellable && !isShipping && !isCompleted && !isCancelled && (
                      <Link to={`/orders/${order.id}`} className="btn-outline">
                        Xem chi tiết
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modal hủy đơn hàng chuẩn sàn */}
      <CancelOrderModal
        isOpen={!!orderToCancel}
        order={orderToCancel}
        isSubmitting={isCancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setOrderToCancel(null)}
      />
    </div>
  );
};

export default OrderHistory;
