import { useState, useEffect } from 'react';
import './CancelOrderModal.css';

const PREDEFINED_REASONS = [
  'Muốn thay đổi địa chỉ nhận hàng',
  'Muốn thay đổi sản phẩm trong đơn (màu sắc, cấu hình, số lượng...)',
  'Thủ tục thanh toán / chuyển khoản quá phức tạp',
  'Tìm thấy sản phẩm giá tốt hơn ở nơi khác',
  'Thời gian giao hàng dự kiến quá lâu',
  'Đổi ý, không còn nhu cầu mua nữa',
  'Lý do khác...'
];

const CancelOrderModal = ({ isOpen, order, onConfirm, onCancel, isSubmitting = false }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedReason('');
      setCustomReason('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onCancel();
      }
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, isSubmitting]);

  if (!isOpen || !order) return null;

  const isOtherSelected = selectedReason === 'Lý do khác...';
  const isFormValid =
    selectedReason &&
    (!isOtherSelected || (customReason.trim().length >= 5));

  const handleConfirm = () => {
    if (!isFormValid || isSubmitting) return;
    const finalReason = isOtherSelected ? customReason.trim() : selectedReason;
    onConfirm(finalReason);
  };

  return (
    <div className="cancel-modal-backdrop" onClick={!isSubmitting ? onCancel : undefined} role="dialog" aria-modal="true">
      <div className="cancel-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cancel-modal-header">
          <div className="cancel-modal-title-group">
            <div className="cancel-modal-icon-badge">
              <i className="ti ti-alert-triangle"></i>
            </div>
            <div>
              <h3 className="cancel-modal-title">Hủy đơn hàng #GHT{order.id}</h3>
              <p className="cancel-modal-subtitle">
                Vui lòng chọn lý do để chúng tôi cải thiện chất lượng phục vụ
              </p>
            </div>
          </div>
          <button
            type="button"
            className="cancel-modal-close-btn"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Đóng"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>

        {/* Notice */}
        <div className="cancel-modal-notice">
          <i className="ti ti-info-circle"></i>
          <span>
            Sau khi hủy, toàn bộ số lượng sản phẩm sẽ được tự động hoàn lại vào kho và mã giảm giá (nếu có) sẽ được khôi phục.
          </span>
        </div>

        {/* Reasons list */}
        <div className="cancel-reasons-list">
          {PREDEFINED_REASONS.map((reason, index) => {
            const isChecked = selectedReason === reason;
            return (
              <label
                key={index}
                className={`cancel-reason-item ${isChecked ? 'is-selected' : ''}`}
              >
                <input
                  type="radio"
                  name="cancelReason"
                  className="cancel-radio-input"
                  checked={isChecked}
                  onChange={() => setSelectedReason(reason)}
                  disabled={isSubmitting}
                />
                <span className="cancel-reason-text">{reason}</span>
              </label>
            );
          })}
        </div>

        {/* Custom reason textarea (shown when "Lý do khác..." is selected) */}
        {isOtherSelected && (
          <div className="cancel-custom-input-group">
            <label className="cancel-custom-label">
              Nhập lý do chi tiết của bạn <span className="cancel-required">*</span>
            </label>
            <textarea
              className="cancel-custom-textarea"
              rows="3"
              placeholder="Vui lòng nhập tối thiểu 5 ký tự để giải thích lý do hủy..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              disabled={isSubmitting}
              maxLength={300}
            />
            <div className="cancel-custom-char-count">
              {customReason.trim().length < 5 && (
                <span className="cancel-custom-warn">Tối thiểu 5 ký tự</span>
              )}
              <span className="char-counter">{customReason.length}/300</span>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="cancel-modal-footer">
          <button
            type="button"
            className="btn-ghost"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Hủy bỏ
          </button>
          <button
            type="button"
            className="btn-danger-confirm"
            onClick={handleConfirm}
            disabled={!isFormValid || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <i className="ti ti-loader animate-spin"></i> Đang hủy đơn...
              </>
            ) : (
              'Xác nhận hủy đơn'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;
