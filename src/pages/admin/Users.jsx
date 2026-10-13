import { useState, useEffect, useCallback, useTransition } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './Users.css';

const ROLES = [
  { key: 'Customer', name: 'Khách hàng', desc: 'Mua sắm, xem đơn hàng, quản lý hồ sơ cá nhân' },
  { key: 'Staff', name: 'Nhân viên vận hành', desc: 'Quản lý đơn hàng, kho sản phẩm và cập nhật vận đơn GHN' },
  { key: 'Admin', name: 'Quản trị viên', desc: 'Toàn quyền kiểm soát tài khoản, khuyến mãi và cấu hình hệ thống' }
];

export default function Users() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [, startTransition] = useTransition();

  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    adminCount: 0,
    staffCount: 0,
    customerCount: 0,
    activeCount: 0,
    lockedCount: 0
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [loading, setLoading] = useState(false);

  // Modals state
  const [editingUser, setEditingUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('Customer');
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  const [statusTogglingUser, setStatusTogglingUser] = useState(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Debounce search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm);
        setPagination((prev) => ({ ...prev, page: 1 }));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchUsers = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10'
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (roleFilter !== 'ALL') params.append('role', roleFilter);

      const res = await axiosClient.get(`/admin/users?${params.toString()}`);
      setUsers(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      if (res.data.stats) setStats(res.data.stats);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, toast]);

  useEffect(() => {
    fetchUsers(pagination.page);
  }, [fetchUsers, pagination.page]);

  // Open Edit Role modal
  const handleOpenEditRole = (u) => {
    if (u.id === currentUser?.id) {
      toast.error('Bạn không thể tự chỉnh sửa vai trò của chính mình!');
      return;
    }
    setEditingUser(u);
    setSelectedRole(u.role);
  };

  // Submit Edit Role
  const handleSaveRole = async () => {
    if (!editingUser) return;
    setIsUpdatingRole(true);
    try {
      await axiosClient.put(`/admin/users/${editingUser.id}/role`, { role: selectedRole });
      toast.success(`Đã cập nhật vai trò ${selectedRole} cho ${editingUser.name || editingUser.email}`);
      setEditingUser(null);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi cập nhật vai trò');
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Confirm Toggle Status (Lock/Unlock)
  const handleConfirmToggleStatus = async () => {
    if (!statusTogglingUser) return;
    setIsTogglingStatus(true);
    try {
      const res = await axiosClient.put(`/admin/users/${statusTogglingUser.id}/toggle-status`);
      toast.success(res.data.message || 'Cập nhật trạng thái thành công');
      setStatusTogglingUser(null);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi đổi trạng thái');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div className="admin-users-page">
      {/* Header */}
      <div className="admin-users-header">
        <div>
          <h1 className="admin-users-title">Quản lý Người dùng & Phân quyền</h1>
          <p className="admin-users-subtitle">
            Quản trị tài khoản, phân quyền quản trị viên, nhân sự vận hành và khách hàng
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="admin-users-stats-grid">
        <div className="admin-users-stat-card">
          <div className="admin-users-stat-icon total">
            <i className="ti ti-users"></i>
          </div>
          <div className="admin-users-stat-info">
            <span className="admin-users-stat-label">Tổng người dùng</span>
            <span className="admin-users-stat-val">{stats.totalUsers}</span>
          </div>
        </div>

        <div className="admin-users-stat-card">
          <div className="admin-users-stat-icon admin">
            <i className="ti ti-shield-lock"></i>
          </div>
          <div className="admin-users-stat-info">
            <span className="admin-users-stat-label">Quản trị viên (Admin)</span>
            <span className="admin-users-stat-val">{stats.adminCount}</span>
          </div>
        </div>

        <div className="admin-users-stat-card">
          <div className="admin-users-stat-icon staff">
            <i className="ti ti-badge"></i>
          </div>
          <div className="admin-users-stat-info">
            <span className="admin-users-stat-label">Nhân sự (Staff)</span>
            <span className="admin-users-stat-val">{stats.staffCount}</span>
          </div>
        </div>

        <div className="admin-users-stat-card">
          <div className="admin-users-stat-icon customer">
            <i className="ti ti-user-check"></i>
          </div>
          <div className="admin-users-stat-info">
            <span className="admin-users-stat-label">Khách hàng</span>
            <span className="admin-users-stat-val">{stats.customerCount}</span>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="admin-users-content-card">
        {/* Toolbar */}
        <div className="admin-users-toolbar">
          <div className="admin-users-search-box">
            <i className="ti ti-search admin-users-search-icon"></i>
            <input
              type="text"
              className="admin-users-search-input"
              placeholder="Tìm theo tên, email hoặc số điện thoại..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="admin-users-filters">
            <select
              className="admin-users-select"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="ALL">Tất cả vai trò</option>
              <option value="Admin">Quản trị viên (Admin)</option>
              <option value="Staff">Nhân sự (Staff)</option>
              <option value="Customer">Khách hàng (Customer)</option>
            </select>
          </div>
        </div>

        {/* Table Container */}
        <div className="admin-users-table-container">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>Người dùng</th>
                <th>Số điện thoại</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th style={{ width: '110px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                    <ButtonSpinner /> Đang tải danh sách người dùng...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="admin-empty-table">
                      <i className="ti ti-user-x"></i>
                      <span>Không tìm thấy người dùng phù hợp</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const roleLower = (u.role || 'customer').toLowerCase();

                  return (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>#{u.id}</td>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">
                            {u.avatar ? (
                              <img src={u.avatar} alt={u.name} />
                            ) : (
                              getInitials(u.name || u.email)
                            )}
                          </div>
                          <div className="admin-user-meta">
                            <span className="admin-user-name">
                              {u.name || 'Chưa cập nhật'}
                              {isCurrent && <span style={{ fontSize: '11px', color: 'var(--color-accent)', marginLeft: '6px' }}>(Bạn)</span>}
                            </span>
                            <span className="admin-user-email">{u.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{u.phone || <span style={{ color: 'var(--color-text-muted)' }}>—</span>}</td>
                      <td>
                        <span className={`badge-role ${roleLower}`}>
                          {u.role === 'Admin' ? 'Admin' : u.role === 'Staff' ? 'Staff' : 'Khách hàng'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${u.isActive ? 'active' : 'locked'}`}>
                          {u.isActive ? 'Hoạt động' : 'Bị khóa'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                        {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                      </td>
                      <td>
                        <div className="admin-users-actions-cell" style={{ justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="Phân quyền vai trò"
                            onClick={() => handleOpenEditRole(u)}
                            disabled={isCurrent}
                          >
                            <i className="ti ti-edit"></i>
                          </button>

                          <button
                            type="button"
                            className={`btn-action-icon ${u.isActive ? 'danger' : 'unlock'}`}
                            title={u.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                            onClick={() => {
                              if (isCurrent) {
                                toast.error('Bạn không thể tự khóa tài khoản của chính mình!');
                                return;
                              }
                              setStatusTogglingUser(u);
                            }}
                            disabled={isCurrent}
                          >
                            <i className={`ti ${u.isActive ? 'ti-lock' : 'ti-lock-open'}`}></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="admin-users-pagination">
            <span>
              Hiển thị trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> (Tổng cộng {pagination.total} người dùng)
            </span>

            <div className="admin-pagination-btns">
              <button
                type="button"
                className="admin-page-btn"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Trước
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                // Show condensed page numbers if too many
                if (
                  p === 1 ||
                  p === pagination.totalPages ||
                  (p >= pagination.page - 1 && p <= pagination.page + 1)
                ) {
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`admin-page-btn ${p === pagination.page ? 'is-active' : ''}`}
                      disabled={loading}
                      onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                    >
                      {p}
                    </button>
                  );
                }
                return null;
              })}

              <button
                type="button"
                className="admin-page-btn"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Role Editing Modal */}
      {editingUser && (
        <div className="role-modal-overlay" onClick={() => setEditingUser(null)}>
          <div className="role-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="role-modal-title">Phân quyền tài khoản</h3>
            <p className="role-modal-desc">
              Thay đổi vai trò cho người dùng <strong>{editingUser.name || editingUser.email}</strong>:
            </p>

            <div className="role-options-list">
              {ROLES.map((r) => (
                <label
                  key={r.key}
                  className={`role-option-item ${selectedRole === r.key ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="userRole"
                    className="role-option-radio"
                    value={r.key}
                    checked={selectedRole === r.key}
                    onChange={() => setSelectedRole(r.key)}
                  />
                  <div className="role-option-label">
                    <span className="role-option-name">{r.name}</span>
                    <span className="role-option-sub">{r.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="role-modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEditingUser(null)}
                disabled={isUpdatingRole}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveRole}
                disabled={isUpdatingRole}
              >
                {isUpdatingRole ? <><ButtonSpinner /> Đang lưu...</> : 'Cập nhật vai trò'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Status Confirmation Modal */}
      <ConfirmModal
        isOpen={!!statusTogglingUser}
        title={statusTogglingUser?.isActive ? 'Xác nhận khóa tài khoản' : 'Xác nhận mở khóa tài khoản'}
        message={
          statusTogglingUser?.isActive
            ? `Bạn có chắc muốn KHÓA tài khoản ${statusTogglingUser?.email}? Người dùng này sẽ không thể thực hiện các thao tác quản trị.`
            : `Bạn có chắc muốn MỞ KHÓA tài khoản ${statusTogglingUser?.email}? Người dùng sẽ có thể đăng nhập bình thường.`
        }
        onConfirm={handleConfirmToggleStatus}
        onCancel={() => setStatusTogglingUser(null)}
      />
    </div>
  );
}
