export const isImageFile = (fileNameOrUrl) => {
  if (!fileNameOrUrl) return false;
  const cleanUrl = fileNameOrUrl.split('?')[0].split('#')[0];
  return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanUrl);
};

export const getFileNameFromUrl = (url) => {
  if (!url) return 'Tệp đính kèm';
  const rawName = decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || '');
  
  // File mới dạng {GUID}_{Tên_gốc}.ext
  const guidPrefixMatch = rawName.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_(.+)$/i);
  if (guidPrefixMatch) return guidPrefixMatch[1];

  // File dạng tiền tố hex ngắn {8_char}_{Tên_gốc}.ext
  const shortHexMatch = rawName.match(/^[a-f0-9]{8}_(.+)$/i);
  if (shortHexMatch) return shortHexMatch[1];

  // Tương thích ngược với file cũ chỉ có GUID
  const pureGuidMatch = rawName.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.[a-z0-9]+)$/i);
  if (pureGuidMatch) return `Tài liệu đính kèm (${pureGuidMatch[1].toUpperCase()})`;

  return rawName;
};
