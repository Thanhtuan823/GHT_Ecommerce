import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../utils/axiosClient';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

  const getPasswordStrength = () => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getPasswordStrength();
  const strengthColors = ['#E4E8EF', '#DC2626', '#D97706', '#059669', '#065F46'];
  const strengthLabels = ['Yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Mật khẩu phải có ít nhất 8 ký tự');
      return;
    }
    try {
      const res = await axiosClient.post('/auth/register', { name, email, password });
      login(res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axiosClient.post('/auth/google', { idToken: credentialResponse.credential });
      login(res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập Google thất bại');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', background: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Đăng ký</h2>
      {error && <div className="error-message" style={{ marginBottom: '16px', padding: '10px', background: 'var(--color-danger-bg)', borderRadius: '8px' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Họ tên</label>
          <input type="text" className="input" value={name} onChange={e => setName(e.target.value)} required />
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Mật khẩu</label>
          <input type="password" className={`input ${error && password.length < 8 ? 'is-error' : ''}`} value={password} onChange={e => setPassword(e.target.value)} required />
          <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
            {[1, 2, 3, 4].map(level => (
              <div key={level} style={{ flex: 1, height: '4px', background: level <= strength ? strengthColors[strength] : '#E4E8EF', borderRadius: '2px' }}></div>
            ))}
          </div>
          {password && <div style={{ fontSize: '12px', marginTop: '6px', color: strengthColors[strength], fontWeight: '500' }}>{strengthLabels[strength]}</div>}
        </div>
        <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }}>Đăng ký</button>
      </form>
      <div style={{ textAlign: 'center', marginBottom: '16px', color: 'var(--color-text-muted)' }}>hoặc</div>
      <GoogleOAuthProvider clientId={clientId}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Đăng nhập Google bị hủy')}
          />
        </div>
      </GoogleOAuthProvider>
      <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px' }}>
        Đã có tài khoản? <Link to="/login" style={{ color: 'var(--color-accent)', fontWeight: '600' }}>Đăng nhập</Link>
      </div>
    </div>
  );
};

export default Register;
