import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/ToastContext';
import axiosClient from '../../utils/axiosClient';
import './CouponRail.css';

const CouponRail = () => {
  const { user, openVouchersModal } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAvailableVouchers = async () => {
      try {
        const res = await axiosClient.get('/discounts/available');
        if (isMounted) {
          setVouchers(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách voucher:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAvailableVouchers();
    return () => {
      isMounted = false;
    };
  }, [user]);

  const formatPrice = (val) => {
    if (!val && val !== 0) return '0đ';
    if (val >= 1000000) {
      const millions = val / 1000000;
      return Number.isInteger(millions) ? `${millions} Tr` : `${millions.toFixed(1)} Tr`;
    }
    if (val >= 1000) {
      return `${Math.round(val / 1000)}k`;
    }
    return `${new Intl.NumberFormat('vi-VN').format(val)}đ`;
  };

  const handleClaim = async (v) => {
    if (!user) {
      toast.info('Vui lòng đăng nhập để lưu mã ưu đãi vào ví của bạn!');
      navigate('/login', { state: { from: window.location.pathname } });
      return;
    }

    if (v.isClaimed) return;

    setClaimingId(v.id);
    try {
      const res = await axiosClient.post(`/discounts/claim/${v.id}`);
      toast.success(res.data?.message || `Đã lưu mã ${v.code} vào ví ưu đãi!`);
      setVouchers((prev) =>
        prev.map((item) => (item.id === v.id ? { ...item, isClaimed: true } : item))
      );
    } catch (err) {
      const msg = err.response?.data?.message || 'Không thể lưu mã vào ví lúc này.';
      toast.error(msg);
    } finally {
      setClaimingId(null);
    }
  };

  if (!loading && vouchers.length === 0) {
    return null;
  }

  return (
    <section className="coupon-rail-wrapper">
      <div className="coupon-rail-header">
        <div className="coupon-rail-title-box">
          <div className="coupon-rail-icon">
            <i className="ti ti-ticket"></i>
          </div>
          <div>
            <h3 className="coupon-rail-title">Kho Voucher Độc Quyền Hôm Nay</h3>
            <p className="coupon-rail-sub">
              Bấm lưu trực tiếp vào ví để tự động áp dụng ưu đãi giảm sốc khi thanh toán
            </p>
          </div>
        </div>

        <button
          type="button"
          className="coupon-rail-view-all"
          onClick={() => openVouchersModal()}
        >
          <span>Xem tất cả ({vouchers.length})</span>
          <i className="ti ti-chevron-right"></i>
        </button>
      </div>

      <div className="coupon-rail-list">
        {loading
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="coupon-ticket-skeleton skeleton"></div>
            ))
          : vouchers.map((v) => {
              const isFixed = v.discountType === 'FIXED' || v.type === 'FixedAmount';
              const val = v.discountValue !== undefined ? v.discountValue : (v.value || 0);
              const discountText = isFixed
                ? `Giảm ${formatPrice(val)}`
                : `Giảm ${val}%`;

              const minOrderText = v.minOrderAmount
                ? `Đơn từ ${formatPrice(v.minOrderAmount)}`
                : 'Mọi đơn hàng';

              const maxCapText = !isFixed && v.maxDiscountAmount
                ? `Tối đa ${formatPrice(v.maxDiscountAmount)}`
                : null;

              return (
                <div
                  key={v.id}
                  className={`coupon-ticket-item ${v.isClaimed ? 'is-claimed' : ''}`}
                >
                  {/* Left Ticket Stamp */}
                  <div className={`coupon-ticket-left ${isFixed ? 'fixed-val' : 'pct-val'}`}>
                    <span className="coupon-tag">VOUCHER</span>
                    <strong className="coupon-value-big">{discountText}</strong>
                    <span className="coupon-type-badge">
                      {isFixed ? 'Giảm tiền' : 'Chiết khấu'}
                    </span>
                  </div>

                  {/* Cutout Divider */}
                  <div className="coupon-ticket-divider">
                    <span className="coupon-notch notch-top"></span>
                    <span className="coupon-dash-line"></span>
                    <span className="coupon-notch notch-bottom"></span>
                  </div>

                  {/* Right Ticket Info */}
                  <div className="coupon-ticket-right">
                    <div className="coupon-code-row">
                      <span className="coupon-code-pill">{v.code}</span>
                      {v.isClaimed && (
                        <span className="coupon-claimed-badge">
                          <i className="ti ti-check"></i> Đã có
                        </span>
                      )}
                    </div>

                    <div className="coupon-condition-info">
                      <span className="condition-main">{minOrderText}</span>
                      {maxCapText && <span className="condition-cap">{maxCapText}</span>}
                    </div>

                    <button
                      type="button"
                      id={`btn-claim-${v.code}`}
                      className={`btn-claim-voucher ${v.isClaimed ? 'is-claimed' : ''}`}
                      disabled={v.isClaimed || claimingId === v.id}
                      onClick={() => handleClaim(v)}
                    >
                      {claimingId === v.id ? (
                        <>
                          <i className="ti ti-loader animate-spin"></i>
                          <span>Đang lưu...</span>
                        </>
                      ) : v.isClaimed ? (
                        <>
                          <i className="ti ti-circle-check"></i>
                          <span>✓ Đã có trong ví</span>
                        </>
                      ) : (
                        <>
                          <i className="ti ti-wallet"></i>
                          <span>Lưu vào ví</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
      </div>
    </section>
  );
};

export default CouponRail;
