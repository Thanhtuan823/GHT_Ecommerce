export const getOrderStatus = (status) => {
  const map = {
    'PENDING_PAYMENT': { label: 'Chờ thanh toán', className: 'status-pending' },
    'PENDING_REVIEW': { label: 'Chờ xác nhận TT', className: 'status-review' },
    'PAID': { label: 'Đã thanh toán', className: 'status-done' },
    'CONFIRMED': { label: 'Đã xác nhận', className: 'status-wait' },
    'PROCESSING': { label: 'Đang xử lý', className: 'status-info' },
    'SHIPPING': { label: 'Đang giao', className: 'status-ship' },
    'DELIVERED': { label: 'Hoàn thành', className: 'status-done' },
    'COMPLETED': { label: 'Hoàn thành', className: 'status-done' },
    'CANCELLED': { label: 'Đã huỷ', className: 'status-cancel' },
    'PAYMENT_FAILED': { label: 'Thanh toán thất bại', className: 'status-cancel' },
    'EXPIRED': { label: 'Hết hạn', className: 'status-pending' }
  };
  return map[status] || { label: status, className: 'status-pending' };
};
