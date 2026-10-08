import { useState } from 'react';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';

const Profile = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.put('/users/profile', { name, avatar });
      setMessage('Cập nhật thông tin thành công! Bạn cần đăng nhập lại để làm mới token.');
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi cập nhật thông tin');
      setMessage('');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    try {
      await axiosClient.put('/users/password', { currentPassword, newPassword });
      setMessage('Đổi mật khẩu thành công!');
      setError('');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi đổi mật khẩu');
      setMessage('');
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-md)' }}>
      <h2 style={{ marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px' }}>Hồ sơ cá nhân</h2>
      {message && <div style={{ color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontWeight: '500' }}>{message}</div>}
      {error && <div className="error-message" style={{ background: 'var(--color-danger-bg)', padding: '12px', borderRadius: '8px', marginBottom: '24px', fontWeight: '500' }}>{error}</div>}
      
      <form onSubmit={handleUpdateProfile} style={{ marginBottom: '40px' }}>
        <h3 style={{ marginBottom: '16px', color: 'var(--color-text-secondary)' }}>Thông tin cơ bản</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Họ tên</label>
          <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Avatar URL</label>
          <input type="url" className="input" value={avatar} onChange={e => setAvatar(e.target.value)} />
          {avatar && <div style={{ marginTop: '12px' }}><img src={avatar} alt="Preview" style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }} /></div>}
        </div>
        <button type="submit" className="btn-primary">Cập nhật thông tin</button>
      </form>

      <form onSubmit={handleUpdatePassword}>
        <h3 style={{ marginBottom: '16px', color: 'var(--color-text-secondary)', borderTop: '1px solid var(--color-border)', paddingTop: '24px' }}>Đổi mật khẩu</h3>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Mật khẩu hiện tại</label>
          <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Mật khẩu mới (tối thiểu 8 ký tự)</label>
          <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required />
        </div>
        <button type="submit" className="btn-dark">Đổi mật khẩu</button>
      </form>
    </div>
  );
};

export default Profile;
