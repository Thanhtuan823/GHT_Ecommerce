import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './PaymentQrModal.css';

const BANK_INFO = {
  bankName: 'MB',
  bankFullName: 'Ngân hàng Quân Đội (MB Bank)',
  accountNumber: '0123456789',
  accountName: 'GHT ECOM'
};

const PaymentQrModal = ({ order, onClose }) => {
  const navigate = useNavigate();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessPaid, setIsSuccessPaid] = useState(false);
  const [timeLeft, setTimeLeft] = useState(() => {
    if (!order?.paymentExpiredAt) return 15 * 60; // 15 mins default
    const diff = Math.floor((new Date(order.paymentExpiredAt).getTime() - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  });

  const isExpired = timeLeft <= 0;

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0 || isSuccessPaid) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSuccessPaid]);

  // Polling order status every 2.5s to detect PAID (Webhook / TestMode / Staff review)
  useEffect(() => {
    if (!order?.id || isSuccessPaid || isExpired) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await axiosClient.get(`/orders/${order.id}`);
        if (res.data?.status === 'PAID') {
          clearInterval(pollInterval);
          setIsSuccessPaid(true);
          toast.success('Thanh toán thành công! Hệ thống đã ghi nhận đơn hàng.');
          setTimeout(() => {
            if (onClose) onClose();
            navigate(`/orders/${order.id}`);
          }, 1500);
        }
      } catch (err) {
        // Silently catch polling errors to avoid disruption
      }
    }, 2500);

    return () => clearInterval(pollInterval);
  }, [order?.id, isSuccessPaid, isExpired, navigate, onClose, toast]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const transferContent = `DH${order?.id || ''}`;
  const amount = order?.totalPrice || 0;
  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val)}đ`;

  // VietQR URL
  const qrUrl = `https://img.vietqr.io/image/${BANK_INFO.bankName}-${BANK_INFO.accountNumber}-compact2.jpg?amount=${amount}&addInfo=${transferContent}&accountName=${encodeURIComponent(BANK_INFO.accountName)}`;

  const handleCopy = (text, label) => {
    navigator.clipboard?.writeText(text);
    toast.success(`Đã sao chép ${label}: ${text}`);
  };

  const handleConfirmPaid = async () => {
    setIsSubmitting(true);
    try {
      // Calls PUT /api/orders/:id/payment-confirm
      const res = await axiosClient.put(`/orders/${order.id}/payment-confirm`);
      if (res.data?.status === 'PAID') {
        setIsSuccessPaid(true);
        toast.success(res.data?.message || 'Thanh toán thành công (Test Mode)!');
        setTimeout(() => {
          if (onClose) onClose();
          navigate(`/orders/${order.id}`);
        }, 1500);
      } else {
        toast.success('Đã gửi xác nhận thanh toán! Đơn hàng đang được kiểm tra đối soát.');
        if (onClose) onClose();
        navigate(`/orders/${order.id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi khi gửi xác nhận thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLater = () => {
    if (onClose) onClose();
    navigate(`/orders/${order.id}`);
  };

  const handleReorder = () => {
    if (onClose) onClose();
    navigate('/cart');
  };

  return (
    <div className="payment-qr-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="payment-qr-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="payment-qr-modal-header">
          <h2 className="payment-qr-modal-title">
            Thanh toán đơn #GHT{order?.id}
          </h2>
          <button
            type="button"
            className="payment-qr-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Row 1: Status Badge & Countdown */}
        <div className="payment-qr-status-row">
          <span className={`payment-qr-badge-status ${isSuccessPaid ? 'is-paid' : isExpired ? 'is-expired' : ''}`}>
            {isSuccessPaid ? 'Đã thanh toán' : isExpired ? 'Hết hạn thanh toán' : 'Chờ thanh toán'}
          </span>

          {isSuccessPaid ? (
            <span className="payment-qr-countdown is-paid">
              ✓ Hoàn tất
            </span>
          ) : !isExpired ? (
            <span className="payment-qr-countdown">
              🕐 Còn {timeFormatted}
            </span>
          ) : (
            <span className="payment-qr-countdown is-expired">
              Đơn hàng đã hết hạn
            </span>
          )}
        </div>

        {/* Success Notification when order is PAID */}
        {isSuccessPaid ? (
          <div className="payment-qr-success-box">
            <div className="payment-qr-success-icon">✓</div>
            <h3 className="payment-qr-success-title">Thanh toán thành công!</h3>
            <p className="payment-qr-success-desc">
              Hệ thống đã xác nhận thanh toán cho đơn hàng #GHT{order?.id}. Đang chuyển tiếp đến chi tiết đơn hàng...
            </p>
          </div>
        ) : isExpired ? (
          <div className="payment-qr-expired-box">
            <h3 className="payment-qr-expired-title">Đơn hàng đã hết hạn thanh toán</h3>
            <p className="payment-qr-expired-desc">
              Thời gian giữ chỗ thanh toán 15 phút đã kết thúc. Vui lòng đặt lại đơn hàng mới để tiếp tục.
            </p>
            <div className="payment-qr-expired-actions">
              <button type="button" className="btn-primary btn-sm" onClick={handleReorder}>
                Đặt lại đơn hàng
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={onClose}>
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 2-Column Body: QR Left + Info Right */}
            <div className="payment-qr-body-2col">
              {/* QR Image Column */}
              <div className="payment-qr-image-column">
                <img
                  src={qrUrl}
                  alt="VietQR Payment Code"
                  className="payment-qr-code-img"
                />
                <p className="payment-qr-code-caption">
                  Quét mã bằng app ngân hàng hoặc ví điện tử bất kỳ
                </p>
              </div>

              {/* Info Column */}
              <div className="payment-qr-info-column">
                <p className="payment-qr-amount-label">Số tiền cần thanh toán</p>
                <div className="payment-qr-amount-val">{formatPrice(amount)}</div>
                <p className="payment-qr-instructions">
                  Quét mã QR bằng ứng dụng ngân hàng bất kỳ để thanh toán nhanh nhất và chính xác nhất.
                </p>
                <div className="payment-qr-method-badge">
                  <span>🏦</span>
                  <span>MB Bank • QR Nhanh 24/7</span>
                </div>
              </div>
            </div>

            {/* Bank Info Rows */}
            <div className="payment-qr-bank-rows">
              <div className="payment-bank-row-item">
                <span className="payment-bank-row-label">Ngân hàng</span>
                <span className="payment-bank-row-val-group">
                  {BANK_INFO.bankFullName}
                </span>
              </div>

              <div className="payment-bank-row-item">
                <span className="payment-bank-row-label">Chủ tài khoản</span>
                <span className="payment-bank-row-val-group">
                  {BANK_INFO.accountName}
                </span>
              </div>

              <div className="payment-bank-row-item">
                <span className="payment-bank-row-label">Số tài khoản</span>
                <div className="payment-bank-row-val-group">
                  <span>{BANK_INFO.accountNumber}</span>
                  <button
                    type="button"
                    className="payment-copy-btn"
                    onClick={() => handleCopy(BANK_INFO.accountNumber, 'Số tài khoản')}
                  >
                    Sao chép
                  </button>
                </div>
              </div>

              <div className="payment-bank-row-item">
                <span className="payment-bank-row-label">Nội dung chuyển khoản</span>
                <div className="payment-bank-row-val-group is-accent">
                  <span>{transferContent}</span>
                  <button
                    type="button"
                    className="payment-copy-btn"
                    onClick={() => handleCopy(transferContent, 'Nội dung chuyển khoản')}
                  >
                    Sao chép
                  </button>
                </div>
              </div>
            </div>

            {/* Warning Box */}
            <div className="payment-qr-warning-box">
              <span className="payment-warning-title">Chờ xác nhận TT</span>
              <p className="payment-warning-content">
                Sau khi chuyển khoản, hệ thống sẽ tự động đối soát trong 1–3 phút. Bạn cũng có thể bấm nút &quot;Tôi đã chuyển khoản&quot; để thông báo cho nhân viên kiểm tra.
              </p>
            </div>

            {/* Hint Line */}
            <p className="payment-qr-hint-line">
              Vui lòng chuyển đúng số tiền và nội dung đơn hàng để giao dịch được xử lý nhanh nhất.
            </p>

            {/* Footer Action Buttons */}
            <div className="payment-qr-footer-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={handleLater}
              >
                Để sau
              </button>

              <button
                type="button"
                className="btn-primary payment-btn-confirm"
                onClick={handleConfirmPaid}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ButtonSpinner /> Đang xử lý...
                  </>
                ) : (
                  'Tôi đã chuyển khoản'
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentQrModal;
