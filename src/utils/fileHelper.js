export const isImageFile = (fileNameOrUrl) => {
  if (!fileNameOrUrl) return false;
  const cleanUrl = fileNameOrUrl.split('?')[0].split('#')[0];
  return /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(cleanUrl);
};

export const getFileNameFromUrl = (urlOrKey) => {
  if (!urlOrKey) return 'Tệp đính kèm';
  const cleanStr = decodeURIComponent(urlOrKey.split('?')[0].split('#')[0]);
  const rawName = cleanStr.split('/').pop() || '';

  // Khớp quy chuẩn: 1001-loithanhtoan(2).png -> loithanhtoan(2).png
  const userFileMatch = rawName.match(/^\d{4}-(.+)$/);
  if (userFileMatch) return userFileMatch[1];

  // Khớp GUID cũ dạng {GUID}_{Tên_gốc}.ext
  const guidMatch = rawName.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_(.+)$/i);
  if (guidMatch) return guidMatch[1];

  // Khớp tiền tố hex ngắn {8_char}_{Tên_gốc}.ext
  const shortHexMatch = rawName.match(/^[a-f0-9]{8}_(.+)$/i);
  if (shortHexMatch) return shortHexMatch[1];

  // Tương thích ngược với file cũ chỉ có GUID
  const pureGuidMatch = rawName.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(\.[a-z0-9]+)$/i);
  if (pureGuidMatch) return `Tài liệu đính kèm (${pureGuidMatch[1].toUpperCase()})`;

  return rawName;
};
