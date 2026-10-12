export const getDiscountStatus = (discount) => {
    if (!discount.isActive) {
        return { label: 'Đã tắt', className: 'status-disabled' };
    }
    if (discount.usageLimit > 0 && discount.usedCount >= discount.usageLimit) {
        return { label: 'Hết lượt', className: 'status-out' };
    }
    const exp = discount.endDate || discount.expiryDate;
    if (exp && new Date(exp) < new Date()) {
        return { label: 'Hết hạn', className: 'status-expired', key: 'EXPIRED' };
    }
    return { label: 'Đang chạy', className: 'status-active', key: 'ACTIVE' };
};
