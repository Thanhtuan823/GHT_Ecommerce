import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { getOrderStatus } from '../../utils/orderStatusHelper';
import { useToast } from '../../components/common/ToastContext';
import { useCart } from '../../context/CartContext';
import CancelOrderModal from '../../components/orders/CancelOrderModal';
import './OrderDetail.css';

const OrderDetail = () => {
  const { id } = useParams();
  const toast = useToast();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isCopiedTracking, setIsCopiedTracking] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      setIsLoading(true);
      try {
        const res = await axiosClient.get(`/orders/${id}`);
        setOrder(res.data);
      } catch (err) {
        console.error(err);
        toast.error('Không tìm thấy thông tin đơn hàng');
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

  const handleConfirmCancel = async (reason) => {
    if (!order) return;
    setIsCancelling(true);
    try {
      await axiosClient.put(`/orders/${order.id}/cancel`, { reason });
      toast.success(`Đã hủy thành công đơn hàng #GHT${order.id}`);
      setOrder((prev) => (prev ? { ...prev, status: 'CANCELLED', cancelReason: reason } : null));
      setIsCancelModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể hủy đơn hàng này.');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    setIsReordering(true);
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
      setIsReordering(false);
    }
  };

  const handleOpenAiSupport = () => {
    if (!order) return;
    window.dispatchEvent(
      new CustomEvent('open-ght-chatbot', {
        detail: { message: `Tôi cần hỗ trợ về đơn hàng #GHT${order.id}` }
      })
    );
  };

  const handleCopyTrackingCode = (code) => {
    navigator.clipboard.writeText(code);
    setIsCopiedTracking(true);
    toast.success('Đã sao chép mã vận đơn!');
    setTimeout(() => setIsCopiedTracking(false), 2000);
  };

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  if (isLoading) {
    return (
      <div className="order-detail-page-wrapper">
        <div className="skeleton" style={{ width: '280px', height: '24px', borderRadius: '4px', marginBottom: '20px' }} />
        <div className="order-detail-layout-grid">
          <div className="skeleton" style={{ height: '500px', borderRadius: '16px' }} />
          <div className="skeleton" style={{ height: '400px', borderRadius: '16px' }} />
        </div>
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
  const orderItems = order.orderItems || [];
  const isPendingPayment = order.status === 'PENDING_PAYMENT';
  const isCancelled = order.status === 'CANCELLED' || order.status === 'EXPIRED';
  const trackingCode = `GHN${String(order.id).padStart(8, '0')}`;

  let addressObj = null;
  if (order.shippingAddress) {
    try {
      addressObj = JSON.parse(order.shippingAddress);
    } catch {
      addressObj = { fullAddress: order.shippingAddress };
    }
  }

  // Calculate timeline milestone dates
  const createdDate = new Date(order.createdAt).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const paidDate = order.paidAt
    ? new Date(order.paidAt).toLocaleDateString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      })
    : null;

  const updatedDate = new Date(order.updatedAt || order.createdAt).toLocaleDateString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Timeline Step Statuses
  const isStep1Done = true; // Placed
  const isStep2Done = order.isPaid || ['PAID', 'PROCESSING', 'SHIPPING', 'COMPLETED', 'DELIVERED'].includes(order.status);
  const isStep3Done = ['PROCESSING', 'SHIPPING', 'COMPLETED', 'DELIVERED'].includes(order.status);
  const isStep4Done = ['SHIPPING', 'COMPLETED', 'DELIVERED'].includes(order.status);
  const isStep5Done = ['COMPLETED', 'DELIVERED'].includes(order.status);

  return (
    <div className="order-detail-page-wrapper">
      {/* Breadcrumb */}
      <nav className="order-detail-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/orders">Đơn hàng của tôi</Link>
        <span>/</span>
        <span className="current">#GHT{order.id}</span>
      </nav>

      {/* Top Bar Summary */}
      <div className="order-detail-top-bar">
        <div className="order-detail-header-left">
          <div className="order-detail-title-row">
            <h1>Chi tiết đơn hàng #GHT{order.id}</h1>
            <span className={`badge ${statusInfo.className}`}>{statusInfo.label}</span>
          </div>
          <p className="order-detail-timestamp">
            Thời gian đặt hàng: <strong>{createdDate}</strong>
          </p>
        </div>

        <div className="order-detail-header-actions">
          {['PENDING_PAYMENT', 'PENDING_REVIEW', 'CONFIRMED', 'PROCESSING'].includes(order.status) && (
            <button
              type="button"
              className="btn-danger-outline"
              onClick={() => setIsCancelModalOpen(true)}
            >
              <i className="ti ti-x"></i> Hủy đơn hàng
            </button>
          )}

          {isPendingPayment && (
            <Link to={`/payment/${order.id}`} className="btn-primary">
              <i className="ti ti-credit-card"></i> Thanh toán ngay
            </Link>
          )}

          {isCancelled && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReorder}
              disabled={isReordering}
            >
              <i className="ti ti-reload"></i> {isReordering ? 'Đang thêm...' : 'Mua lại đơn này'}
            </button>
          )}

          {isStep5Done && (
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReorder}
              disabled={isReordering}
            >
              <i className="ti ti-reload"></i> {isReordering ? 'Đang thêm...' : 'Mua lại'}
            </button>
          )}
        </div>
      </div>

      {/* 2-Column Layout Grid (Desktop 65% / 35%) */}
      <div className="order-detail-layout-grid">
        {/* ================= LEFT COLUMN (65%) ================= */}
        <div className="order-detail-left-col">
          {/* Tracking Journey Card */}
          <section className="order-detail-section-card">
            <div className="order-detail-section-header">
              <div className="section-title-with-icon">
                <i className="ti ti-truck-delivery"></i>
                <h2>Hành trình đơn hàng</h2>
              </div>
              {!isCancelled && (
                <span className="carrier-badge">
                  <i className="ti ti-check"></i> Đang vận chuyển qua GHN Express
                </span>
              )}
            </div>

            {/* Carrier Info Strip */}
            <div className="carrier-info-strip">
              <div className="carrier-brand">
                <div className="carrier-icon-box">
                  <i className="ti ti-box-seam"></i>
                </div>
                <div className="carrier-details">
                  <span className="carrier-name">Giao Hàng Nhanh (GHN Express)</span>
                  <span className="carrier-sub">Dịch vụ chuyển phát tiêu chuẩn bảo hiểm 100%</span>
                </div>
              </div>
              <div className="carrier-tracking">
                <span className="tracking-label">Mã vận đơn:</span>
                <span className="tracking-code">{trackingCode}</span>
                <button
                  type="button"
                  className="btn-copy-code"
                  onClick={() => handleCopyTrackingCode(trackingCode)}
                  title="Sao chép mã"
                >
                  <i className={isCopiedTracking ? 'ti ti-check' : 'ti ti-copy'}></i>
                </button>
              </div>
            </div>

            {/* Timeline Stepper */}
            {isCancelled ? (
              <div className="order-cancelled-banner">
                <div className="cancelled-icon">
                  <i className="ti ti-alert-triangle"></i>
                </div>
                <div>
                  <h4>Đơn hàng đã bị hủy</h4>
                  <p>
                    Đơn hàng được ghi nhận hủy vào lúc {updatedDate}. Số lượng sản phẩm đã được tự động hoàn trả về kho.
                  </p>
                  {order.cancelReason && (
                    <p style={{ marginTop: '6px', fontSize: '13px', fontWeight: 600 }}>
                      Lý do hủy: <span style={{ fontWeight: 400 }}>{order.cancelReason}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="order-journey-timeline">
                {/* Milestone 1: Placed */}
                <div className={`timeline-milestone ${isStep1Done ? 'is-completed' : ''}`}>
                  <div className="milestone-marker">
                    <i className="ti ti-check"></i>
                  </div>
                  <div className="milestone-content">
                    <div className="milestone-head">
                      <span className="milestone-title">Đã đặt hàng thành công</span>
                      <span className="milestone-time">{createdDate}</span>
                    </div>
                    <p className="milestone-desc">Đơn hàng đã được tạo trên hệ thống GHT Ecommerce.</p>
                  </div>
                </div>

                {/* Milestone 2: Payment */}
                <div className={`timeline-milestone ${isStep2Done ? 'is-completed' : isStep1Done ? 'is-active' : ''}`}>
                  <div className="milestone-marker">
                    {isStep2Done ? <i className="ti ti-check"></i> : <i className="ti ti-credit-card"></i>}
                  </div>
                  <div className="milestone-content">
                    <div className="milestone-head">
                      <span className="milestone-title">
                        {isStep2Done ? 'Đã thanh toán thành công' : 'Chờ khách hàng thanh toán'}
                      </span>
                      <span className="milestone-time">{paidDate || 'Chờ hoàn tất'}</span>
                    </div>
                    <p className="milestone-desc">
                      {isStep2Done
                        ? 'Giao dịch chuyển khoản SePay đã được hệ thống ghi nhận thành công.'
                        : 'Quý khách vui lòng quét mã QR thanh toán trong vòng 15 phút kể từ lúc đặt hàng.'}
                    </p>
                  </div>
                </div>

                {/* Milestone 3: Processing / Packing */}
                <div className={`timeline-milestone ${isStep3Done ? 'is-completed' : isStep2Done ? 'is-active' : ''}`}>
                  <div className="milestone-marker">
                    {isStep3Done ? <i className="ti ti-check"></i> : <i className="ti ti-package"></i>}
                  </div>
                  <div className="milestone-content">
                    <div className="milestone-head">
                      <span className="milestone-title">Đóng gói và chuẩn bị đơn hàng</span>
                      <span className="milestone-time">{isStep3Done ? updatedDate : '—'}</span>
                    </div>
                    <p className="milestone-desc">Trung tâm điều phối GHT kiểm tra chất lượng và niêm phong kiện hàng.</p>
                  </div>
                </div>

                {/* Milestone 4: Shipping */}
                <div className={`timeline-milestone ${isStep4Done ? 'is-completed' : isStep3Done ? 'is-active' : ''}`}>
                  <div className="milestone-marker">
                    {isStep4Done ? <i className="ti ti-check"></i> : <i className="ti ti-truck"></i>}
                  </div>
                  <div className="milestone-content">
                    <div className="milestone-head">
                      <span className="milestone-title">Đang giao hàng (GHN Express)</span>
                      <span className="milestone-time">{isStep4Done ? 'Đang lưu kho trung chuyển' : '—'}</span>
                    </div>
                    <p className="milestone-desc">Tài xế giao nhận GHN đang trên lộ trình chuyển phát đến địa chỉ nhận.</p>
                  </div>
                </div>

                {/* Milestone 5: Delivered */}
                <div className={`timeline-milestone ${isStep5Done ? 'is-completed' : ''}`}>
                  <div className="milestone-marker">
                    <i className="ti ti-circle-check"></i>
                  </div>
                  <div className="milestone-content">
                    <div className="milestone-head">
                      <span className="milestone-title">Giao hàng thành công</span>
                      <span className="milestone-time">{isStep5Done ? updatedDate : 'Dự kiến 2-3 ngày'}</span>
                    </div>
                    <p className="milestone-desc">Kiện hàng đã được giao tận tay quý khách.</p>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Product Items List Card */}
          <section className="order-detail-section-card">
            <div className="order-detail-section-header">
              <div className="section-title-with-icon">
                <i className="ti ti-shopping-cart"></i>
                <h2>Sản phẩm trong đơn ({orderItems.length})</h2>
              </div>
            </div>

            <div className="order-detail-items-table">
              {orderItems.map((item) => (
                <div key={item.id} className="order-detail-item-card">
                  <img
                    src={item.product?.images?.[0] || '/images/premium.png'}
                    alt={item.product?.name || 'Sản phẩm'}
                    className="order-item-image"
                    loading="lazy"
                  />
                  <div className="order-item-main-info">
                    <Link
                      to={`/products/${item.product?.slug || item.productId}`}
                      className="order-item-title"
                    >
                      {item.product?.name || `Sản phẩm #${item.productId}`}
                    </Link>
                    <div className="order-item-specs-row">
                      {item.product?.brand && (
                        <span className="order-item-badge">{item.product.brand}</span>
                      )}
                      <span className="order-item-qty">Số lượng: <strong>{item.quantity}</strong></span>
                      <span className="order-item-unit-price">Đơn giá: {formatPrice(item.price)}</span>
                    </div>
                  </div>
                  <div className="order-item-total-col">
                    <span className="item-subtotal-val">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ================= RIGHT COLUMN (35% STICKY) ================= */}
        <div className="order-detail-right-col">
          {/* Recipient Information Card */}
          <section className="order-detail-side-card">
            <div className="side-card-header">
              <i className="ti ti-map-pin"></i>
              <h3>Thông tin người nhận</h3>
            </div>
            <div className="side-card-body recipient-details">
              <div className="recipient-row">
                <span className="recipient-name">
                  {addressObj?.name || 'Khách hàng GHT'}
                </span>
                {addressObj?.phone && (
                  <span className="recipient-phone">
                    <i className="ti ti-phone"></i> {addressObj.phone}
                  </span>
                )}
              </div>
              <p className="recipient-address">
                {addressObj?.fullAddress || addressObj?.address || 'Địa chỉ giao hàng đang cập nhật'}
              </p>
              <div className="delivery-method-pill">
                <i className="ti ti-shield-check"></i> Giao tận nơi chuẩn hóa (GHN)
              </div>
            </div>
          </section>

          {/* Financial Breakdown Card */}
          <section className="order-detail-side-card financial-card">
            <div className="side-card-header">
              <i className="ti ti-receipt-2"></i>
              <h3>Tóm tắt thanh toán</h3>
            </div>
            <div className="side-card-body financial-body">
              <div className="fin-row">
                <span>Tạm tính sản phẩm</span>
                <span>{formatPrice(order.originalAmount || order.totalPrice)}</span>
              </div>

              {order.discount && (
                <div className="fin-row is-coupon">
                  <span>
                    Voucher đã dùng (<strong>{order.discount.code}</strong>)
                  </span>
                  <span>– {formatPrice(order.discountAmount)}</span>
                </div>
              )}

              <div className="fin-row">
                <span>Phí vận chuyển</span>
                <span>
                  {order.shippingFee > 0 ? formatPrice(order.shippingFee) : 'Miễn phí'}
                </span>
              </div>

              <div className="fin-divider"></div>

              <div className="fin-total-row">
                <span className="fin-total-label">Tổng thanh toán</span>
                <span className="fin-total-amount">{formatPrice(order.totalPrice)}</span>
              </div>

              <div className="payment-status-note">
                <i className={order.isPaid ? 'ti ti-circle-check' : 'ti ti-clock'}></i>
                <span>
                  {order.isPaid
                    ? 'Đã thanh toán chuyển khoản ngân hàng'
                    : 'Chờ thanh toán chuyển khoản ngân hàng (SePay QR)'}
                </span>
              </div>
            </div>
          </section>

          {/* Utility Actions Card */}
          <section className="order-detail-side-card actions-card">
            <div className="side-card-header">
              <i className="ti ti-tool"></i>
              <h3>Tiện ích & Hỗ trợ</h3>
            </div>
            <div className="side-card-body side-actions-body">
              <button
                type="button"
                className="btn-side-action"
                onClick={handleDownloadInvoice}
                disabled={isDownloadingPdf}
              >
                <i className="ti ti-file-text"></i>
                <span>{isDownloadingPdf ? 'Đang tạo PDF...' : 'Tải hóa đơn điện tử (PDF)'}</span>
              </button>

              <button
                type="button"
                className="btn-side-action is-ai"
                onClick={handleOpenAiSupport}
              >
                <i className="ti ti-sparkles"></i>
                <span>Cần hỗ trợ đơn này (AI Chatbot)</span>
              </button>

              <Link to="/orders" className="btn-side-action is-back">
                <i className="ti ti-arrow-left"></i>
                <span>Quay lại lịch sử đơn hàng</span>
              </Link>
            </div>
          </section>
        </div>
      </div>

      {/* Modal hủy đơn hàng chuẩn sàn */}
      <CancelOrderModal
        isOpen={isCancelModalOpen}
        order={order}
        isSubmitting={isCancelling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setIsCancelModalOpen(false)}
      />
    </div>
  );
};

export default OrderDetail;
