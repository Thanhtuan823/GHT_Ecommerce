import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import ProductEditModal from '../../components/product/ProductEditModal';
import './StaffOrders.css';

export default function StaffOrders() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [activeOrderId, setActiveOrderId] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Sync active order if URL has highlightOrder or orderId query param
  const highlightParam = searchParams.get('highlightOrder') || searchParams.get('orderId');
  useEffect(() => {
    if (highlightParam) {
      const targetId = parseInt(highlightParam, 10);
      if (!isNaN(targetId)) {
        setActiveOrderId(targetId);
      }
    }
  }, [highlightParam]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [internalNotes, setInternalNotes] = useState({});
  const [aiInspections, setAiInspections] = useState([]);
  const [isCheckingAi, setIsCheckingAi] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [shippingOrderId, setShippingOrderId] = useState(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null);

  // Download Invoice PDF
  const handleDownloadInvoice = async (orderId) => {
    setDownloadingInvoiceId(orderId);
    try {
      const res = await axiosClient.get(`/orders/${orderId}/invoice`, {
        responseType: 'blob'
      });

      const blob = res.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `HoaDon_DH${orderId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`Đã tải hóa đơn PDF cho đơn #GHT${orderId}!`, 'success');
    } catch {
      showToast('Có lỗi xảy ra khi tải hóa đơn PDF', 'error');
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  // Initialize internal notes map
  useEffect(() => {
    const notesMap = {};
    orders.forEach((o) => {
      notesMap[o.id] = o.internalNote || '';
    });
    setInternalNotes((prev) => ({ ...notesMap, ...prev }));
  }, [orders]);

  // Fetch orders from backend
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await axiosClient.get('/orders');
      const data = res.data;

      if (Array.isArray(data)) {
        // Normalize backend structure supporting both PascalCase and camelCase
        const formatted = data.map((o) => {
          let parsedAddr = {};
          if (o.shippingAddress) {
            try {
              parsedAddr = typeof o.shippingAddress === 'string'
                ? JSON.parse(o.shippingAddress)
                : o.shippingAddress;
            } catch {
              parsedAddr = {};
            }
          }

          const custName = parsedAddr.Name || parsedAddr.name || o.user?.name || o.user?.fullName || 'Khách hàng';
          const custPhone = parsedAddr.Phone || parsedAddr.phone || o.user?.phone || 'Chưa có SĐT';
          const custAddress = parsedAddr.FullAddress || parsedAddr.fullAddress || parsedAddr.Address || parsedAddr.address || 'Địa chỉ giao hàng';

          return {
            id: o.id,
            code: `GHT${o.id}`,
            createdAt: o.createdAt,
            customer: {
              name: custName,
              phone: custPhone,
              address: custAddress
            },
            totalPrice: o.totalPrice,
            status: o.status,
            paymentMethod: o.paymentMethod || 'BANK_TRANSFER',
            trackingNumber: o.trackingNumber || null,
            shippingProvider: o.trackingNumber ? `GHN • Mã vận đơn ${o.trackingNumber}` : 'GHN • Tiêu chuẩn E-commerce',
            internalNote: internalNotes[o.id] || '',
            items: (o.orderItems || []).map((it) => ({
              id: it.id,
              name: it.product?.name || `Sản phẩm #${it.productId}`,
              quantity: it.quantity,
              price: it.price
            }))
          };
        });

        setOrders(formatted);

        // Auto highlight order: priority to query param, otherwise newest order (formatted[0])
        if (highlightParam) {
          const targetId = parseInt(highlightParam, 10);
          if (!isNaN(targetId) && formatted.some((f) => f.id === targetId)) {
            setActiveOrderId(targetId);
            const targetIdx = formatted.findIndex((f) => f.id === targetId);
            if (targetIdx >= 5) {
              setIsExpanded(true);
            }
          } else if (formatted.length > 0) {
            setActiveOrderId(formatted[0].id);
          }
        } else if (formatted.length > 0) {
          setActiveOrderId((prev) => (prev && formatted.some((f) => f.id === prev) ? prev : formatted[0].id));
        }
      }
    } catch (err) {
      console.error('Lỗi kết nối API orders backend:', err);
      showToast('Không thể tải danh sách đơn hàng từ máy chủ', 'error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchOrders();
    showToast('Đã làm mới dữ liệu đơn hàng thành công!', 'success');
  };

  // KPI Calculations (Neutral 4 cards)
  const kpiStats = useMemo(() => {
    const pendingReview = orders.filter((o) => o.status === 'PENDING_REVIEW' || o.status === 'PENDING_PAYMENT').length;
    const paid = orders.filter((o) => o.status === 'PAID').length;
    const processing = orders.filter((o) => o.status === 'PROCESSING' || o.status === 'CONFIRMED').length;
    const shipping = orders.filter((o) => o.status === 'SHIPPING').length;
    return { pendingReview, paid, processing, shipping };
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Status filter
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'PENDING_REVIEW' && o.status !== 'PENDING_REVIEW' && o.status !== 'PENDING_PAYMENT') return false;
        if (statusFilter !== 'PENDING_REVIEW' && o.status !== statusFilter) return false;
      }
      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesCode = (o.code || '').toLowerCase().includes(query);
        const matchesName = (o.customer?.name || '').toLowerCase().includes(query);
        const matchesPhone = (o.customer?.phone || '').includes(query);
        if (!matchesCode && !matchesName && !matchesPhone) return false;
      }
      return true;
    });
  }, [orders, statusFilter, searchTerm]);

  // Displayed orders (Default top 5 newest orders, or all if isExpanded is true)
  const displayedOrders = useMemo(() => {
    if (isExpanded) return filteredOrders;
    return filteredOrders.slice(0, 5);
  }, [filteredOrders, isExpanded]);

  // Active Order
  const activeOrder = useMemo(() => {
    if (!orders || orders.length === 0) return null;
    return orders.find((o) => o.id === activeOrderId) || filteredOrders[0] || orders[0] || null;
  }, [orders, activeOrderId, filteredOrders]);

  // Create GHN Order Handler
  const handleCreateGhnOrder = async (orderId) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    setShippingOrderId(orderId);

    try {
      let ghnTrackingNumber = `GHN${orderId}${Math.floor(100000 + Math.random() * 900000)}`;
      let isCodOrder = targetOrder.paymentMethod === 'COD';

      const res = await axiosClient.post(`/shipping/create-ghn-order/${orderId}`);
      const resData = res.data;
      if (resData?.trackingNumber) {
        ghnTrackingNumber = resData.trackingNumber;
      }
      if (resData?.paymentMethod) {
        isCodOrder = resData.paymentMethod === 'COD';
      }

      // Update local state
      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === orderId
            ? {
              ...ord,
              status: 'SHIPPING',
              trackingNumber: ghnTrackingNumber,
              shippingProvider: `GHN • Mã vận đơn ${ghnTrackingNumber}`
            }
            : ord
        )
      );

      // Toast notification per requirements
      if (isCodOrder) {
        showToast(
          `Tạo vận đơn GHN thành công: ${ghnTrackingNumber} (COD: ${targetOrder.totalPrice.toLocaleString('vi-VN')}đ - Đã hủy điều phối tài xế thật)`,
          'success'
        );
      } else {
        showToast(
          `Tạo vận đơn GHN thành công: ${ghnTrackingNumber} (Đã thanh toán trước - Đã hủy điều phối tài xế thật)`,
          'success'
        );
      }
    } catch (err) {
      console.error('Lỗi gọi API tạo vận đơn GHN:', err);
      showToast(err.response?.data?.message || 'Có lỗi xảy ra khi tạo vận đơn GHN.', 'error');
    } finally {
      setShippingOrderId(null);
    }
  };

  // Update order status handler
  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await axiosClient.put(`/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
      );
      showToast(`Đã cập nhật đơn #${orderId} sang trạng thái "${getStatusText(newStatus)}"`, 'success');
    } catch (err) {
      console.error('Lỗi cập nhật trạng thái đơn:', err);
      showToast(err.response?.data?.message || 'Có lỗi khi cập nhật trạng thái đơn hàng', 'error');
    }
  };

  // Cancel order (calls /api/orders/{id}/cancel to auto restock inventory and restore vouchers)
  const handleCancelOrder = async (orderId) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy đơn hàng #${orderId}? Thao tác này sẽ tự động hoàn tồn kho và hoàn trả voucher vào ví của khách.`)) {
      return;
    }
    try {
      await axiosClient.put(`/orders/${orderId}/cancel`, {
        reason: 'Nhân viên hủy đơn từ cổng vận hành'
      });

      setOrders((prev) =>
        prev.map((ord) => (ord.id === orderId ? { ...ord, status: 'CANCELLED' } : ord))
      );
      showToast(`Đã huỷ đơn hàng #${orderId} và tự động hoàn trả tồn kho!`, 'success');
    } catch (err) {
      showToast(err.response?.data?.message || `Có lỗi khi hủy đơn hàng #${orderId}`, 'error');
    }
  };

  // AI Quality Inspection Run
  const fetchAiInspections = async () => {
    setIsCheckingAi(true);
    try {
      const res = await axiosClient.get('/ai/product-audit');
      setAiInspections(res.data?.data || []);
      showToast(`✦ Đã quét xong CSDL: Phát hiện ${res.data?.totalIssues || 0} điểm cần hoàn thiện!`, 'success');
    } catch (err) {
      console.error('Lỗi kiểm tra chất lượng AI:', err);
      showToast('Không thể quét chất lượng sản phẩm bằng AI', 'error');
    } finally {
      setIsCheckingAi(false);
    }
  };

  useEffect(() => {
    fetchAiInspections();
  }, []);

  const handleRunAiCheck = () => {
    fetchAiInspections();
  };

  // Status text & badge class helpers
  const getStatusBadge = (status) => {
    switch (status) {
      case 'PENDING_PAYMENT':
        return <span className="staff-badge staff-badge-pending">Chờ thanh toán</span>;
      case 'PENDING_REVIEW':
        return <span className="staff-badge staff-badge-pending">Chờ xác nhận TT</span>;
      case 'PAID':
        return <span className="staff-badge staff-badge-paid">Đã thanh toán</span>;
      case 'CONFIRMED':
        return <span className="staff-badge staff-badge-confirmed">Đã xác nhận</span>;
      case 'PROCESSING':
        return <span className="staff-badge staff-badge-processing">Đang xử lý</span>;
      case 'SHIPPING':
        return <span className="staff-badge staff-badge-shipping">Đang giao</span>;
      case 'COMPLETED':
        return <span className="staff-badge staff-badge-completed">Hoàn thành</span>;
      case 'CANCELLED':
        return <span className="staff-badge staff-badge-cancelled">Đã huỷ</span>;
      case 'EXPIRED':
        return <span className="staff-badge staff-badge-cancelled">Hết hạn</span>;
      default:
        return <span className="staff-badge">{status}</span>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'PENDING_PAYMENT': return 'Chờ thanh toán';
      case 'PENDING_REVIEW': return 'Chờ xác nhận TT';
      case 'PAID': return 'Đã thanh toán';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PROCESSING': return 'Đang xử lý';
      case 'SHIPPING': return 'Đang giao hàng';
      case 'COMPLETED': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã huỷ';
      case 'EXPIRED': return 'Hết hạn';
      default: return status;
    }
  };

  const formatPrice = (price) => {
    return (price || 0).toLocaleString('vi-VN') + 'đ';
  };

  return (
    <div className="staff-orders-page">
      {/* 1. Header & Staff Navbar Banner */}
      <div className="staff-header-banner">
        <div className="staff-header-title-box">
          <h1>Không gian vận hành</h1>
          <p className="staff-header-subtitle">
            Theo dõi, xử lý và giám sát vận chuyển đơn hàng theo thời gian thực
          </p>
        </div>
      </div>

      {/* 2. KPI Row: 4 cards neutral, no accent bg */}
      <div className="staff-kpi-row">
        <div className="staff-kpi-card">
          <span className="staff-kpi-label">Chờ xác nhận TT</span>
          <span className="staff-kpi-num">{kpiStats.pendingReview}</span>
        </div>
        <div className="staff-kpi-card">
          <span className="staff-kpi-label">Đã thanh toán</span>
          <span className="staff-kpi-num">{kpiStats.paid}</span>
        </div>
        <div className="staff-kpi-card">
          <span className="staff-kpi-label">Đang xử lý</span>
          <span className="staff-kpi-num">{kpiStats.processing}</span>
        </div>
        <div className="staff-kpi-card">
          <span className="staff-kpi-label">Đang giao</span>
          <span className="staff-kpi-num">{kpiStats.shipping}</span>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className="staff-filter-bar">
        <div className="staff-search-box">
          <i className="ti ti-search staff-search-icon"></i>
          <input
            type="text"
            className="staff-search-input"
            placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="staff-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Tất cả trạng thái</option>
          <option value="PENDING_REVIEW">Chờ xác nhận TT</option>
          <option value="PAID">Đã thanh toán</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="PROCESSING">Đang xử lý</option>
          <option value="SHIPPING">Đang giao</option>
          <option value="COMPLETED">Hoàn thành</option>
          <option value="CANCELLED">Đã huỷ</option>
        </select>

        <select
          className="staff-select"
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
        >
          <option value="ALL">Tất cả thời gian</option>
          <option value="TODAY">Hôm nay</option>
          <option value="7_DAYS">7 ngày qua</option>
          <option value="30_DAYS">30 ngày qua</option>
        </select>

        <button
          type="button"
          className="staff-filter-btn"
          onClick={() => showToast(`Đã áp dụng bộ lọc: ${filteredOrders.length} đơn hàng`, 'info')}
        >
          <i className="ti ti-filter"></i>
          <span>Lọc đơn</span>
        </button>
      </div>

      {/* 4. Split Layout (60% Table + 40% Detail Panel) */}
      <div className="staff-split-layout">
        {/* Left Column (60%): Hàng đợi xử lý Table */}
        <div className="staff-table-card">
          <div className="staff-table-header-box">
            <h2 className="staff-table-title">
              <span>Hàng đợi xử lý</span>
            </h2>
          </div>

          <div className="staff-table-responsive">
            <table className="staff-orders-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Giá trị</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="staff-empty-state">
                      {loading ? 'Đang nạp danh sách đơn hàng...' : 'Không tìm thấy đơn hàng nào phù hợp với bộ lọc.'}
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((ord) => {
                    const isActive = ord.id === activeOrder?.id;
                    return (
                      <tr
                        key={ord.id}
                        className={`staff-table-row ${isActive ? 'active' : ''}`}
                        onClick={() => setActiveOrderId(ord.id)}
                      >
                        <td className="staff-table-order-id">
                          #{ord.code || `GHT${ord.id}`}
                        </td>
                        <td>
                          <span className="staff-table-cust-name">{ord.customer?.name}</span>
                          <span className="staff-table-cust-phone">{ord.customer?.phone}</span>
                        </td>
                        <td className="staff-table-amount">
                          {formatPrice(ord.totalPrice)}
                          <div style={{ marginTop: '4px' }}>
                            {ord.paymentMethod === 'COD' ? (
                              <span className="staff-badge staff-badge-cod" title="Thu hộ tiền mặt khi phát hàng">
                                💵 COD: {formatPrice(ord.totalPrice)}
                              </span>
                            ) : (
                              <span className="staff-badge staff-badge-bank" title="Đã thanh toán trước qua QR SePay">
                                🏦 Chuyển khoản (0đ)
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {getStatusBadge(ord.status)}
                          {ord.trackingNumber && (
                            <div style={{ marginTop: '4px', fontSize: '11px', fontFamily: 'monospace', color: 'var(--color-accent)' }}>
                              #{ord.trackingNumber}
                            </div>
                          )}
                        </td>
                        <td>
                          {/* Status specific actions */}
                          {ord.status === 'PENDING_REVIEW' && (
                            <button
                              type="button"
                              className="staff-action-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveOrderId(ord.id);
                                handleUpdateStatus(ord.id, 'CONFIRMED');
                              }}
                            >
                              Xác nhận →
                            </button>
                          )}
                          {ord.status === 'PAID' && (
                            isActive ? (
                              <span className="staff-action-link active-tag">Đang chọn</span>
                            ) : (
                              <button
                                type="button"
                                className="staff-action-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveOrderId(ord.id);
                                }}
                              >
                                Xem giao dịch
                              </button>
                            )
                          )}
                          {ord.status === 'CONFIRMED' && (
                            <button
                              type="button"
                              className="staff-action-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveOrderId(ord.id);
                                handleUpdateStatus(ord.id, 'PROCESSING');
                              }}
                            >
                              Xử lý →
                            </button>
                          )}
                          {ord.status === 'PROCESSING' && (
                            <button
                              type="button"
                              className="staff-action-link"
                              disabled={shippingOrderId === ord.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveOrderId(ord.id);
                                handleCreateGhnOrder(ord.id);
                              }}
                            >
                              {shippingOrderId === ord.id ? 'Đang tạo GHN...' : 'Bàn giao GHN →'}
                            </button>
                          )}
                          {ord.status === 'SHIPPING' && (
                            <button
                              type="button"
                              className="staff-action-link"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveOrderId(ord.id);
                                handleUpdateStatus(ord.id, 'COMPLETED');
                              }}
                            >
                              Hoàn tất →
                            </button>
                          )}
                          {ord.status === 'COMPLETED' && (
                            <span className="staff-action-link active-tag">Hoàn tất</span>
                          )}
                          {ord.status === 'CANCELLED' && (
                            <span className="staff-action-link active-tag" style={{ color: 'var(--color-danger)' }}>
                              Đã huỷ
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Toggle Expand / Collapse Button */}
          {filteredOrders.length > 5 && (
            <div className="staff-table-footer">
              <button
                type="button"
                className="staff-toggle-expand-btn"
                onClick={() => setIsExpanded((prev) => !prev)}
              >
                {isExpanded ? (
                  <>
                    <i className="ti ti-chevron-up"></i>
                    <span>Thu gọn</span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-chevron-down"></i>
                    <span>{filteredOrders.length - 5} đơn hàng khác</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Column (40%): Detail Panel */}
        {activeOrder ? (
          <div className="staff-detail-panel">
            <div className="staff-detail-header">
              <h3 className="staff-detail-title">
                Đơn #{activeOrder.code || `GHT${activeOrder.id}`}
              </h3>
              {getStatusBadge(activeOrder.status)}
            </div>

            {/* Customer Info */}
            <div className="staff-detail-section">
              <span className="staff-detail-sec-title">Khách hàng</span>
              <div className="staff-customer-name-phone">
                {activeOrder.customer?.name} • {activeOrder.customer?.phone}
              </div>
              <div className="staff-customer-address">
                {activeOrder.customer?.address}
              </div>
            </div>

            {/* Compact Product List */}
            <div className="staff-detail-section">
              <span className="staff-detail-sec-title">Danh sách sản phẩm</span>
              <div className="staff-compact-products">
                {(activeOrder.items || []).map((it, idx) => (
                  <div key={idx} className="staff-compact-item">
                    <span className="staff-compact-item-name" title={it.name}>
                      {it.name}
                    </span>
                    <span className="staff-compact-item-qty">×{it.quantity}</span>
                    <span className="staff-compact-item-price">{formatPrice(it.price * it.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping Info */}
            <div className="staff-detail-section">
              <span className="staff-detail-sec-title">Đơn vị vận chuyển</span>
              <div className="staff-shipping-info">
                <i className="ti ti-truck"></i>
                <div>
                  <div>{activeOrder.shippingProvider || 'GHN • Tiêu chuẩn'}</div>
                  {activeOrder.trackingNumber && (
                    <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)' }}>
                      Mã vận đơn: #{activeOrder.trackingNumber}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Payment Method Details */}
            <div className="staff-detail-section">
              <span className="staff-detail-sec-title">Phương thức thanh toán</span>
              <div style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {activeOrder.paymentMethod === 'COD' ? (
                  <span className="staff-badge staff-badge-cod">
                    💵 Thu tiền mặt khi giao (COD: {formatPrice(activeOrder.totalPrice)})
                  </span>
                ) : (
                  <span className="staff-badge staff-badge-bank">
                    🏦 Chuyển khoản QR SePay (Thu hộ: 0đ)
                  </span>
                )}
              </div>
            </div>

            {/* Total Box */}
            <div className="staff-detail-total-box">
              <span className="staff-detail-total-label">Tổng thanh toán:</span>
              <span className="staff-detail-total-val">{formatPrice(activeOrder.totalPrice)}</span>
            </div>

            {/* Internal Note Textarea */}
            <div className="staff-note-box">
              <label htmlFor="staff-internal-note" className="staff-note-label">
                Ghi chú nội bộ:
              </label>
              <textarea
                id="staff-internal-note"
                className="staff-note-textarea"
                placeholder="Nhập ghi chú cho nhân viên kho hoặc giao nhận..."
                value={internalNotes[activeOrder.id] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setInternalNotes((prev) => ({
                    ...prev,
                    [activeOrder.id]: val
                  }));
                }}
              />
            </div>

            {/* Actions: Huỷ đơn + Xác nhận đơn */}
            <div className="staff-detail-actions">
              <button
                type="button"
                className="staff-btn-cancel"
                onClick={() => handleCancelOrder(activeOrder.id)}
                disabled={activeOrder.status === 'CANCELLED' || activeOrder.status === 'COMPLETED'}
              >
                Huỷ đơn
              </button>

              {activeOrder.status === 'PENDING_REVIEW' && (
                <button
                  type="button"
                  className="staff-btn-confirm"
                  onClick={() => handleUpdateStatus(activeOrder.id, 'CONFIRMED')}
                >
                  Xác nhận đơn
                </button>
              )}
              {activeOrder.status === 'PAID' && (
                <button
                  type="button"
                  className="staff-btn-confirm"
                  onClick={() => handleUpdateStatus(activeOrder.id, 'CONFIRMED')}
                >
                  Xác nhận đơn
                </button>
              )}
              {activeOrder.status === 'CONFIRMED' && (
                <button
                  type="button"
                  className="staff-btn-confirm"
                  onClick={() => handleUpdateStatus(activeOrder.id, 'PROCESSING')}
                >
                  Chuyển sang xử lý
                </button>
              )}
              {activeOrder.status === 'PROCESSING' && (
                <button
                  type="button"
                  className="staff-btn-confirm"
                  disabled={shippingOrderId === activeOrder.id}
                  onClick={() => handleCreateGhnOrder(activeOrder.id)}
                >
                  {shippingOrderId === activeOrder.id ? 'Đang tạo vận đơn GHN...' : 'Bàn giao vận chuyển (GHN)'}
                </button>
              )}
              {activeOrder.status === 'SHIPPING' && (
                <button
                  type="button"
                  className="staff-btn-confirm"
                  onClick={() => handleUpdateStatus(activeOrder.id, 'COMPLETED')}
                >
                  Xác nhận hoàn tất
                </button>
              )}
              {(activeOrder.status === 'COMPLETED' || activeOrder.status === 'CANCELLED') && (
                <button
                  type="button"
                  className="staff-btn-confirm"
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                >
                  Đơn đã đóng
                </button>
              )}
            </div>

            {/* Print Invoice Button for Valid Statuses */}
            {['CONFIRMED', 'PROCESSING', 'SHIPPING', 'COMPLETED'].includes(activeOrder.status) && (
              <div style={{ marginTop: '4px' }}>
                <button
                  type="button"
                  className="staff-btn-invoice"
                  onClick={() => handleDownloadInvoice(activeOrder.id)}
                  disabled={downloadingInvoiceId === activeOrder.id}
                >
                  {downloadingInvoiceId === activeOrder.id ? (
                    'Đang tạo hóa đơn PDF...'
                  ) : (
                    <>
                      <i className="ti ti-printer"></i> In Hóa Đơn PDF
                    </>
                  )}
                </button>
              </div>
            )}

            <p className="staff-flow-note">
              Sau xác nhận: Đã xác nhận → Đang xử lý → Đang giao.
            </p>
          </div>
        ) : (
          <div className="staff-detail-panel staff-empty-state">
            Chọn một đơn hàng từ danh sách để xem chi tiết
          </div>
        )}
      </div>

      {/* 5. Section AI Kiểm tra chất lượng sản phẩm */}
      <div className="staff-ai-section">
        <div className="staff-ai-header">
          <div className="staff-ai-title-box">
            <h2>
              <i className="ti ti-sparkles staff-ai-sparkle"></i>
              <span>AI kiểm tra chất lượng sản phẩm</span>
            </h2>
            <p className="staff-ai-subtitle">
              Ưu tiên hoàn thiện thông tin trước khi đưa sản phẩm lên cửa hàng.
            </p>
          </div>

          <button
            type="button"
            className="staff-ai-run-btn"
            onClick={handleRunAiCheck}
            disabled={isCheckingAi}
          >
            <i className={`ti ${isCheckingAi ? 'ti-loader' : 'ti-sparkles'}`}></i>
            <span>{isCheckingAi ? 'Đang kiểm tra AI...' : 'Chạy kiểm tra mới'}</span>
          </button>
        </div>

        <div className="staff-ai-table-responsive">
          <table className="staff-ai-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Vấn đề phát hiện</th>
                <th>Mức độ</th>
                <th>Gợi ý xử lý</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {aiInspections.length === 0 && !isCheckingAi ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '2.5rem', color: '#16a34a' }}>
                    <i className="ti ti-circle-check" style={{ marginRight: '8px', fontSize: '1.25rem', verticalAlign: 'middle' }}></i>
                    <strong style={{ fontSize: '0.95rem' }}>Tất cả sản phẩm đạt chuẩn dữ liệu 100%!</strong>
                  </td>
                </tr>
              ) : (
                aiInspections.map((item) => (
                  <tr key={item.id}>
                    <td className="staff-ai-prod-name">{item.productName}</td>
                    <td className="staff-ai-issue-text">{item.detectedIssue}</td>
                    <td>
                      <span className="staff-ai-badge-missing">{item.level}</span>
                    </td>
                    <td className="staff-ai-suggestion">{item.suggestion}</td>
                    <td>
                      <button
                        type="button"
                        className="staff-ai-action-btn"
                        onClick={() => setEditingProductId(item.productId)}
                        title="Mở form cập nhật trực tiếp không chuyển trang"
                      >
                        <span>Sửa sản phẩm</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Sửa sản phẩm trực tiếp tại trang StaffOrders */}
      {editingProductId && (
        <ProductEditModal
          isOpen={Boolean(editingProductId)}
          productId={editingProductId}
          onClose={() => setEditingProductId(null)}
          onSaveSuccess={() => {
            setEditingProductId(null);
            fetchAiInspections();
          }}
        />
      )}
    </div>
  );
}
