import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './AuthPage.css';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Nhập email, 2: Nhập OTP & Đặt mật khẩu mới
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const toast = useToast();
  const navigate = useNavigate();

  // Đếm ngược thời gian gửi lại mã OTP
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Bước 1: Gửi mã OTP tới email
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Vui lòng nhập địa chỉ email');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Địa chỉ email không hợp lệ');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/forgot-password', { email: email.trim() });
      toast?.success ? toast.success(res.data?.message || 'Mã xác nhận đã được gửi đến email của bạn.') : null;
      setStep(2);
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi mã xác nhận. Vui lòng thử lại sau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gửi lại mã OTP
  const handleResendOtp = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/forgot-password', { email: email.trim() });
      toast?.success ? toast.success(res.data?.message || 'Đã gửi lại mã OTP mới!') : null;
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Gửi lại mã thất bại. Vui lòng thử lại sau.');
    } finally {
      setIsResending(false);
    }
  };

  // Bước 2: Xác nhận OTP và đặt lại mật khẩu mới
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP 6 số');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Mã OTP phải gồm đúng 6 chữ số');
      return;
    }
    if (!newPassword) {
      setError('Vui lòng nhập mật khẩu mới');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có tối thiểu 6 ký tự');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Xác nhận mật khẩu mới không khớp');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/reset-password', {
        email: email.trim(),
        otp: otp.trim(),
        newPassword
      });

      toast?.success ? toast.success(res.data?.message || 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.') : null;
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Đặt lại mật khẩu thất bại. Vui lòng kiểm tra lại mã OTP.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-3col-layout">
        {/* Column 1: Brand Panel (25%) */}
        <aside className="auth-brand-panel">
          <span className="auth-brand-pill">Bảo mật & Tài khoản</span>
          <h1 className="auth-brand-title">Khôi phục quyền truy cập nhanh chóng.</h1>
          <p className="auth-brand-sub">
            GHT E-Commerce bảo vệ tài khoản của bạn bằng cơ chế xác thực OTP 6 số gửi qua email, giúp ngăn chặn mọi hành vi xâm nhập trái phép.
          </p>

          <div className="auth-trust-box">
            <div className="auth-trust-header">
              <i className="ti ti-shield-lock auth-trust-icon"></i>
              <span>Xác thực an toàn</span>
            </div>
            <p className="auth-trust-desc">
              Mã xác thực có hiệu lực trong 10 phút. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
            </p>
          </div>

          <div className="auth-support-contact">
            Cần trợ giúp? <a href="mailto:support@ght.vn">support@ght.vn</a>
          </div>
        </aside>

        {/* Column 2: Forgot Password Form Card (35% - Active) */}
        <section className="auth-card is-active">
          <h2 className="auth-card-title">Quên mật khẩu</h2>
          <p className="auth-card-sub">
            {step === 1
              ? 'Nhập email đã đăng ký để nhận mã OTP khôi phục mật khẩu.'
              : 'Nhập mã xác thực OTP 6 chữ số và thiết lập mật khẩu mới.'}
          </p>

          {error && <div className="auth-alert-box">{error}</div>}

          {step === 1 ? (
            /* Bước 1: Nhập Email */
            <form onSubmit={handleRequestOtp} noValidate>
              <div className="auth-form-group">
                <label className="auth-label">
                  <span>Địa chỉ Email <span className="auth-required-mark">*</span></span>
                </label>
                <div className="auth-input-wrapper">
                  <input
                    type="email"
                    className="input"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-accent auth-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ButtonSpinner />
                    <span>Đang gửi mã...</span>
                  </>
                ) : (
                  'Gửi mã xác nhận ➔'
                )}
              </button>
            </form>
          ) : (
            /* Bước 2: Nhập OTP & Đặt mật khẩu mới */
            <form onSubmit={handleResetPassword} noValidate>
              <div className="auth-info-banner">
                <i className="ti ti-mail-check"></i>
                <div>
                  Mã OTP đã được gửi đến <strong>{email}</strong>.{' '}
                  <button
                    type="button"
                    className="auth-resend-btn"
                    onClick={() => {
                      setStep(1);
                      setError('');
                    }}
                    style={{ textDecoration: 'underline' }}
                  >
                    Đổi email
                  </button>
                </div>
              </div>

              {/* Mã OTP 6 số */}
              <div className="auth-form-group">
                <label className="auth-label">
                  <span>Mã xác nhận OTP (6 số) <span className="auth-required-mark">*</span></span>
                </label>
                <div className="auth-input-wrapper">
                  <input
                    type="text"
                    maxLength={6}
                    className="input auth-otp-input"
                    placeholder="______"
                    value={otp}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setOtp(val);
                      setError('');
                    }}
                    disabled={isSubmitting}
                    autoFocus
                  />
                </div>
              </div>

              {/* Mật khẩu mới */}
              <div className="auth-form-group">
                <label className="auth-label">
                  <span>Mật khẩu mới <span className="auth-required-mark">*</span></span>
                </label>
                <div className="auth-input-wrapper">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      setError('');
                    }}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    tabIndex={-1}
                    title={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <i className={`ti ${showNewPassword ? 'ti-eye-off' : 'ti-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Xác nhận mật khẩu mới */}
              <div className="auth-form-group">
                <label className="auth-label">
                  <span>Xác nhận mật khẩu mới <span className="auth-required-mark">*</span></span>
                </label>
                <div className="auth-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="Nhập lại mật khẩu mới"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError('');
                    }}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="auth-input-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    tabIndex={-1}
                    title={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    <i className={`ti ${showConfirmPassword ? 'ti-eye-off' : 'ti-eye'}`}></i>
                  </button>
                </div>
              </div>

              {/* Đếm ngược gửi lại mã */}
              <div className="auth-resend-row">
                <span>Không nhận được mã?</span>
                {countdown > 0 ? (
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    Gửi lại sau <strong>{countdown}s</strong>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="auth-resend-btn"
                    onClick={handleResendOtp}
                    disabled={isResending}
                  >
                    {isResending ? 'Đang gửi...' : 'Gửi lại mã OTP'}
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="btn-accent auth-submit-btn"
                style={{ marginTop: 'var(--space-4)' }}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <ButtonSpinner />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  'Xác nhận đổi mật khẩu'
                )}
              </button>
            </form>
          )}

          <div className="auth-card-footer" style={{ marginTop: 'var(--space-5)' }}>
            Nhớ lại mật khẩu?{' '}
            <Link to="/login" className="auth-link">
              Đăng nhập ngay
            </Link>
          </div>
        </section>

        {/* Column 3: Security Recommendations Panel (40%) */}
        <section className="auth-card">
          <h2 className="auth-card-title">Lời khuyên bảo mật</h2>
          <p className="auth-card-sub">
            Thiết lập mật khẩu an toàn để bảo vệ quyền riêng tư và giao dịch.
          </p>

          <div className="auth-trust-box">
            <div className="auth-trust-header">
              <i className="ti ti-lock-check" style={{ color: 'var(--color-accent)' }}></i>
              <span>Tiêu chuẩn mật khẩu an toàn</span>
            </div>
            <p className="auth-trust-desc">
              ✓ Độ dài tối thiểu 6-8 ký tự.<br />
              ✓ Kết hợp chữ hoa, chữ thường và chữ số.<br />
              ✓ Không sử dụng thông tin dễ đoán như ngày sinh, số điện thoại.<br />
              ✓ Tuyệt đối không chia sẻ mã xác thực OTP với người khác.
            </p>
          </div>

          <Link
            to="/login"
            className="btn-dark auth-submit-btn"
            style={{ textAlign: 'center', display: 'block', textDecoration: 'none' }}
          >
            Quay lại trang Đăng nhập ➔
          </Link>

          <div className="auth-card-note">
            Hệ thống tự động khóa tạm thời nếu nhập sai OTP quá nhiều lần liên tiếp.
          </div>
        </section>
      </div>
    </div>
  );
};

export default ForgotPassword;
