export const getDiscountStatus = (discount) => {
    if (!discount.isActive) {
        return { label: 'Đã tắt', className: 'status-disabled' };
    }
    if (discount.usageLimit > 0 && discount.usedCount >= discount.usageLimit) {
        return { label: 'Hết lượt', className: 'status-out' };
    }
    if (discount.expiryDate && new Date(discount.expiryDate) < new Date()) {
        return { label: 'Hết hạn', className: 'status-expired' };
    }
    return { label: 'Đang chạy', className: 'status-active' };
};
