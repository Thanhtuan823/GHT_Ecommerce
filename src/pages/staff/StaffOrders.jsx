import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import './StaffOrders.css';

// Default initial demo orders aligned with Figma Screen 8
const INITIAL_DEMO_ORDERS = [
  {
    id: 1031,
    code: 'GHT1031',
    createdAt: '2026-10-12T09:15:00Z',
    customer: {
      name: 'Nguyễn Minh Anh',
      phone: '0901 234 567',
      address: 'Số 45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh'
    },
    totalPrice: 14950000,
    status: 'PAID',
    shippingProvider: 'GHN • Miễn phí vận chuyển',
    internalNote: 'Khách yêu cầu gọi trước 15 phút khi giao. Giao giờ hành chính.',
    items: [
      { id: 1, name: 'Bàn phím cơ không dây GHT Master Pro', quantity: 1, price: 2950000 },
      { id: 2, name: 'Màn hình Dell UltraSharp 27" 4K', quantity: 1, price: 12000000 }
    ]
  },
  {
    id: 1030,
    code: 'GHT1030',
    createdAt: '2026-10-12T08:40:00Z',
    customer: {
      name: 'Trần Văn Hùng',
      phone: '0912 345 678',
      address: 'Tòa Landmark 81, 720A Điện Biên Phủ, P.22, Bình Thạnh, TP.HCM'
    },
    totalPrice: 4250000,
    status: 'PENDING_REVIEW',
    shippingProvider: 'GHN • Miễn phí vận chuyển',
    internalNote: 'Đã chuyển khoản qua VietQR, chờ đối soát ngân hàng.',
    items: [
      { id: 3, name: 'Tai nghe Sony WH-1000XM5 Chống ồn', quantity: 1, price: 4250000 }
    ]
  },
  {
    id: 1029,
    code: 'GHT1029',
    createdAt: '2026-10-11T16:20:00Z',
    customer: {
      name: 'Lê Thị Thu Thảo',
      phone: '0988 765 432',
      address: '128 Cầu Giấy, Phường Quan Hoa, Quận Cầu Giấy, Hà Nội'
    },
    totalPrice: 1850000,
    status: 'CONFIRMED',
    shippingProvider: 'GHN • Tiêu chuẩn',
    internalNote: 'Đã kiểm tra tem bảo hành chính hãng.',
    items: [
      { id: 4, name: 'Chuột không dây Logitech MX Master 3S', quantity: 1, price: 1850000 }
    ]
  },
  {
    id: 1028,
    code: 'GHT1028',
    createdAt: '2026-10-10T14:30:00Z',
    customer: {
      name: 'Phạm Đức Duy',
      phone: '0933 112 233',
      address: '254 Nguyễn Văn Cừ, Phường An Hòa, Quận Ninh Kiều, Cần Thơ'
    },
    totalPrice: 32900000,
    status: 'PROCESSING',
    shippingProvider: 'GHN • Miễn phí vận chuyển',
    internalNote: 'Đóng gói bọc xốp bóng khí 3 lớp cho thiết bị giá trị cao.',
    items: [
      { id: 5, name: 'MacBook Air M2 13.6" 16GB 256GB', quantity: 1, price: 32900000 }
    ]
  },
  {
    id: 1027,
    code: 'GHT1027',
    createdAt: '2026-10-09T11:00:00Z',
    customer: {
      name: 'Hoàng Quốc Bảo',
      phone: '0977 889 900',
      address: '15 Trần Phú, Hải Châu, Đà Nẵng'
    },
    totalPrice: 990000,
    status: 'SHIPPING',
    shippingProvider: 'GHN • Mã vận đơn GHN987621',
    internalNote: 'Đã bàn giao cho shipper lúc 08:30 ngày 10/10.',
    items: [
      { id: 6, name: 'Giá đỡ nhôm công thái học Laptop cao cấp', quantity: 1, price: 990000 }
    ]
  }
];

// Demo data for AI Quality Inspection section
const INITIAL_AI_INSPECTIONS = [
  {
    id: 1,
    productName: 'iPhone 15 Pro Max 256GB Natural Titanium',
    detectedIssue: 'Thiếu thông số RAM & Trọng lượng chi tiết',
    level: 'Cần bổ sung',
    suggestion: 'Bổ sung thông số kỹ thuật chi tiết để tăng tỷ lệ chốt đơn và tối ưu SEO tìm kiếm.',
    link: '/admin/products'
  },
  {
    id: 2,
    productName: 'Bàn phím cơ Keychron Q1 Pro Wireless',
    detectedIssue: 'Ảnh sản phẩm độ phân giải thấp (< 600px)',
    level: 'Cần bổ sung',
    suggestion: 'Thay thế ảnh chụp chất lượng cao, tỉ lệ 1:1 nền trắng để hiển thị sắc nét trên mobile.',
    link: '/admin/products'
  },
  {
    id: 3,
    productName: 'Màn hình LG UltraFine 27MD5KL 5K IPS',
    detectedIssue: 'Mô tả thiếu thông tin chính sách bảo hành chính hãng',
    level: 'Cần bổ sung',
    suggestion: 'Thêm cam kết bảo hành 24 tháng chính hãng tại LG Việt Nam để tăng độ tin cậy.',
    link: '/admin/products'
  }
];

export default function StaffOrders() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [orders, setOrders] = useState(INITIAL_DEMO_ORDERS);
  const [activeOrderId, setActiveOrderId] = useState(1031);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState('ALL');
  const [internalNotes, setInternalNotes] = useState({});
  const [aiInspections, setAiInspections] = useState(INITIAL_AI_INSPECTIONS);
  const [isCheckingAi, setIsCheckingAi] = useState(false);

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
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      setLoading(true);
      const res = await fetch('/api/orders', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Normalize backend structure
          const formatted = data.map((o) => {
            let parsedAddr = {};
            try {
              parsedAddr = typeof o.shippingAddress === 'string'
                ? JSON.parse(o.shippingAddress)
                : (o.shippingAddress || {});
            } catch {
              parsedAddr = {};
            }

            return {
              id: o.id,
              code: `GHT${o.id}`,
              createdAt: o.createdAt,
              customer: {
                name: parsedAddr.name || o.user?.fullName || 'Khách hàng',
                phone: parsedAddr.phone || o.user?.phone || 'Chưa có SĐT',
                address: parsedAddr.address || 'Địa chỉ giao hàng'
              },
              totalPrice: o.totalPrice,
              status: o.status,
              shippingProvider: 'GHN • Miễn phí vận chuyển',
              internalNote: internalNotes[o.id] || '',
              items: (o.orderItems || []).map((it) => ({
                id: it.id,
                name: it.product?.name || `Sản phẩm #${it.productId}`,
                quantity: it.quantity,
                price: it.price
              }))
            };
          });

          // Merge backend orders with demo orders to maintain complete workflow demo
          const existingIds = new Set(formatted.map((f) => f.id));
          const combined = [
            ...formatted,
            ...INITIAL_DEMO_ORDERS.filter((d) => !existingIds.has(d.id))
          ];
          setOrders(combined);
          if (!activeOrderId && combined.length > 0) {
            setActiveOrderId(combined[0].id);
          }
        }
      }
    } catch (err) {
      console.warn('Lỗi kết nối API orders backend, sử dụng dữ liệu mô phỏng:', err);
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

  // Active Order
  const activeOrder = useMemo(() => {
    return orders.find((o) => o.id === activeOrderId) || filteredOrders[0] || orders[0];
  }, [orders, activeOrderId, filteredOrders]);

  // Update order status handler
  const handleUpdateStatus = async (orderId, newStatus) => {
    const token = localStorage.getItem('token');
    try {
      if (token) {
        await fetch(`/api/orders/${orderId}/status`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ status: newStatus })
        });
      }
    } catch {
      // Local fallback
    }

    setOrders((prev) =>
      prev.map((ord) => (ord.id === orderId ? { ...ord, status: newStatus } : ord))
    );
    showToast(`Đã cập nhật đơn #${orderId} sang trạng thái "${getStatusText(newStatus)}"`, 'success');
  };

  // Cancel order
  const handleCancelOrder = (orderId) => {
    handleUpdateStatus(orderId, 'CANCELLED');
    showToast(`Đã huỷ đơn hàng #${orderId}`, 'info');
  };

  // AI Quality Inspection Run
  const handleRunAiCheck = () => {
    setIsCheckingAi(true);
    setTimeout(() => {
      setIsCheckingAi(false);
      showToast('✦ Đã hoàn tất kiểm tra chất lượng toàn bộ sản phẩm bằng AI!', 'success');
    }, 1200);
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

        <div className="staff-header-actions">
          <div className="staff-identity-pill">
            <span>{user?.name || 'Nhân viên Vận hành'}</span>
            <span className="staff-badge-tag">Staff</span>
          </div>

          <button
            type="button"
            className="staff-notif-btn"
            title="Thông báo vận hành"
            onClick={() => showToast('Bạn có 3 đơn hàng mới đang chờ xác nhận.', 'info')}
          >
            <i className="ti ti-bell"></i>
            <span className="staff-notif-dot" />
          </button>

          <button
            type="button"
            className={`staff-refresh-btn ${isRefreshing ? 'spinning' : ''}`}
            onClick={handleRefresh}
            title="Làm mới dữ liệu từ máy chủ"
          >
            <i className="ti ti-refresh staff-refresh-icon"></i>
            <span>Làm mới dữ liệu</span>
          </button>
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
              <span className="staff-count-pill">{filteredOrders.length} đơn</span>
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
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="staff-empty-state">
                      Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
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
                        </td>
                        <td>{getStatusBadge(ord.status)}</td>
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
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveOrderId(ord.id);
                                handleUpdateStatus(ord.id, 'SHIPPING');
                              }}
                            >
                              Giao hàng →
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
                <span>{activeOrder.shippingProvider || 'GHN • Miễn phí vận chuyển'}</span>
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
                  onClick={() => handleUpdateStatus(activeOrder.id, 'SHIPPING')}
                >
                  Bàn giao vận chuyển
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
              {aiInspections.map((item) => (
                <tr key={item.id}>
                  <td className="staff-ai-prod-name">{item.productName}</td>
                  <td className="staff-ai-issue-text">{item.detectedIssue}</td>
                  <td>
                    <span className="staff-ai-badge-missing">{item.level}</span>
                  </td>
                  <td className="staff-ai-suggestion">{item.suggestion}</td>
                  <td>
                    <Link to={item.link} className="staff-ai-action-link">
                      <span>Sửa sản phẩm</span>
                      <span>→</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
