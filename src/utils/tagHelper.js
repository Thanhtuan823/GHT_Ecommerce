export const PRODUCT_TAGS = [
  { id: 'gaming', label: 'Gaming', color: '#DC2626' },
  { id: 'do-hoa-ky-thuat', label: 'Đồ họa - Kỹ thuật', color: '#7C3AED' },
  { id: 'van-phong', label: 'Văn phòng', color: '#2563EB' },
  { id: 'mong-nhe-cao-cap', label: 'Mỏng nhẹ cao cấp', color: '#059669' },
  { id: 'sinh-vien', label: 'Học sinh - Sinh viên', color: '#D97706' },
  { id: 'apple-silicon', label: 'Apple Silicon', color: '#1F2937' },
  { id: '2-in-1', label: 'Cảm ứng / 2-in-1', color: '#0891B2' }
];

export const getTagLabel = (tagId) => {
  if (!tagId) return '';
  const found = PRODUCT_TAGS.find((t) => t.id === tagId.toLowerCase().trim());
  return found ? found.label : tagId;
};

export const getTagColor = (tagId) => {
  if (!tagId) return '#64748B';
  const found = PRODUCT_TAGS.find((t) => t.id === tagId.toLowerCase().trim());
  return found ? found.color : '#64748B';
};

