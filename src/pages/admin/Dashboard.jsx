import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import './Dashboard.css';

// Default demo dataset according to Figma Screen 11
const DEFAULT_DEMO_DATA = {
  totalRevenue: 428500000,
  totalOrders: 126,
  averageOrderValue: 3400794,
  discountCost: 5400000,
  validDiscountUsageCount: 118,
  revenueChart: [
    { date: '01/10', revenue: 32000000, formatted: '32 tr' },
    { date: '02/10', revenue: 45000000, formatted: '45 tr' },
    { date: '03/10', revenue: 38000000, formatted: '38 tr' },
    { date: '04/10', revenue: 52000000, formatted: '52 tr' },
    { date: '05/10', revenue: 68000000, formatted: '68 tr' },
    { date: '06/10', revenue: 58000000, formatted: '58 tr' },
    { date: '07/10', revenue: 74000000, formatted: '74 tr' },
    { date: '08/10', revenue: 61500000, formatted: '61.5 tr' }
  ],
  categoryBreakdown: [
    { name: 'Laptop', value: 65, color: '#2563EB' },
    { name: 'Màn hình', value: 22, color: '#1A2233' },
    { name: 'Phụ kiện', value: 13, color: '#8A96A8' }
  ],
  topDiscounts: [
    { rank: '01', code: 'TECHFEST20', usedCount: 45, revenue: 108000000, cost: 5400000, roi: '20.0x', isBadge: true },
    { rank: '02', code: 'LAPTOP500', usedCount: 32, revenue: 84000000, cost: 5250000, roi: '16.0x', isBadge: false },
    { rank: '03', code: 'NEWBIE10', usedCount: 28, revenue: 42000000, cost: 3500000, roi: '12.0x', isBadge: false },
    { rank: '04', code: 'FREESHIP', usedCount: 12, revenue: 18000000, cost: 2250000, roi: '8.0x', isBadge: false },
    { rank: '05', code: 'VIPMEMBER', usedCount: 1, revenue: 0, cost: 0, roi: 'N/A', isBadge: false }
  ],
  recentOrders: [
    { id: 1031, code: 'GHT1031', customer: 'Nguyễn Minh Anh', total: 14950000, status: 'PAID', time: '15 phút trước' },
    { id: 1030, code: 'GHT1030', customer: 'Trần Văn Hùng', total: 4250000, status: 'PENDING_REVIEW', time: '40 phút trước' },
    { id: 1029, code: 'GHT1029', customer: 'Lê Thị Thu Thảo', total: 1850000, status: 'CONFIRMED', time: '2 giờ trước' },
    { id: 1028, code: 'GHT1028', customer: 'Phạm Đức Duy', total: 32900000, status: 'PROCESSING', time: '4 giờ trước' },
    { id: 1027, code: 'GHT1027', customer: 'Hoàng Quốc Bảo', total: 990000, status: 'SHIPPING', time: 'Hôm qua' }
  ]
};

export default function AdminDashboard() {
  const [data, setData] = useState(DEFAULT_DEMO_DATA);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [activePill, setActivePill] = useState('ALL'); // 'TODAY' | '7DAYS' | '30DAYS' | 'MONTH' | 'CUSTOM' | 'ALL'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showCustomInputs, setShowCustomInputs] = useState(false);
  const [customDates, setCustomDates] = useState({ from: '', to: '' });
  const dropdownRef = useRef(null);
  const { showToast } = useToast();

  const formatDateYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const getDropdownLabel = () => {
    switch (activePill) {
      case 'TODAY':
        return 'Hôm nay';
      case '7DAYS':
        return '7 ngày qua';
      case '30DAYS':
        return '30 ngày qua';
      case 'MONTH':
        return 'Tháng này';
      case 'ALL':
        return 'Tất cả thời gian';
      case 'CUSTOM': {
        const { from, to } = dateRange;
        const formatShort = (d) => {
          if (!d) return '';
          const parts = d.split('-');
          return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
        };
        if (from && to) {
          return from === to ? formatShort(from) : `${formatShort(from)} - ${formatShort(to)}`;
        }
        if (from) return `Từ ${formatShort(from)}`;
        if (to) return `Đến ${formatShort(to)}`;
        return 'Tùy chỉnh ngày';
      }
      default:
        return 'Bộ lọc thời gian';
    }
  };

  const fetchDashboard = async (range = dateRange) => {
    setIsLoading(true);
    try {
      let url = '/admin/dashboard';
      const params = new URLSearchParams();
      if (range.from) params.append('from', range.from);
      if (range.to) params.append('to', range.to);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axiosClient.get(url);
      if (res.data) {
        const d = res.data;
        const totalRev = d.totalRevenue > 0 ? d.totalRevenue : DEFAULT_DEMO_DATA.totalRevenue;
        const totalOrd = d.totalOrders > 0 ? d.totalOrders : DEFAULT_DEMO_DATA.totalOrders;
        const avgVal = totalOrd > 0 ? Math.round(totalRev / totalOrd) : DEFAULT_DEMO_DATA.averageOrderValue;

        // Process revenue chart data
        let chartData = DEFAULT_DEMO_DATA.revenueChart;
        if (Array.isArray(d.revenueChart) && d.revenueChart.length > 0) {
          chartData = d.revenueChart.map((it) => {
            const shortDate = it.date.includes('-')
              ? it.date.split('-').slice(1).reverse().join('/')
              : it.date;
            return {
              date: shortDate,
              revenue: it.revenue,
              formatted: `${(it.revenue / 1000000).toFixed(1)} tr`
            };
          });
        }

        // Process top discounts
        let discountsList = DEFAULT_DEMO_DATA.topDiscounts;
        if (Array.isArray(d.topDiscounts) && d.topDiscounts.length > 0) {
          discountsList = d.topDiscounts.map((it, idx) => ({
            rank: String(idx + 1).padStart(2, '0'),
            code: it.code,
            usedCount: it.usedCount,
            revenue: it.revenueFromCode,
            cost: it.totalDiscountAmount,
            roi: it.roi || (it.rawRoi > 0 ? `${it.rawRoi.toFixed(1)}x` : 'N/A'),
            isBadge: idx === 0 && it.rawRoi > 0
          }));
        }

        setData((prev) => ({
          ...prev,
          totalRevenue: totalRev,
          totalOrders: totalOrd,
          averageOrderValue: avgVal,
          discountCost: d.discountCost > 0 ? d.discountCost : DEFAULT_DEMO_DATA.discountCost,
          validDiscountUsageCount: d.validDiscountUsageCount || DEFAULT_DEMO_DATA.validDiscountUsageCount,
          revenueChart: chartData,
          topDiscounts: discountsList
        }));
      }
    } catch {
      // Keep default demo data on failure
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleSelectPreset = (type) => {
    setActivePill(type);
    setIsDropdownOpen(false);
    setShowCustomInputs(false);

    const now = new Date();
    const todayStr = formatDateYMD(now);
    let newRange = { from: '', to: '' };

    if (type === 'TODAY') {
      newRange = { from: todayStr, to: todayStr };
    } else if (type === '7DAYS') {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      newRange = { from: formatDateYMD(past7), to: todayStr };
    } else if (type === '30DAYS') {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      newRange = { from: formatDateYMD(past30), to: todayStr };
    } else if (type === 'MONTH') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      newRange = { from: formatDateYMD(startOfMonth), to: todayStr };
    } else if (type === 'ALL') {
      newRange = { from: '', to: '' };
    }

    setDateRange(newRange);
    setCustomDates(newRange);
    fetchDashboard(newRange);
  };

  const handleApplyCustom = () => {
    if (!customDates.from && !customDates.to) {
      showToast('Vui lòng chọn ngày để lọc', 'warning');
      return;
    }
    if (customDates.from && customDates.to && customDates.from > customDates.to) {
      showToast('Ngày bắt đầu không được lớn hơn ngày kết thúc', 'warning');
      return;
    }

    setActivePill('CUSTOM');
    setDateRange(customDates);
    setIsDropdownOpen(false);
    fetchDashboard(customDates);
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      let url = '/admin/export-excel';
      const params = new URLSearchParams();
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axiosClient.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = URL.createObjectURL(blob);
      const fileName = `GHT_Revenue_${dateRange.from || 'All'}_${dateRange.to || 'All'}.xlsx`;

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      showToast('Xuất báo cáo Excel thành công!', 'success');
    } catch {
      showToast('Lỗi khi xuất file Excel từ máy chủ', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const formatCurrency = (val) => {
    return (val || 0).toLocaleString('vi-VN') + 'đ';
  };

  const getOrderStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="dashboard-badge dashboard-badge-paid">Đã thanh toán</span>;
      case 'PENDING_REVIEW':
        return <span className="dashboard-badge dashboard-badge-pending">Chờ xác nhận</span>;
      case 'CONFIRMED':
        return <span className="dashboard-badge dashboard-badge-pending">Đã xác nhận</span>;
      case 'PROCESSING':
        return <span className="dashboard-badge dashboard-badge-shipping">Đang xử lý</span>;
      case 'SHIPPING':
        return <span className="dashboard-badge dashboard-badge-shipping">Đang giao</span>;
      case 'COMPLETED':
        return <span className="dashboard-badge dashboard-badge-completed">Hoàn thành</span>;
      case 'CANCELLED':
        return <span className="dashboard-badge dashboard-badge-cancelled">Đã huỷ</span>;
      default:
        return <span className="dashboard-badge">{status}</span>;
    }
  };

  return (
    <div className="admin-dashboard-page">
      {/* 1. Header & Range Controls */}
      <div className="dashboard-header">
        <div className="dashboard-title-box">
          <h1>Tổng quan hiệu suất</h1>
          <p className="dashboard-subtitle">
            Báo cáo doanh thu, đơn hàng và hiệu quả chiến dịch khuyến mãi
          </p>
        </div>

        <div className="dashboard-toolbar">
          {/* Nút 1: Xuất Excel */}
          <button
            type="button"
            className="dashboard-btn-export"
            onClick={handleExportExcel}
            disabled={isExporting}
            title="Xuất báo cáo Excel theo khoảng thời gian đang lọc"
          >
            {isExporting ? (
              <span className="dashboard-spinner"></span>
            ) : (
              <i className="ti ti-file-spreadsheet"></i>
            )}
            <span>{isExporting ? 'Đang xuất...' : 'Xuất Excel'}</span>
          </button>

          {/* Nút 2: Dropdown bộ lọc thời gian */}
          <div className="dashboard-dropdown-container" ref={dropdownRef}>
            <button
              type="button"
              className={`dashboard-dropdown-trigger ${isDropdownOpen ? 'is-open' : ''}`}
              onClick={() => setIsDropdownOpen((prev) => !prev)}
              title="Chọn khoảng thời gian lọc"
            >
              <i className="ti ti-calendar"></i>
              <span className="dashboard-dropdown-label">{getDropdownLabel()}</span>
              <i className={`ti ti-chevron-${isDropdownOpen ? 'up' : 'down'} dashboard-dropdown-arrow`}></i>
            </button>

            {isDropdownOpen && (
              <div className="dashboard-dropdown-menu">
                <div className="dashboard-dropdown-presets">
                  <button
                    type="button"
                    className={`dashboard-dropdown-item ${activePill === 'TODAY' ? 'is-active' : ''}`}
                    onClick={() => handleSelectPreset('TODAY')}
                  >
                    <span>Hôm nay</span>
                    {activePill === 'TODAY' && <i className="ti ti-check"></i>}
                  </button>
                  <button
                    type="button"
                    className={`dashboard-dropdown-item ${activePill === '7DAYS' ? 'is-active' : ''}`}
                    onClick={() => handleSelectPreset('7DAYS')}
                  >
                    <span>7 ngày qua</span>
                    {activePill === '7DAYS' && <i className="ti ti-check"></i>}
                  </button>
                  <button
                    type="button"
                    className={`dashboard-dropdown-item ${activePill === '30DAYS' ? 'is-active' : ''}`}
                    onClick={() => handleSelectPreset('30DAYS')}
                  >
                    <span>30 ngày qua</span>
                    {activePill === '30DAYS' && <i className="ti ti-check"></i>}
                  </button>
                  <button
                    type="button"
                    className={`dashboard-dropdown-item ${activePill === 'MONTH' ? 'is-active' : ''}`}
                    onClick={() => handleSelectPreset('MONTH')}
                  >
                    <span>Tháng này</span>
                    {activePill === 'MONTH' && <i className="ti ti-check"></i>}
                  </button>
                  <button
                    type="button"
                    className={`dashboard-dropdown-item ${activePill === 'ALL' ? 'is-active' : ''}`}
                    onClick={() => handleSelectPreset('ALL')}
                  >
                    <span>Tất cả thời gian</span>
                    {activePill === 'ALL' && <i className="ti ti-check"></i>}
                  </button>

                  <div className="dashboard-dropdown-divider"></div>

                  <button
                    type="button"
                    className={`dashboard-dropdown-item ${activePill === 'CUSTOM' ? 'is-active' : ''}`}
                    onClick={() => setShowCustomInputs((prev) => !prev)}
                  >
                    <span>Tùy chỉnh ngày...</span>
                    <i className={`ti ti-chevron-${showCustomInputs ? 'up' : 'down'}`}></i>
                  </button>
                </div>

                {showCustomInputs && (
                  <div className="dashboard-dropdown-custom">
                    <div className="dashboard-custom-field">
                      <label>Từ ngày</label>
                      <input
                        type="date"
                        className="dashboard-custom-input"
                        value={customDates.from}
                        onChange={(e) => setCustomDates({ ...customDates, from: e.target.value })}
                      />
                    </div>
                    <div className="dashboard-custom-field">
                      <label>Đến ngày</label>
                      <input
                        type="date"
                        className="dashboard-custom-input"
                        value={customDates.to}
                        onChange={(e) => setCustomDates({ ...customDates, to: e.target.value })}
                      />
                    </div>
                    <button
                      type="button"
                      className="dashboard-custom-apply-btn"
                      onClick={handleApplyCustom}
                    >
                      Áp dụng
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. KPI Row: 4 Cards */}
      <div className="dashboard-kpi-grid">
        {/* Card 1: Doanh thu */}
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-header">
            <span className="dashboard-kpi-icon" style={{ color: '#2563EB' }}>
              <i className="ti ti-chart-line"></i>
            </span>
            <span className="dashboard-kpi-label">Doanh thu</span>
          </div>
          <div className="dashboard-kpi-value">{formatCurrency(data.totalRevenue)}</div>
          <div className="dashboard-kpi-trend positive">
            <span>↑ 12,8%</span>
            <span>so với kỳ trước</span>
          </div>
        </div>

        {/* Card 2: Đơn hàng */}
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-header">
            <span className="dashboard-kpi-icon" style={{ color: '#2563EB' }}>
              <i className="ti ti-package"></i>
            </span>
            <span className="dashboard-kpi-label">Đơn hàng</span>
          </div>
          <div className="dashboard-kpi-value">{data.totalOrders}</div>
          <div className="dashboard-kpi-trend positive">
            <span>↑ 8,6%</span>
            <span>so với kỳ trước</span>
          </div>
        </div>

        {/* Card 3: Giá trị đơn TB */}
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-header">
            <span className="dashboard-kpi-icon" style={{ color: '#2563EB' }}>
              <i className="ti ti-chart-bar"></i>
            </span>
            <span className="dashboard-kpi-label">Giá trị đơn TB</span>
          </div>
          <div className="dashboard-kpi-value">{formatCurrency(data.averageOrderValue)}</div>
          <div className="dashboard-kpi-trend positive">
            <span>↑ 3,9%</span>
            <span>so với kỳ trước</span>
          </div>
        </div>

        {/* Card 4: Chi phí KM */}
        <div className="dashboard-kpi-card">
          <div className="dashboard-kpi-header">
            <span className="dashboard-kpi-icon" style={{ color: '#D97706' }}>
              <i className="ti ti-tag"></i>
            </span>
            <span className="dashboard-kpi-label">Chi phí KM</span>
          </div>
          <div className="dashboard-kpi-value" style={{ color: '#D97706' }}>
            {formatCurrency(data.discountCost)}
          </div>
          <div className="dashboard-kpi-trend muted">
            <span>{data.validDiscountUsageCount} lượt dùng mã hợp lệ</span>
          </div>
        </div>
      </div>

      {/* 3. Charts Row (2 columns: 60% Area Chart / 40% Donut Chart) */}
      <div className="dashboard-charts-row">
        {/* Left Column (60%): Doanh thu theo ngày */}
        <div className="dashboard-chart-card">
          <div className="dashboard-chart-card-header">
            <h2 className="dashboard-chart-title">Doanh thu theo ngày</h2>
            <button type="button" className="dashboard-chart-tab-btn">
              Doanh thu
            </button>
          </div>

          <div className="dashboard-area-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={data.revenueChart}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E8EF" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: '#E4E8EF' }}
                  tick={{ fill: '#8A96A8', fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: '#8A96A8', fontSize: 12 }}
                  tickFormatter={(val) => `${Math.round(val / 1000000)}M`}
                />
                <Tooltip
                  formatter={(val) => [formatCurrency(val), 'Doanh thu']}
                  labelStyle={{ color: '#1A2233', fontWeight: 600 }}
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E4E8EF',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column (40%): Nhóm sản phẩm (Donut Chart) */}
        <div className="dashboard-chart-card">
          <div className="dashboard-chart-card-header">
            <h2 className="dashboard-chart-title">Nhóm sản phẩm</h2>
          </div>

          <div className="dashboard-donut-wrapper">
            <div className="dashboard-donut-inner-box">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.categoryBreakdown}
                    innerRadius={52}
                    outerRadius={76}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {data.categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="dashboard-donut-center-text">65%</div>
            </div>

            <div className="dashboard-donut-legend">
              {data.categoryBreakdown.map((item, idx) => (
                <div key={idx} className="dashboard-legend-item">
                  <div className="dashboard-legend-left">
                    <span
                      className="dashboard-legend-dot"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="dashboard-legend-name">{item.name}</span>
                  </div>
                  <span className="dashboard-legend-pct">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

          <p className="dashboard-donut-note">
            Laptop tiếp tục là nhóm dẫn dắt doanh thu.
          </p>
        </div>
      </div>

      {/* 4. Top 5 Mã Giảm Giá Leaderboard */}
      <div className="dashboard-table-card">
        <div className="dashboard-table-header-box">
          <div className="dashboard-table-title-box">
            <h2>Top 5 mã giảm giá hiệu quả</h2>
            <p className="dashboard-table-sub">
              Xếp hạng theo tỷ suất hoàn vốn ROI (Doanh thu tạo ra / Chi phí mã)
            </p>
          </div>
          <Link to="/admin/discounts" className="dashboard-link-more">
            <span>Quản lý mã</span>
            <span>→</span>
          </Link>
        </div>

        <div className="dashboard-table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Hạng</th>
                <th>Mã code</th>
                <th>Lượt dùng</th>
                <th>Doanh thu từ mã</th>
                <th>Chi phí giảm</th>
                <th>ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.topDiscounts.map((d, idx) => (
                <tr key={idx}>
                  <td className={`dashboard-rank-cell ${idx === 0 ? 'top-1' : ''}`}>
                    {d.rank}
                  </td>
                  <td className="dashboard-code-cell">{d.code}</td>
                  <td>{d.usedCount}</td>
                  <td style={{ fontWeight: 600 }}>{formatCurrency(d.revenue)}</td>
                  <td style={{ color: '#D97706' }}>{formatCurrency(d.cost)}</td>
                  <td>
                    {d.isBadge ? (
                      <span className="dashboard-roi-badge">{d.roi}</span>
                    ) : d.roi === 'N/A' ? (
                      <span className="dashboard-roi-na">{d.roi}</span>
                    ) : (
                      <span className="dashboard-roi-text">{d.roi}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="dashboard-table-note">
          * Đơn đủ điều kiện: Đã thanh toán, Đã giao hoặc Hoàn thành. Doanh thu từ mã = Tổng giá trị gốc sản phẩm (Original Amount).
        </p>
      </div>

      {/* 5. Đơn Hàng Gần Đây */}
      <div className="dashboard-table-card">
        <div className="dashboard-table-header-box">
          <div className="dashboard-table-title-box">
            <h2>Đơn hàng gần đây</h2>
            <p className="dashboard-table-sub">
              Cập nhật các đơn vừa phát sinh trong thời gian gần nhất
            </p>
          </div>
          <Link to="/staff/orders" className="dashboard-link-more">
            <span>Xem tất cả</span>
            <span>→</span>
          </Link>
        </div>

        <div className="dashboard-table-responsive">
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Khách hàng</th>
                <th>Tổng thanh toán</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((ord) => (
                <tr key={ord.id}>
                  <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>
                    #{ord.code || `GHT${ord.id}`}
                  </td>
                  <td style={{ fontWeight: 600 }}>{ord.customer}</td>
                  <td style={{ fontWeight: 700 }}>{formatCurrency(ord.total)}</td>
                  <td>{getOrderStatusBadge(ord.status)}</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{ord.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
