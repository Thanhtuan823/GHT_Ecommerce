import React, { useState, useEffect } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../common/ToastContext';
import './ExportExcelModal.css';

const AVAILABLE_SHEETS = [
  {
    id: 'revenue',
    name: 'Báo cáo Doanh thu & Đơn hàng',
    sheetName: 'Doanh thu',
    description: 'Chi tiết các đơn hàng thành công, tiền gốc, tiền giảm giá, phí vận chuyển và thực thu.',
    icon: 'ti ti-file-dollar',
    badge: 'Tài chính'
  },
  {
    id: 'discounts',
    name: 'Báo cáo Khuyến mãi & ROI',
    sheetName: 'Khuyến mãi',
    description: 'Thống kê hiệu quả voucher, tổng lượt dùng, chi phí giảm giá và tỷ suất ROI (Chuẩn 7 cột cứng).',
    icon: 'ti ti-ticket',
    badge: 'Chiến dịch'
  },
  {
    id: 'products',
    name: 'Báo cáo Hiệu suất sản phẩm',
    sheetName: 'Hiệu suất sản phẩm',
    description: 'Thống kê số lượng bán ra và tổng doanh thu đóng góp của từng sản phẩm trong kỳ.',
    icon: 'ti ti-chart-bar',
    badge: 'Sản phẩm'
  },
  {
    id: 'inventory',
    name: 'Báo cáo Tồn kho & Cảnh báo',
    sheetName: 'Tồn kho',
    description: 'Danh sách sản phẩm, mức tồn kho thực tế, số lượng đã bán và cảnh báo nguy cơ hết hàng.',
    icon: 'ti ti-packages',
    badge: 'Kho hàng'
  }
];

const ExportExcelModal = ({ isOpen, onClose, initialDateRange = { from: '', to: '' } }) => {
  const toast = useToast();
  const [fromDate, setFromDate] = useState(initialDateRange.from || '');
  const [toDate, setToDate] = useState(initialDateRange.to || '');
  const [activePreset, setActivePreset] = useState('CUSTOM');
  const [selectedSheets, setSelectedSheets] = useState(['revenue', 'discounts', 'products', 'inventory']);
  const [isExporting, setIsExporting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const formatDateYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Sync initial dates when modal opens
  useEffect(() => {
    if (isOpen) {
      setFromDate(initialDateRange.from || '');
      setToDate(initialDateRange.to || '');
      setValidationError('');
      if (!initialDateRange.from && !initialDateRange.to) {
        setActivePreset('ALL');
      } else {
        setActivePreset('CUSTOM');
      }
    }
  }, [isOpen, initialDateRange.from, initialDateRange.to]);

  if (!isOpen) return null;

  // Preset handlers
  const handleApplyPreset = (presetKey) => {
    setActivePreset(presetKey);
    setValidationError('');
    const now = new Date();
    const todayStr = formatDateYMD(now);

    switch (presetKey) {
      case 'ALL':
        setFromDate('');
        setToDate('');
        break;
      case 'TODAY':
        setFromDate(todayStr);
        setToDate(todayStr);
        break;
      case '7DAYS': {
        const past7 = new Date();
        past7.setDate(now.getDate() - 7);
        setFromDate(formatDateYMD(past7));
        setToDate(todayStr);
        break;
      }
      case '30DAYS': {
        const past30 = new Date();
        past30.setDate(now.getDate() - 30);
        setFromDate(formatDateYMD(past30));
        setToDate(todayStr);
        break;
      }
      case 'MONTH': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        setFromDate(formatDateYMD(startOfMonth));
        setToDate(todayStr);
        break;
      }
      default:
        break;
    }
  };

  // Toggle sheet selection
  const handleToggleSheet = (sheetId) => {
    setValidationError('');
    setSelectedSheets((prev) =>
      prev.includes(sheetId) ? prev.filter((id) => id !== sheetId) : [...prev, sheetId]
    );
  };

  const handleSelectAllSheets = () => {
    setValidationError('');
    setSelectedSheets(AVAILABLE_SHEETS.map((s) => s.id));
  };

  const handleDeselectAllSheets = () => {
    setSelectedSheets([]);
  };

  // Compute preview filename
  const previewFileName = `GHT_Revenue_${fromDate || 'All'}_${toDate || 'All'}.xlsx`;

  // Submit export
  const handleExport = async (e) => {
    e.preventDefault();

    if (selectedSheets.length === 0) {
      setValidationError('Vui lòng chọn ít nhất 1 mục báo cáo (sheet) để xuất file.');
      return;
    }

    if (fromDate && toDate && fromDate > toDate) {
      setValidationError('Ngày bắt đầu không được lớn hơn ngày kết thúc.');
      return;
    }

    setValidationError('');
    setIsExporting(true);

    try {
      const params = new URLSearchParams();
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      params.append('sheets', selectedSheets.join(','));

      const res = await axiosClient.get(`/admin/export-excel?${params.toString()}`, {
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = previewFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      if (toast?.success) {
        toast.success(`Đã xuất báo cáo Excel thành công: ${previewFileName}`);
      }
      onClose();
    } catch (err) {
      console.error('Export Excel error:', err);
      const message = err?.response?.status === 403
        ? 'Chỉ tài khoản Quản trị viên (Admin) mới có quyền xuất báo cáo tài chính.'
        : 'Có lỗi xảy ra khi tạo file Excel. Vui lòng thử lại sau.';
      setValidationError(message);
      if (toast?.error) {
        toast.error(message);
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-modal-backdrop" onClick={onClose}>
      <div className="export-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="export-modal-header">
          <div className="export-header-title-box">
            <div className="export-header-icon">
              <i className="ti ti-file-spreadsheet"></i>
            </div>
            <div>
              <h2 className="export-modal-title">Tùy chọn xuất file Excel</h2>
              <p className="export-modal-subtitle">
                Lọc khoảng thời gian và chọn các sheet báo cáo thống kê cần trích xuất
              </p>
            </div>
          </div>
          <button
            type="button"
            className="export-modal-close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleExport} className="export-modal-body">
          {/* Section 1: Thời gian */}
          <div className="export-section">
            <div className="export-section-header">
              <label className="export-section-title">
                <i className="ti ti-calendar-event"></i> Khoảng thời gian báo cáo
              </label>
              <span className="export-section-hint">Tự động lọc đơn hàng & dữ liệu theo kỳ</span>
            </div>

            {/* Presets */}
            <div className="export-presets-row">
              <button
                type="button"
                className={`export-preset-chip ${activePreset === 'ALL' ? 'active' : ''}`}
                onClick={() => handleApplyPreset('ALL')}
              >
                Tất cả thời gian
              </button>
              <button
                type="button"
                className={`export-preset-chip ${activePreset === 'TODAY' ? 'active' : ''}`}
                onClick={() => handleApplyPreset('TODAY')}
              >
                Hôm nay
              </button>
              <button
                type="button"
                className={`export-preset-chip ${activePreset === '7DAYS' ? 'active' : ''}`}
                onClick={() => handleApplyPreset('7DAYS')}
              >
                7 ngày qua
              </button>
              <button
                type="button"
                className={`export-preset-chip ${activePreset === '30DAYS' ? 'active' : ''}`}
                onClick={() => handleApplyPreset('30DAYS')}
              >
                30 ngày qua
              </button>
              <button
                type="button"
                className={`export-preset-chip ${activePreset === 'MONTH' ? 'active' : ''}`}
                onClick={() => handleApplyPreset('MONTH')}
              >
                Tháng này
              </button>
            </div>

            {/* Date Inputs */}
            <div className="export-date-inputs-row">
              <div className="export-date-group">
                <span className="export-date-label">Từ ngày (fromDate)</span>
                <input
                  type="date"
                  className="export-date-input"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setActivePreset('CUSTOM');
                    setValidationError('');
                  }}
                />
              </div>

              <div className="export-date-separator">
                <i className="ti ti-arrow-right"></i>
              </div>

              <div className="export-date-group">
                <span className="export-date-label">Đến ngày (toDate)</span>
                <input
                  type="date"
                  className="export-date-input"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setActivePreset('CUSTOM');
                    setValidationError('');
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 2: Chọn mục báo cáo / Sheet */}
          <div className="export-section">
            <div className="export-section-header">
              <label className="export-section-title">
                <i className="ti ti-layers-subtract"></i> Chọn các mục báo cáo (Worksheet)
              </label>
              <div className="export-sheets-toggle-actions">
                <button
                  type="button"
                  className="export-toggle-link"
                  onClick={handleSelectAllSheets}
                >
                  Chọn tất cả ({AVAILABLE_SHEETS.length})
                </button>
                <span className="export-toggle-dot">•</span>
                <button
                  type="button"
                  className="export-toggle-link"
                  onClick={handleDeselectAllSheets}
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="export-sheets-grid">
              {AVAILABLE_SHEETS.map((sheet) => {
                const isSelected = selectedSheets.includes(sheet.id);
                return (
                  <div
                    key={sheet.id}
                    className={`export-sheet-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleSheet(sheet.id)}
                  >
                    <div className="export-sheet-card-top">
                      <div className="export-checkbox-custom">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSheet(sheet.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="export-checkbox-box">
                          {isSelected && <i className="ti ti-check"></i>}
                        </span>
                      </div>
                      <div className="export-sheet-icon-wrap">
                        <i className={sheet.icon}></i>
                      </div>
                      <span className="export-sheet-badge">{sheet.badge}</span>
                    </div>

                    <div className="export-sheet-info">
                      <h4 className="export-sheet-name">{sheet.name}</h4>
                      <div className="export-sheet-subtag">
                        Tên Sheet: <code>{sheet.sheetName}</code>
                      </div>
                      <p className="export-sheet-desc">{sheet.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview Filename Box */}
          <div className="export-filename-preview-box">
            <div className="export-preview-header">
              <i className="ti ti-info-circle"></i>
              <span>Quy cách đặt tên file tải về (Chuẩn hệ thống):</span>
            </div>
            <div className="export-preview-code">
              <code>{previewFileName}</code>
            </div>
          </div>

          {/* Error display */}
          {validationError && (
            <div className="export-validation-alert">
              <i className="ti ti-alert-triangle"></i>
              <span>{validationError}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="export-modal-footer">
            <button
              type="button"
              className="export-btn-cancel"
              onClick={onClose}
              disabled={isExporting}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="export-btn-submit"
              disabled={isExporting || selectedSheets.length === 0}
            >
              {isExporting ? (
                <>
                  <span className="export-btn-spinner"></span>
                  <span>Đang tổng hợp dữ liệu...</span>
                </>
              ) : (
                <>
                  <i className="ti ti-download"></i>
                  <span>Tải file Excel ({selectedSheets.length} sheet)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExportExcelModal;
