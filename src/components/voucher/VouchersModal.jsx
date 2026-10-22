import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/ToastContext';
import axiosClient from '../../utils/axiosClient';
import ButtonSpinner from '../common/ButtonSpinner';
import './VouchersModal.css';

const VouchersModal = () => {
  const { isVouchersModalOpen, closeVouchersModal, voucherModalOptions, user } = useAuth();
  const toast = useToast();

  const isCheckout = voucherModalOptions?.isCheckout === true;
  const currentOrderAmount = voucherModalOptions?.currentOrderAmount || 0;
  const onApplyCode = voucherModalOptions?.onApply;

  const [vouchers, setVouchers] = useState([]); // User's saved vouchers in wallet
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [manualCode, setManualCode] = useState('');

  // Load vouchers when modal opens - ONLY calls GET /discounts/my-vouchers
  useEffect(() => {
    if (!isVouchersModalOpen) return;

    setActiveTab(isCheckout && currentOrderAmount > 0 ? 'applicable' : 'all');
    setManualCode('');

    const fetchVouchers = async () => {
      setLoading(true);
      try {
        if (user) {
          const res = await axiosClient.get('/discounts/my-vouchers');
          setVouchers(Array.isArray(res.data) ? res.data : []);
        } else {
          setVouchers([]);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách mã ưu đãi trong ví', err);
        toast.error('Không thể tải danh sách mã ưu đãi trong ví. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    fetchVouchers();
  }, [isVouchersModalOpen, isCheckout, currentOrderAmount, user]);

  // Escape key listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVouchersModalOpen) {
        closeVouchersModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVouchersModalOpen, closeVouchersModal]);

  // Format currency helper
  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  // Format date helper
  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
      return '';
    }
  };

  // Copy code handler
  const handleCopyCode = async (code) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success(`Đã sao chép mã ${code}!`);
    } catch {
      toast.error(`Không thể sao chép mã. Vui lòng copy thủ công: ${code}`);
    }
  };

  // Apply code handler
  const handleApply = (code) => {
    if (onApplyCode) {
      onApplyCode(code);
      closeVouchersModal();
    } else {
      handleCopyCode(code);
    }
  };

  // Check if voucher is eligible for current order
  const checkEligibility = (voucher) => {
    if (!currentOrderAmount) return { eligible: true, diff: 0 };
    const min = voucher.minOrderAmount || 0;
    const diff = min - currentOrderAmount;
    return {
      eligible: diff <= 0,
      diff: Math.max(0, diff)
    };
  };

  // Check if voucher is expiring soon (<= 3 days)
  const isExpiringSoon = (endDate) => {
    if (!endDate) return false;
    const now = new Date();
    const end = new Date(endDate);
    const diffDays = (end - now) / (1000 * 60 * 60 * 24);
    return diffDays > 0 && diffDays <= 3;
  };

  // Determine list to display
  const currentList = useMemo(() => {
    if (isCheckout && activeTab === 'applicable' && currentOrderAmount > 0) {
      return vouchers.filter((v) => currentOrderAmount >= (v.minOrderAmount || 0));
    }
    return vouchers;
  }, [isCheckout, activeTab, currentOrderAmount, vouchers]);

  if (!isVouchersModalOpen) return null;

  return (
    <div className="vouchers-modal-backdrop" onClick={closeVouchersModal}>
      <div className="vouchers-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="vouchers-modal-header">
          <div className="vouchers-header-info">
            <div className="vouchers-header-icon">
              <i className="ti ti-wallet"></i>
            </div>
            <div>
              <h3 className="vouchers-header-title">Ví Mã Ưu Đãi</h3>
              <p className="vouchers-header-sub">
                Danh sách mã giảm giá đã lưu trong ví cá nhân của bạn
              </p>
            </div>
          </div>
          <button
            id="vouchers-modal-close-btn"
            type="button"
            className="vouchers-modal-close-btn"
            onClick={closeVouchersModal}
            aria-label="Đóng"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>

        {/* Tabs */}
        {isCheckout ? (
          <div className="vouchers-modal-tabs">
            {currentOrderAmount > 0 && (
              <button
                type="button"
                className={`vouchers-tab-btn ${activeTab === 'applicable' ? 'active' : ''}`}
                onClick={() => setActiveTab('applicable')}
              >
                <span>Mã đủ điều kiện</span>
                <span className="vouchers-tab-count">
                  {vouchers.filter((v) => currentOrderAmount >= (v.minOrderAmount || 0)).length}
                </span>
              </button>
            )}
            <button
              type="button"
              className={`vouchers-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
              onClick={() => setActiveTab('all')}
            >
              <span>Tất cả mã trong ví</span>
              <span className="vouchers-tab-count">{vouchers.length}</span>
            </button>
          </div>
        ) : (
          <div className="vouchers-modal-tabs">
            <div className="vouchers-wallet-summary-bar">
              <i className="ti ti-ticket"></i>
              <span>Mã ưu đãi trong ví</span>
              <span className="vouchers-tab-count">{vouchers.length}</span>
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="vouchers-modal-body">
          {/* Manual Input Code Bar */}
          <div className="vouchers-manual-input-box">
            <input
              type="text"
              className="vouchers-manual-input"
              placeholder="Nhập mã ưu đãi khác..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode.trim()) {
                  handleApply(manualCode.trim().toUpperCase());
                }
              }}
            />
            <button
              type="button"
              className="vouchers-manual-btn"
              disabled={!manualCode.trim()}
              onClick={() => {
                if (manualCode.trim()) {
                  handleApply(manualCode.trim().toUpperCase());
                }
              }}
            >
              {onApplyCode ? 'Áp dụng' : 'Sao chép'}
            </button>
          </div>

          {/* Current Order Hint */}
          {currentOrderAmount > 0 && (
            <div className="vouchers-order-hint">
              <i className="ti ti-shopping-cart"></i>
              <span>
                Giá trị đơn hàng hiện tại của bạn: <strong>{formatPrice(currentOrderAmount)}</strong>
              </span>
            </div>
          )}

          {/* Ticket List & States */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <ButtonSpinner />
              <div style={{ marginTop: '10px', fontSize: '13px', color: '#64748b' }}>
                Đang tải danh sách mã ưu đãi...
              </div>
            </div>
          ) : !user ? (
            <div className="vouchers-empty-state">
              <div className="vouchers-empty-icon">
                <i className="ti ti-user-x"></i>
              </div>
              <h4 className="vouchers-empty-title">Bạn chưa đăng nhập</h4>
              <p className="vouchers-empty-sub">
                Vui lòng đăng nhập để xem và sử dụng các mã ưu đãi trong ví cá nhân của bạn.
              </p>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="vouchers-empty-state">
              <div className="vouchers-empty-icon">
                <i className="ti ti-wallet-off"></i>
              </div>
              <h4 className="vouchers-empty-title">Ví của bạn chưa có mã ưu đãi nào</h4>
              <p className="vouchers-empty-sub">
                Ví của bạn chưa có mã ưu đãi nào. Hãy lưu mã tại banner hoặc trang chi tiết sản phẩm để nhận ưu đãi!
              </p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="vouchers-empty-state">
              <div className="vouchers-empty-icon">
                <i className="ti ti-ticket-off"></i>
              </div>
              <h4 className="vouchers-empty-title">Chưa có mã đủ điều kiện</h4>
              <p className="vouchers-empty-sub">
                Đơn hàng hiện tại chưa đạt mức tối thiểu của các mã trong ví. Hãy chọn tab "Tất cả mã trong ví" để xem điều kiện áp dụng.
              </p>
            </div>
          ) : (
            currentList.map((v) => {
              const { eligible, diff } = checkEligibility(v);
              const expiring = isExpiringSoon(v.endDate);
              const isFixed = v.discountType === 'FIXED';

              return (
                <div
                  key={v.id}
                  className={`voucher-ticket-card ${!eligible ? 'is-disabled' : ''}`}
                >
                  {/* Cuống vé (Left Stub) */}
                  <div className={`voucher-ticket-stub ${isFixed ? 'fixed-discount' : ''}`}>
                    <div className="voucher-stub-icon">
                      <i className={isFixed ? 'ti ti-cash' : 'ti ti-percentage'}></i>
                    </div>
                    <div className="voucher-stub-value">
                      {isFixed ? formatPrice(v.discountValue) : `${v.discountValue}%`}
                    </div>
                    <div className="voucher-stub-type">
                      {isFixed ? 'Giảm tiền' : 'Giảm giá'}
                    </div>
                  </div>

                  {/* Vết cắt phân cách (Cut-out Notches) */}
                  <div className="voucher-ticket-divider">
                    <div className="voucher-notch-top"></div>
                    <div className="voucher-notch-bottom"></div>
                  </div>

                  {/* Thân vé (Right Body) */}
                  <div className="voucher-ticket-body">
                    <div className="voucher-body-top">
                      <div className="voucher-code-wrap">
                        <span className="voucher-code-badge">{v.code}</span>
                        {expiring && (
                          <span className="voucher-status-pill warning">
                            <i className="ti ti-clock"></i> Sắp hết hạn
                          </span>
                        )}
                        {!expiring && (
                          <span className="voucher-status-pill active">
                            <i className="ti ti-circle-check"></i> Trong ví
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="voucher-desc-text">{v.description || `Mã ưu đãi ${v.code}`}</p>

                    <div className="voucher-condition-meta">
                      <div className="voucher-condition-item">
                        <i className="ti ti-info-circle"></i>
                        <span>Đơn tối thiểu: <strong>{formatPrice(v.minOrderAmount)}</strong></span>
                      </div>
                      {v.maxDiscountAmount && (
                        <div className="voucher-condition-item">
                          <i className="ti ti-shield"></i>
                          <span>Giảm tối đa: <strong>{formatPrice(v.maxDiscountAmount)}</strong></span>
                        </div>
                      )}
                      {!eligible && diff > 0 && (
                        <div className="voucher-condition-item warning">
                          <i className="ti ti-alert-triangle"></i>
                          <span>Cần mua thêm <strong>{formatPrice(diff)}</strong> để sử dụng mã này</span>
                        </div>
                      )}
                    </div>

                    <div className="voucher-body-bottom">
                      <span className="voucher-expiry-text">
                        Hạn dùng: {formatDate(v.endDate)}
                      </span>

                      <div className="voucher-actions-group">
                        <button
                          id={`copy-voucher-${v.code}`}
                          type="button"
                          className="voucher-btn-copy"
                          onClick={() => handleCopyCode(v.code)}
                          title="Sao chép mã vào bộ nhớ tạm"
                        >
                          <i className="ti ti-copy"></i>
                          <span>Sao chép</span>
                        </button>

                        {/* If in checkout or onApply is present: button [Áp dụng ngay] */}
                        {onApplyCode && (
                          <button
                            id={`apply-voucher-${v.code}`}
                            type="button"
                            className="voucher-btn-apply"
                            disabled={!eligible}
                            onClick={() => handleApply(v.code)}
                          >
                            <i className="ti ti-check"></i>
                            <span>Áp dụng ngay</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default VouchersModal;
