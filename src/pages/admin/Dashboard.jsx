import { useState, useEffect } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import Skeleton from '../../components/common/Skeleton';
import { calculateROI } from '../../utils/discountHelper';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import './Dashboard.css'; // Add generic dashboard styles if needed

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const AdminDashboard = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();

  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      let url = '/admin/dashboard';
      const params = new URLSearchParams();
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axiosClient.get(url);
      setData(res.data);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu Dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleExportExcel = async () => {
    try {
      let url = '/admin/export-excel';
      const params = new URLSearchParams();
      if (dateRange.from) params.append('from', dateRange.from);
      if (dateRange.to) params.append('to', dateRange.to);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await axiosClient.get(url, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('url');
      const href = URL.createObjectURL(blob);
      
      const fileName = `GHT_Revenue_${dateRange.from || 'All'}_${dateRange.to || 'All'}.xlsx`;
      
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(href);
    } catch (err) {
      toast.error('Lỗi xuất Excel');
    }
  };

  if (isLoading && !data) return (
    <div style={{ padding: '24px' }}>
      <Skeleton height="100px" style={{ marginBottom: '24px' }} />
      <Skeleton height="300px" style={{ marginBottom: '24px' }} />
      <Skeleton height="200px" />
    </div>
  );

  if (!data) return null;

  const chartData = {
    labels: data.revenueChart.map(d => d.date),
    datasets: [
      {
        label: 'Doanh thu (VND)',
        data: data.revenueChart.map(d => d.revenue),
        borderColor: '#0284C7',
        backgroundColor: 'rgba(2, 132, 199, 0.1)',
        tension: 0.3,
        fill: true,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: false }
    }
  };

  return (
    <div className="dashboard-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2>Dashboard Thống kê</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input type="date" className="input" value={dateRange.from} onChange={e => setDateRange({...dateRange, from: e.target.value})} />
          <span> - </span>
          <input type="date" className="input" value={dateRange.to} onChange={e => setDateRange({...dateRange, to: e.target.value})} />
          <button className="btn-secondary" onClick={fetchDashboard}>Lọc</button>
          <button className="btn-primary" onClick={handleExportExcel}><span className="ti-download"></span> Xuất Excel</button>
        </div>
      </div>

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div className="kpi-card" style={{ padding: '20px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="ti-money" style={{ fontSize: '24px', color: 'var(--color-success)' }}></span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Doanh thu</span>
          </div>
          <h3 style={{ fontSize: '24px', margin: 0 }}>{new Intl.NumberFormat('vi-VN').format(data.totalRevenue)} đ</h3>
        </div>
        <div className="kpi-card" style={{ padding: '20px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="ti-shopping-cart-full" style={{ fontSize: '24px', color: 'var(--color-accent)' }}></span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Tổng đơn hàng</span>
          </div>
          <h3 style={{ fontSize: '24px', margin: 0 }}>{data.totalOrders}</h3>
        </div>
        <div className="kpi-card" style={{ padding: '20px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="ti-package" style={{ fontSize: '24px', color: 'var(--color-info)' }}></span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Sản phẩm đã bán</span>
          </div>
          <h3 style={{ fontSize: '24px', margin: 0 }}>{data.productsSold}</h3>
        </div>
        <div className="kpi-card" style={{ padding: '20px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="ti-alert" style={{ fontSize: '24px', color: 'var(--color-danger)' }}></span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Tồn kho thấp</span>
          </div>
          <h3 style={{ fontSize: '24px', margin: 0 }}>{data.lowStockCount}</h3>
        </div>
        <div className="kpi-card" style={{ padding: '20px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <span className="ti-tag" style={{ fontSize: '24px', color: '#D97706' }}></span>
            <span style={{ color: 'var(--color-text-secondary)', fontWeight: '500' }}>Chi phí KM</span>
          </div>
          <h3 style={{ fontSize: '24px', margin: 0 }}>{new Intl.NumberFormat('vi-VN').format(data.discountCost)} đ</h3>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div style={{ background: 'var(--color-bg-white)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <h3 style={{ marginBottom: '16px' }}>Biểu đồ Doanh thu</h3>
          {data.revenueChart.length > 0 ? (
            <Line data={chartData} options={chartOptions} />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu</div>
          )}
        </div>

        <div style={{ background: 'var(--color-bg-white)', padding: '24px', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', overflowX: 'auto' }}>
          <h3 style={{ marginBottom: '16px' }}>Leaderboard (Top 5 ROI)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                <th style={{ padding: '12px 8px' }}>Mã code</th>
                <th style={{ padding: '12px 8px' }}>Lượt dùng</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>ROI</th>
              </tr>
            </thead>
            <tbody>
              {data.topDiscounts.length > 0 ? data.topDiscounts.map(d => (
                <tr key={d.code} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: '500' }}>{d.code}</td>
                  <td style={{ padding: '12px 8px' }}>{d.usedCount}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', color: calculateROI(d.revenueFromCode, d.totalDiscountAmount) !== 'N/A' ? 'var(--color-success)' : 'var(--color-text-muted)', fontWeight: 'bold' }}>
                    {calculateROI(d.revenueFromCode, d.totalDiscountAmount)}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu KM</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
