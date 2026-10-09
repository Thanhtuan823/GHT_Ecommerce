export const calculateROI = (originalAmount, discountAmount) => {
    if (!discountAmount || discountAmount === 0) return "N/A";
    const roi = originalAmount / discountAmount;
    return `${roi.toFixed(1)}x`;
};
