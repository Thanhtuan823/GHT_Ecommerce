import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../utils/axiosClient';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import ButtonSpinner from '../../components/common/ButtonSpinner';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const strengthColors = ['var(--color-bg-muted)', 'var(--color-danger)', '#D97706', 'var(--color-success)', '#065F46'];
  const strengthLabels = ['Yếu', 'Yếu', 'Trung bình', 'Mạnh', 'Rất mạnh'];

  const handleBlur = (field, value) => {
    if (!value) {
      setFieldErrors(prev => ({ ...prev, [field]: 'Trường này không được để trống' }));
    } else if (field === 'password' && value.length < 8) {
      setFieldErrors(prev => ({ ...prev, [field]: 'Mật khẩu phải có ít nhất 8 ký tự' }));
    } else {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || password.length < 8) {
      setFieldErrors({
        name: !name ? 'Trường này không được để trống' : null,
        email: !email ? 'Trường này không được để trống' : null,
        password: !password ? 'Trường này không được để trống' : (password.length < 8 ? 'Mật khẩu phải có ít nhất 8 ký tự' : null)
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await axiosClient.post('/auth/register', { name, email, password });
      login(res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    } finally {
      setIsSubmitting(false);
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
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Đăng ký</h2>
      {error && <div className="error-message" style={{ marginBottom: '16px', padding: '10px', background: 'var(--color-danger-bg)', borderRadius: '8px' }}>{error}</div>}
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Họ tên</label>
          <input type="text" className={`input ${fieldErrors.name ? 'is-error' : ''}`} value={name} onChange={e => { setName(e.target.value); setFieldErrors({...fieldErrors, name: null}); }} onBlur={() => handleBlur('name', name)} />
          {fieldErrors.name && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.name}</div>}
        </div>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Email</label>
          <input type="email" className={`input ${fieldErrors.email ? 'is-error' : ''}`} value={email} onChange={e => { setEmail(e.target.value); setFieldErrors({...fieldErrors, email: null}); }} onBlur={() => handleBlur('email', email)} />
          {fieldErrors.email && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.email}</div>}
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Mật khẩu</label>
          <input type="password" className={`input ${fieldErrors.password ? 'is-error' : ''}`} value={password} onChange={e => { setPassword(e.target.value); setFieldErrors({...fieldErrors, password: null}); }} onBlur={() => handleBlur('password', password)} />
          {fieldErrors.password && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.password}</div>}
          <div style={{ marginTop: '8px', display: 'flex', gap: '5px' }}>
            {[1, 2, 3, 4].map(level => (
              <div key={level} style={{ flex: 1, height: '4px', background: level <= strength ? strengthColors[strength] : 'var(--color-bg-muted)', borderRadius: '2px' }}></div>
            ))}
          </div>
          {password && <div style={{ fontSize: '12px', marginTop: '6px', color: strengthColors[strength], fontWeight: '500' }}>{strengthLabels[strength]}</div>}
        </div>
        <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={isSubmitting}>
          {isSubmitting ? <><ButtonSpinner /> ĐANG ĐĂNG KÝ...</> : 'Đăng ký'}
        </button>
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
