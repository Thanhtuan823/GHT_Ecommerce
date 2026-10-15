import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/ToastContext';
import axiosClient from '../../utils/axiosClient';
import ButtonSpinner from '../common/ButtonSpinner';
import './ProfileModal.css';

const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
];

const ProfileModal = () => {
  const { user, isProfileModalOpen, closeProfileModal, updateUser } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'password'
  
  // Profile form state
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [phone, setPhone] = useState('');

  // Shipping Address state
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [selectedProvinceName, setSelectedProvinceName] = useState('');
  const [selectedDistrictId, setSelectedDistrictId] = useState('');
  const [selectedDistrictName, setSelectedDistrictName] = useState('');
  const [selectedWardCode, setSelectedWardCode] = useState('');
  const [selectedWardName, setSelectedWardName] = useState('');
  const [streetAddress, setStreetAddress] = useState('');

  // Password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  // Loading states
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);

  // Sync user state when modal opens
  useEffect(() => {
    if (isProfileModalOpen && user) {
      setName(user.name || '');
      setAvatar(user.avatar || '');
      setPhone(user.phone || '');

      const addr = user.defaultAddress || {};
      setSelectedProvinceId(addr.provinceId || '');
      setSelectedProvinceName(addr.provinceName || '');
      setSelectedDistrictId(addr.districtId || '');
      setSelectedDistrictName(addr.districtName || '');
      setSelectedWardCode(addr.wardCode || '');
      setSelectedWardName(addr.wardName || '');
      setStreetAddress(addr.address || '');
    }
  }, [isProfileModalOpen, user]);

  // Load provinces on mount / open
  useEffect(() => {
    if (!isProfileModalOpen) return;
    const loadProvinces = async () => {
      try {
        const res = await axiosClient.get('/shipping/provinces');
        setProvinces(res.data?.data || []);
      } catch (err) {
        console.error('Lỗi tải tỉnh/thành', err);
      }
    };
    loadProvinces();
  }, [isProfileModalOpen]);

  // Load districts when province changes
  useEffect(() => {
    if (!selectedProvinceId) {
      setDistricts([]);
      return;
    }
    const loadDistricts = async () => {
      setIsLoadingLocations(true);
      try {
        const res = await axiosClient.get(`/shipping/districts/${selectedProvinceId}`);
        setDistricts(res.data?.data || []);
      } catch (err) {
        console.error('Lỗi tải quận/huyện', err);
      } finally {
        setIsLoadingLocations(false);
      }
    };
    loadDistricts();
  }, [selectedProvinceId]);

  // Load wards when district changes
  useEffect(() => {
    if (!selectedDistrictId) {
      setWards([]);
      return;
    }
    const loadWards = async () => {
      try {
        const res = await axiosClient.get(`/shipping/wards/${selectedDistrictId}`);
        setWards(res.data?.data || []);
      } catch (err) {
        console.error('Lỗi tải phường/xã', err);
      }
    };
    loadWards();
  }, [selectedDistrictId]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isProfileModalOpen) {
        closeProfileModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileModalOpen, closeProfileModal]);

  if (!isProfileModalOpen || !user) return null;

  // Handlers for location select
  const handleProvinceChange = (e) => {
    const pid = e.target.value;
    const pObj = provinces.find((p) => String(p.ProvinceID) === String(pid));
    setSelectedProvinceId(pid);
    setSelectedProvinceName(pObj?.ProvinceName || '');
    setSelectedDistrictId('');
    setSelectedDistrictName('');
    setSelectedWardCode('');
    setSelectedWardName('');
  };

  const handleDistrictChange = (e) => {
    const did = e.target.value;
    const dObj = districts.find((d) => String(d.DistrictID) === String(did));
    setSelectedDistrictId(did);
    setSelectedDistrictName(dObj?.DistrictName || '');
    setSelectedWardCode('');
    setSelectedWardName('');
  };

  const handleWardChange = (e) => {
    const wid = e.target.value;
    const wObj = wards.find((w) => String(w.WardCode) === String(wid));
    setSelectedWardCode(wid);
    setSelectedWardName(wObj?.WardName || '');
  };

  // Submit Profile Info
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }

    setIsSavingProfile(true);
    try {
      const fullAddressParts = [streetAddress, selectedWardName, selectedDistrictName, selectedProvinceName].filter(Boolean);
      const fullAddressString = fullAddressParts.join(', ');

      const defaultAddressPayload = {
        name: name.trim(),
        phone: phone.trim(),
        provinceId: selectedProvinceId,
        provinceName: selectedProvinceName,
        districtId: selectedDistrictId,
        districtName: selectedDistrictName,
        wardCode: selectedWardCode,
        wardName: selectedWardName,
        address: streetAddress.trim(),
        fullAddress: fullAddressString
      };

      const res = await axiosClient.put('/users/profile', {
        name: name.trim(),
        avatar: avatar.trim(),
        phone: phone.trim(),
        defaultAddress: defaultAddressPayload
      });

      // Update local state in AuthContext directly
      updateUser({
        name: res.data.name,
        avatar: res.data.avatar,
        phone: res.data.phone,
        defaultAddress: res.data.defaultAddress
      });

      toast.success('Cập nhật hồ sơ và địa chỉ thành công!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Có lỗi xảy ra khi lưu thông tin');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Submit Password Change
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Vui lòng nhập mật khẩu hiện tại');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setIsSavingPassword(true);
    try {
      await axiosClient.put('/users/password', {
        currentPassword,
        newPassword
      });
      toast.success('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi đổi mật khẩu');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Submit Set Password (for Google users or users without password)
  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setIsSavingPassword(true);
    try {
      const res = await axiosClient.post('/users/set-password', {
        newPassword
      });
      toast.success(res.data?.message || 'Thiết lập mật khẩu thành công!');
      updateUser({ hasPassword: true });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi thiết lập mật khẩu');
    } finally {
      setIsSavingPassword(false);
    }
  };

  const fullAddressPreview = [streetAddress, selectedWardName, selectedDistrictName, selectedProvinceName]
    .filter(Boolean)
    .join(', ');

  const hasPassword = Boolean(user.hasPassword);
  const isGoogleLinked = Boolean(user.googleId || user.isGoogleLinked);

  return (
    <div className="profile-modal-backdrop" onClick={closeProfileModal}>
      <div className="profile-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="profile-modal-header">
          <div className="profile-modal-user-summary">
            <div className="profile-modal-avatar-wrapper">
              <img
                src={avatar || user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={name || user.name}
                className="profile-modal-avatar-img"
              />
            </div>
            <div className="profile-modal-user-meta">
              <div className="profile-modal-name-row">
                <h3 className="profile-modal-name">{name || user.name}</h3>
                <span className={`profile-badge-role role-${(user.role || 'customer').toLowerCase()}`}>
                  {user.role === 'Admin' ? 'Quản trị viên' : user.role === 'Staff' ? 'Nhân viên' : 'Khách hàng'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <p className="profile-modal-email" style={{ margin: 0 }}>{user.email}</p>
                {(user.emailVerified ?? true) ? (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#15803d',
                    backgroundColor: '#dcfce7',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    lineHeight: '1.2'
                  }}>
                    <i className="ti ti-circle-check"></i> Đã xác thực
                  </span>
                ) : (
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#b45309',
                    backgroundColor: '#fef3c7',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    lineHeight: '1.2'
                  }}>
                    <i className="ti ti-alert-circle"></i> Chưa xác thực
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="profile-modal-close-btn"
            onClick={closeProfileModal}
            aria-label="Đóng"
          >
            <i className="ti ti-x"></i>
          </button>
        </div>

        {/* Tab Controls */}
        <div className="profile-modal-tabs">
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <i className="ti ti-user-check"></i>
            <span>Thông tin & Địa chỉ nhận hàng</span>
          </button>
          <button
            type="button"
            className={`profile-tab-btn ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            <i className="ti ti-shield-lock"></i>
            <span>Bảo mật & Mật khẩu</span>
          </button>
        </div>

        {/* Body content */}
        <div className="profile-modal-body">
          {activeTab === 'info' ? (
            <form onSubmit={handleSaveProfile} className="profile-form">
              {/* Section 1: Thông tin cơ bản */}
              <div className="profile-section">
                <h4 className="profile-section-title">
                  <i className="ti ti-id"></i> Thông tin cá nhân
                </h4>
                <div className="profile-grid-2">
                  <div className="profile-form-group">
                    <label className="profile-label">
                      Họ và tên <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="profile-input"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      required
                    />
                  </div>
                  <div className="profile-form-group">
                    <label className="profile-label">Số điện thoại liên hệ</label>
                    <input
                      type="tel"
                      className="profile-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0912 345 678"
                    />
                  </div>
                </div>

                <div className="profile-form-group">
                  <label className="profile-label">Email tài khoản</label>
                  <div className="profile-input-readonly-wrap">
                    <input
                      type="email"
                      className="profile-input readonly"
                      value={user.email}
                      disabled
                    />
                    {(user.emailVerified ?? true) ? (
                      <span className="profile-verified-badge">
                        <i className="ti ti-check"></i> Đã xác thực
                      </span>
                    ) : (
                      <span className="profile-verified-badge" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                        <i className="ti ti-alert-circle"></i> Chưa xác thực
                      </span>
                    )}
                  </div>
                </div>

                {/* Avatar URL & Gợi ý */}
                <div className="profile-form-group">
                  <label className="profile-label">Ảnh đại diện (Avatar URL)</label>
                  <input
                    type="url"
                    className="profile-input"
                    value={avatar}
                    onChange={(e) => setAvatar(e.target.value)}
                    placeholder="https://example.com/avatar.jpg"
                  />
                  <div className="profile-avatar-presets">
                    <span className="profile-presets-hint">Chọn nhanh ảnh mẫu:</span>
                    <div className="profile-presets-list">
                      {DEFAULT_AVATARS.map((presetUrl, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className={`profile-preset-thumb ${avatar === presetUrl ? 'selected' : ''}`}
                          onClick={() => setAvatar(presetUrl)}
                        >
                          <img src={presetUrl} alt={`Avatar mẫu ${idx + 1}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Địa chỉ giao hàng mặc định */}
              <div className="profile-section address-section">
                <div className="profile-section-header">
                  <h4 className="profile-section-title">
                    <i className="ti ti-truck-delivery"></i> Địa chỉ giao hàng mặc định
                  </h4>
                  <span className="profile-section-subtitle">
                    Tự động điền khi thanh toán đơn hàng
                  </span>
                </div>

                <div className="profile-grid-3">
                  <div className="profile-form-group">
                    <label className="profile-label">Tỉnh / Thành phố</label>
                    <select
                      className="profile-select"
                      value={selectedProvinceId}
                      onChange={handleProvinceChange}
                    >
                      <option value="">-- Chọn Tỉnh / Thành --</option>
                      {provinces.map((prov) => (
                        <option key={prov.ProvinceID} value={prov.ProvinceID}>
                          {prov.ProvinceName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-label">Quận / Huyện</label>
                    <select
                      className="profile-select"
                      value={selectedDistrictId}
                      onChange={handleDistrictChange}
                      disabled={!selectedProvinceId || isLoadingLocations}
                    >
                      <option value="">-- Chọn Quận / Huyện --</option>
                      {districts.map((dist) => (
                        <option key={dist.DistrictID} value={dist.DistrictID}>
                          {dist.DistrictName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="profile-form-group">
                    <label className="profile-label">Phường / Xã</label>
                    <select
                      className="profile-select"
                      value={selectedWardCode}
                      onChange={handleWardChange}
                      disabled={!selectedDistrictId}
                    >
                      <option value="">-- Chọn Phường / Xã --</option>
                      {wards.map((ward) => (
                        <option key={ward.WardCode} value={ward.WardCode}>
                          {ward.WardName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="profile-form-group">
                  <label className="profile-label">Địa chỉ chi tiết (Số nhà, tên đường, tòa nhà)</label>
                  <input
                    type="text"
                    className="profile-input"
                    value={streetAddress}
                    onChange={(e) => setStreetAddress(e.target.value)}
                    placeholder="Ví dụ: Tầng 5, Tòa Landmark 81, 720A Điện Biên Phủ"
                  />
                </div>

                {fullAddressPreview && (
                  <div className="profile-address-preview-card">
                    <i className="ti ti-map-pin"></i>
                    <div>
                      <span className="preview-label">Xem trước địa chỉ đầy đủ:</span>
                      <p className="preview-content">{fullAddressPreview}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer action */}
              <div className="profile-modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={closeProfileModal}
                  disabled={isSavingProfile}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="btn-primary profile-save-btn"
                  disabled={isSavingProfile}
                >
                  {isSavingProfile ? <ButtonSpinner text="Đang lưu..." /> : (
                    <>
                      <i className="ti ti-device-floppy"></i> Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* TAB 2: ĐỔI MẬT KHẨU / THIẾT LẬP MẬT KHẨU */
            <div className="profile-password-tab">
              {!hasPassword ? (
                /* Trường hợp 1: Tài khoản Google chưa có mật khẩu -> Cho phép Thiết lập mật khẩu */
                <form onSubmit={handleSetPassword} className="profile-form">
                  <div className="profile-google-notice">
                    <div className="google-notice-icon">
                      <i className="ti ti-brand-google"></i>
                    </div>
                    <div className="google-notice-text">
                      <h4>Tài khoản liên kết Google ({user.email})</h4>
                      <p>
                        Tài khoản của bạn hiện chưa có mật khẩu riêng. Bạn có thể thiết lập mật khẩu bên dưới để linh hoạt đăng nhập bằng Email và Mật khẩu trên mọi thiết bị.
                      </p>
                    </div>
                  </div>

                  <div className="profile-section">
                    <h4 className="profile-section-title">
                      <i className="ti ti-shield-plus"></i> Thiết lập mật khẩu đăng nhập
                    </h4>
                    <p className="profile-section-desc">
                      Tạo mật khẩu có độ dài tối thiểu 8 ký tự để bảo vệ tài khoản của bạn.
                    </p>

                    <div className="profile-grid-2">
                      <div className="profile-form-group">
                        <label className="profile-label">
                          Mật khẩu mới <span className="text-danger">*</span>
                        </label>
                        <div className="profile-pw-wrap">
                          <input
                            type={showNewPw ? 'text' : 'password'}
                            className="profile-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Tối thiểu 8 ký tự"
                            required
                          />
                          <button
                            type="button"
                            className="profile-pw-toggle"
                            onClick={() => setShowNewPw(!showNewPw)}
                          >
                            <i className={`ti ${showNewPw ? 'ti-eye-off' : 'ti-eye'}`}></i>
                          </button>
                        </div>
                      </div>

                      <div className="profile-form-group">
                        <label className="profile-label">
                          Xác nhận mật khẩu mới <span className="text-danger">*</span>
                        </label>
                        <input
                          type="password"
                          className="profile-input"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="profile-modal-footer">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={closeProfileModal}
                      disabled={isSavingPassword}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="btn-primary profile-save-btn"
                      disabled={isSavingPassword}
                    >
                      {isSavingPassword ? (
                        <ButtonSpinner text="Đang thiết lập..." />
                      ) : (
                        <>
                          <i className="ti ti-key"></i> Thiết lập mật khẩu
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* Trường hợp 2: Tài khoản đã có mật khẩu -> Đổi mật khẩu */
                <form onSubmit={handleSavePassword} className="profile-form">
                  {isGoogleLinked && (
                    <div className="profile-linked-badge-card">
                      <i className="ti ti-check-circle"></i>
                      <span>
                        Tài khoản đã liên kết với Google ({user.email}) và có mật khẩu cá nhân. Bạn có thể đổi mật khẩu tại đây.
                      </span>
                    </div>
                  )}

                  <div className="profile-section">
                    <h4 className="profile-section-title">
                      <i className="ti ti-key"></i> Đổi mật khẩu tài khoản
                    </h4>
                    <p className="profile-section-desc">
                      Để bảo mật tài khoản, vui lòng sử dụng mật khẩu mạnh có tối thiểu 8 ký tự.
                    </p>

                    <div className="profile-form-group">
                      <label className="profile-label">
                        Mật khẩu hiện tại <span className="text-danger">*</span>
                      </label>
                      <div className="profile-pw-wrap">
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          className="profile-input"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Nhập mật khẩu hiện tại"
                          required
                        />
                        <button
                          type="button"
                          className="profile-pw-toggle"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                        >
                          <i className={`ti ${showCurrentPw ? 'ti-eye-off' : 'ti-eye'}`}></i>
                        </button>
                      </div>
                    </div>

                    <div className="profile-grid-2">
                      <div className="profile-form-group">
                        <label className="profile-label">
                          Mật khẩu mới <span className="text-danger">*</span>
                        </label>
                        <div className="profile-pw-wrap">
                          <input
                            type={showNewPw ? 'text' : 'password'}
                            className="profile-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Tối thiểu 8 ký tự"
                            required
                          />
                          <button
                            type="button"
                            className="profile-pw-toggle"
                            onClick={() => setShowNewPw(!showNewPw)}
                          >
                            <i className={`ti ${showNewPw ? 'ti-eye-off' : 'ti-eye'}`}></i>
                          </button>
                        </div>
                      </div>

                      <div className="profile-form-group">
                        <label className="profile-label">
                          Xác nhận mật khẩu mới <span className="text-danger">*</span>
                        </label>
                        <input
                          type="password"
                          className="profile-input"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Nhập lại mật khẩu mới"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="profile-modal-footer">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={closeProfileModal}
                      disabled={isSavingPassword}
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      className="btn-primary profile-save-btn"
                      disabled={isSavingPassword}
                    >
                      {isSavingPassword ? <ButtonSpinner text="Đang cập nhật..." /> : (
                        <>
                          <i className="ti ti-lock"></i> Đổi mật khẩu
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
