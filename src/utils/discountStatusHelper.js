export const getDiscountStatus = (discount) => {
  if (!discount.isActive) {
    return { label: 'Đã tắt', className: 'status-cancel' };
  }
  
  if (discount.usageLimit !== null && discount.usedCount >= discount.usageLimit) {
    return { label: 'Hết lượt', className: 'status-wait' };
  }
  
  const now = new Date();
  const startDate = new Date(discount.startDate);
  const endDate = new Date(discount.endDate);
  
  if (now > endDate) {
    return { label: 'Hết hạn', className: 'status-pending' };
  }
  
  if (now >= startDate && now <= endDate) {
    return { label: 'Đang chạy', className: 'badge-new' };
  }
  
  return { label: 'Chờ chạy', className: 'status-pending' };
};
