import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../utils/axiosClient';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './Login.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { syncCart } = useCart();
  const { syncWishlist } = useWishlist();
  const navigate = useNavigate();
  const location = useLocation();

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "17023243200-v634ttcohdmthh7g1pv8d2msud64aqmq.apps.googleusercontent.com";

  // Tự động nạp email đã lưu nếu trước đó đã bật "Ghi nhớ đăng nhập"
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Helper điều hướng theo role
  const redirectByRole = (token) => {
    try {
      const decoded = jwtDecode(token);
      const role = decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
      
      const from = location.state?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
        return;
      }

      if (role === 'Admin') {
        navigate('/admin/dashboard', { replace: true });
      } else if (role === 'Staff') {
        navigate('/staff/orders', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch {
      navigate('/', { replace: true });
    }
  };

  const handleBlur = (field, value) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (!value) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Trường này không được để trống' }));
    } else if (field === 'email' && !/\S+@\S+\.\S+/.test(value)) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Email không hợp lệ' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!email) errors.email = 'Trường này không được để trống';
    else if (!/\S+@\S+\.\S+/.test(email)) errors.email = 'Email không hợp lệ';

    if (!password) errors.password = 'Trường này không được để trống';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ email: true, password: true });
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/login', { email, password });

      // Lưu hoặc xóa email đã ghi nhớ
      if (rememberMe) {
        localStorage.setItem('savedEmail', email.trim());
      } else {
        localStorage.removeItem('savedEmail');
      }

      login(res.data.token, rememberMe);
      await syncCart();
      await syncWishlist();
      redirectByRole(res.data.token);
    } catch (err) {
      if (err.response?.status === 403 && err.response?.data?.requireVerification) {
        navigate('/register', {
          state: {
            step: 2,
            email: err.response?.data?.email || email,
            notice: err.response?.data?.message || 'Tài khoản chưa được kích hoạt email. Vui lòng nhập mã OTP để kích hoạt.'
          }
        });
        return;
      }
      setError(err.response?.data?.message || 'Email hoặc mật khẩu không đúng');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const res = await axiosClient.post('/auth/google', { idToken: credentialResponse.credential });
      login(res.data.token, rememberMe);
      await syncCart();
      await syncWishlist();
      redirectByRole(res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập Google thất bại');
    }
  };

  const getEmailInputClass = () => {
    if (fieldErrors.email) return 'input is-error';
    if (touched.email && email && /\S+@\S+\.\S+/.test(email)) return 'input is-success';
    return 'input';
  };

  const getPasswordInputClass = () => {
    if (fieldErrors.password) return 'input is-error';
    if (touched.password && password) return 'input is-success';
    return 'input';
  };

  return (
    <div className="auth-page-container">
      <div className="auth-3col-layout">
        {/* Column 1: Brand Panel (25%) */}
        <aside className="auth-brand-panel">
          <span className="auth-brand-pill">Chào mừng đến GHT</span>
          <h1 className="auth-brand-title">Một tài khoản. Trọn trải nghiệm công nghệ.</h1>
          <p className="auth-brand-sub">
            Khám phá thiết bị công nghệ chính hãng, theo dõi đơn hàng thời gian thực và nhận tư vấn chuyên sâu từ trợ lý AI.
          </p>

          <div className="auth-trust-box">
            <div className="auth-trust-header">
              <i className="ti ti-shield-check auth-trust-icon"></i>
              <span>An toàn & riêng tư</span>
            </div>
            <p className="auth-trust-desc">
              Thông tin đăng nhập và dữ liệu thanh toán được bảo vệ theo tiêu chuẩn bảo mật đa lớp.
            </p>
          </div>

          <div className="auth-support-contact">
            Cần trợ giúp? <a href="mailto:support@ght.vn">support@ght.vn</a>
          </div>
        </aside>

        {/* Column 2: Login Form Card (35% - Active) */}
        <section className="auth-card is-active">
          <h2 className="auth-card-title">Đăng nhập</h2>
          <p className="auth-card-sub">Chào bạn, rất vui được gặp lại!</p>

          {error && <div className="auth-alert-box">{error}</div>}

          {/* Google Login Button */}
          <div className="auth-google-wrapper">
            <GoogleOAuthProvider clientId={clientId}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Đăng nhập Google bị hủy')}
                text="signin_with"
                shape="rectangular"
                width="100%"
              />
            </GoogleOAuthProvider>
          </div>

          <div className="auth-divider">hoặc bằng email</div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email Field */}
            <div className="auth-form-group">
              <label className="auth-label">
                <span>Email <span className="auth-required-mark">*</span></span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  type="email"
                  className={getEmailInputClass()}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, email: null }));
                  }}
                  onBlur={() => handleBlur('email', email)}
                  disabled={isSubmitting}
                />
                {touched.email && !fieldErrors.email && email && (
                  <span className="auth-input-icon">✓</span>
                )}
              </div>
              {fieldErrors.email && (
                <span className="error-message">{fieldErrors.email}</span>
              )}
            </div>

            {/* Password Field */}
            <div className="auth-form-group">
              <label className="auth-label">
                <span>Mật khẩu <span className="auth-required-mark">*</span></span>
              </label>
              <div className="auth-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={getPasswordInputClass()}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFieldErrors((prev) => ({ ...prev, password: null }));
                  }}
                  onBlur={() => handleBlur('password', password)}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="auth-input-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  <i className={`ti ${showPassword ? 'ti-eye-off' : 'ti-eye'}`}></i>
                </button>
              </div>
              {fieldErrors.password && (
                <span className="error-message">{fieldErrors.password}</span>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="auth-checkbox-row">
              <label className="auth-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <Link to="/forgot-password" className="auth-link">
                Quên mật khẩu?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary auth-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <ButtonSpinner /> Đang đăng nhập...
                </>
              ) : (
                'Đăng nhập'
              )}
            </button>
          </form>

          <div className="auth-card-footer">
            Chưa có tài khoản?{' '}
            <Link to="/register" className="auth-link">
              Tạo tài khoản ở bên cạnh
            </Link>
          </div>

          <div className="auth-card-note">
            Đăng nhập để đồng bộ giỏ hàng và dữ liệu mua sắm của bạn.
          </div>
        </section>

        {/* Column 3: Register Promo / Direct Register Link (40%) */}
        <section className="auth-card">
          <h2 className="auth-card-title">Tạo tài khoản</h2>
          <p className="auth-card-sub">
            Bắt đầu mua sắm và nhận ưu đãi độc quyền dành riêng cho bạn.
          </p>

          <div className="auth-trust-box">
            <div className="auth-trust-header">
              <span>🎁</span>
              <span>Đặc quyền thành viên mới GHT</span>
            </div>
            <p className="auth-trust-desc">
              ✓ Giảm ngay 10% cho đơn hàng đầu tiên với mã <strong>GHTSALE10</strong><br />
              ✓ Miễn phí vận chuyển GHN cho đơn từ 5.000.000đ<br />
              ✓ Bảo hành chính hãng 24 tháng & đổi trả trong 7 ngày
            </p>
          </div>

          <Link
            to="/register"
            className="btn-dark auth-submit-btn"
          >
            Đăng ký tài khoản mới ➔
          </Link>

          <div className="auth-card-note">
            Không gửi thư rác. Bạn có thể huỷ nhận thông tin bất cứ lúc nào.
          </div>
        </section>
      </div>
    </div>
  );
};

export default Login;

