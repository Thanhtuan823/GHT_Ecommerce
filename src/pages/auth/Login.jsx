import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../utils/axiosClient';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import ButtonSpinner from '../../components/common/ButtonSpinner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const { syncCart } = useCart();
  const { syncWishlist } = useWishlist();
  const navigate = useNavigate();

  // Please ensure you have this Client ID in your .env as VITE_GOOGLE_CLIENT_ID
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "YOUR_GOOGLE_CLIENT_ID";

  const handleBlur = (field, value) => {
    if (!value) {
      setFieldErrors(prev => ({ ...prev, [field]: 'Trường này không được để trống' }));
    } else {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setFieldErrors({
        email: !email ? 'Trường này không được để trống' : null,
        password: !password ? 'Trường này không được để trống' : null
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await axiosClient.post('/auth/login', { email, password });
      login(res.data.token);
      await syncCart();
      await syncWishlist();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axiosClient.post('/auth/google', { idToken: credentialResponse.credential });
      login(res.data.token);
      await syncCart();
      await syncWishlist();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập Google thất bại');
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '24px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '24px' }}>Đăng nhập</h2>
      {error && <div className="error-message" style={{ marginBottom: '16px', padding: '10px', background: 'var(--color-danger-bg)', borderRadius: '8px' }}>{error}</div>}
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Email</label>
          <input type="email" className={`input ${fieldErrors.email ? 'is-error' : ''}`} value={email} onChange={e => { setEmail(e.target.value); setFieldErrors({...fieldErrors, email: null}); }} onBlur={() => handleBlur('email', email)} />
          {fieldErrors.email && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.email}</div>}
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Mật khẩu</label>
          <input type="password" className={`input ${fieldErrors.password ? 'is-error' : ''}`} value={password} onChange={e => { setPassword(e.target.value); setFieldErrors({...fieldErrors, password: null}); }} onBlur={() => handleBlur('password', password)} />
          {fieldErrors.password && <div style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '4px' }}>{fieldErrors.password}</div>}
        </div>
        <button type="submit" className="btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={isSubmitting}>
          {isSubmitting ? <><ButtonSpinner /> ĐANG ĐĂNG NHẬP...</> : 'Đăng nhập'}
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
        Chưa có tài khoản? <Link to="/register" style={{ color: 'var(--color-accent)', fontWeight: '600' }}>Đăng ký ngay</Link>
      </div>
    </div>
  );
};

export default Login;
