import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import axiosClient from '../../utils/axiosClient';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import './Register.css';

const Register = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const toast = useToast();

  // Step 1: Đăng ký thông tin, Step 2: Nhập OTP kích hoạt
  const [step, setStep] = useState(location.state?.step || 1);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(location.state?.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // OTP Verification state
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(location.state?.step === 2 ? 60 : 0);
  const [isResending, setIsResending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const [error, setError] = useState(location.state?.notice || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Countdown timer for Resend OTP
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  // Password criteria check
  const criteria = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password)
  };

  const strengthScore = [
    criteria.minLength,
    criteria.hasUpper,
    criteria.hasNumber,
    criteria.hasSpecial
  ].filter(Boolean).length;

  const getStrengthLabel = () => {
    switch (strengthScore) {
      case 1: return { text: 'Yếu', className: 'is-weak' };
      case 2: return { text: 'Trung bình', className: 'is-medium' };
      case 3: return { text: 'Mạnh', className: 'is-good' };
      case 4: return { text: 'Rất mạnh', className: 'is-strong' };
      default: return { text: '', className: '' };
    }
  };

  const getBarClass = (level) => {
    if (strengthScore < level) return '';
    if (strengthScore === 1) return 'bar-danger';
    if (strengthScore === 2) return 'bar-warning';
    if (strengthScore === 3) return 'bar-good';
    return 'bar-strong';
  };

  const handleBlur = (field, value) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (!value) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Trường này không được để trống' }));
    } else if (field === 'email' && !/\S+@\S+\.\S+/.test(value)) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Email không hợp lệ' }));
    } else if (field === 'password' && value.length < 8) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Mật khẩu phải có ít nhất 8 ký tự' }));
    } else if (field === 'confirmPassword' && value !== password) {
      setFieldErrors((prev) => ({ ...prev, [field]: 'Mật khẩu xác nhận không khớp' }));
    } else {
      setFieldErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  // Bước 1: Gửi thông tin Đăng ký
  const handleSubmitRegister = async (e) => {
    e.preventDefault();
    const errors = {};

    if (!name.trim()) errors.name = 'Vui lòng nhập họ và tên';
    if (!email.trim()) errors.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(email.trim())) errors.email = 'Email không hợp lệ';

    if (!password) errors.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 8) errors.password = 'Mật khẩu phải có ít nhất 8 ký tự';

    if (!confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu';
    else if (confirmPassword !== password) errors.confirmPassword = 'Mật khẩu xác nhận không khớp';

    if (!agreeTerms) errors.agreeTerms = 'Bạn phải đồng ý với Điều khoản sử dụng';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouched({ name: true, email: true, password: true, confirmPassword: true, agreeTerms: true });
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password
      });

      if (res.data?.requireVerification) {
        toast?.success ? toast.success(res.data?.message || 'Đăng ký thành công! Vui lòng nhập mã OTP gửi tới email.') : null;
        setStep(2);
        setCountdown(60);
        setError('');
      } else if (res.data?.token) {
        login(res.data.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại, vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bước 2: Xác thực mã OTP kích hoạt tài khoản
  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      setError('Vui lòng nhập mã OTP 6 số');
      return;
    }
    if (otp.trim().length !== 6) {
      setError('Mã OTP phải gồm đúng 6 chữ số');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/verify-email', {
        email: email.trim(),
        otp: otp.trim()
      });

      toast?.success ? toast.success('Kích hoạt tài khoản thành công! Đang chuyển hướng...') : null;
      login(res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Gửi lại mã OTP kích hoạt
  const handleResendOtp = async () => {
    if (countdown > 0 || isResending) return;
    setIsResending(true);
    setError('');

    try {
      const res = await axiosClient.post('/auth/resend-verification-otp', {
        email: email.trim()
      });
      toast?.success ? toast.success(res.data?.message || 'Mã xác thực OTP mới đã được gửi tới email!') : null;
      setCountdown(60);
    } catch (err) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP. Vui lòng thử lại sau.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-3col-layout">
        {/* Column 1: Brand Panel (25%) */}
        <aside className="auth-brand-panel">
          <img
            src="/images/Logo_GHT.png"
            alt="GHT E-Commerce Logo"
            style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', marginBottom: '14px', display: 'block', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.25)' }}
          />
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
              Thông tin tài khoản và dữ liệu cá nhân của bạn được bảo mật tuyệt đối, không chia sẻ cho bên thứ ba.
            </p>
          </div>

          <div className="auth-trust-box">
            <div className="auth-trust-header">
              <i className="ti ti-mail-check auth-trust-icon"></i>
              <span>Xác thực Email thực</span>
            </div>
            <p className="auth-trust-desc">
              Kích hoạt tài khoản bằng mã OTP gửi về hộp thư để nhận thông báo vận chuyển và hóa đơn PDF điện tử tức thì.
            </p>
          </div>

          <div className="auth-support-contact">
            Cần trợ giúp? <a href="mailto:support@ght.vn">support@ght.vn</a>
          </div>
        </aside>

        {/* Column 2: Login Card Preview (35%) */}
        <section className="auth-card">
          <h2 className="auth-card-title">Đã có tài khoản?</h2>
          <p className="auth-card-sub">
            Đăng nhập để tiếp tục theo dõi đơn hàng và giỏ hàng của bạn.
          </p>

          <div className="auth-trust-box">
            <div className="auth-trust-header">
              <span>⚡</span>
              <span>Đồng bộ tức thì</span>
            </div>
            <p className="auth-trust-desc">
              Đăng nhập ngay để tiếp tục mua sắm và nhận thông báo trạng thái đơn hàng thời gian thực.
            </p>
          </div>

          <Link
            to="/login"
            className="btn-ghost auth-submit-btn"
          >
            Đăng nhập ngay ➔
          </Link>
        </section>

        {/* Column 3: Active Card (40%) */}
        <section className="auth-card is-active">
          {step === 1 ? (
            /* ================= BƯỚC 1: FORM ĐĂNG KÝ ================= */
            <>
              <h2 className="auth-card-title">Tạo tài khoản</h2>
              <p className="auth-card-sub">
                Bắt đầu mua sắm và nhận ưu đãi dành riêng cho bạn.
              </p>

              {error && <div className="auth-alert-box">{error}</div>}

              <form onSubmit={handleSubmitRegister} noValidate>
                {/* Row: Họ tên + Số điện thoại */}
                <div className="auth-form-row">
                  <div className="auth-form-group">
                    <label className="auth-label">
                      <span>Họ và tên <span className="auth-required-mark">*</span></span>
                    </label>
                    <div className="auth-input-wrapper">
                      <input
                        type="text"
                        className={`input ${fieldErrors.name ? 'is-error' : (touched.name && name ? 'is-success' : '')}`}
                        placeholder="Nguyễn Văn A"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setFieldErrors((prev) => ({ ...prev, name: null }));
                        }}
                        onBlur={() => handleBlur('name', name)}
                        disabled={isSubmitting}
                      />
                      {touched.name && !fieldErrors.name && name && (
                        <span className="auth-input-icon">✓</span>
                      )}
                    </div>
                    {fieldErrors.name && (
                      <span className="error-message">{fieldErrors.name}</span>
                    )}
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label">
                      <span>Số điện thoại</span>
                    </label>
                    <div className="auth-input-wrapper">
                      <input
                        type="tel"
                        className="input"
                        placeholder="0901 234 567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                {/* Email Field */}
                <div className="auth-form-group">
                  <label className="auth-label">
                    <span>Email <span className="auth-required-mark">*</span></span>
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      type="email"
                      className={`input ${fieldErrors.email ? 'is-error' : (touched.email && email && /\S+@\S+\.\S+/.test(email) ? 'is-success' : '')}`}
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, email: null }));
                      }}
                      onBlur={() => handleBlur('email', email)}
                      disabled={isSubmitting}
                    />
                    {touched.email && !fieldErrors.email && email && /\S+@\S+\.\S+/.test(email) && (
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
                      className={`input ${fieldErrors.password ? 'is-error' : (touched.password && criteria.minLength ? 'is-success' : '')}`}
                      placeholder="Ít nhất 8 ký tự"
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

                  {/* Password Strength 4-Bar */}
                  <div className="password-strength-container">
                    <div className="password-strength-bars">
                      <div className={`password-strength-bar ${getBarClass(1)}`} />
                      <div className={`password-strength-bar ${getBarClass(2)}`} />
                      <div className={`password-strength-bar ${getBarClass(3)}`} />
                      <div className={`password-strength-bar ${getBarClass(4)}`} />
                    </div>
                    {password && (
                      <div className={`password-strength-label ${getStrengthLabel().className}`}>
                        {getStrengthLabel().text}
                      </div>
                    )}

                    {/* 4-Criteria Checklist */}
                    <div className="password-checklist">
                      <span className={`password-check-item ${criteria.minLength ? 'is-valid' : ''}`}>
                        {criteria.minLength ? '✓' : '○'} Ít nhất 8 ký tự
                      </span>
                      <span className={`password-check-item ${criteria.hasUpper ? 'is-valid' : ''}`}>
                        {criteria.hasUpper ? '✓' : '○'} Chữ hoa
                      </span>
                      <span className={`password-check-item ${criteria.hasNumber ? 'is-valid' : ''}`}>
                        {criteria.hasNumber ? '✓' : '○'} Chữ số
                      </span>
                      <span className={`password-check-item ${criteria.hasSpecial ? 'is-valid' : ''}`}>
                        {criteria.hasSpecial ? '✓' : '○'} Ký tự đặc biệt
                      </span>
                    </div>
                  </div>
                </div>

                {/* Confirm Password Field */}
                <div className="auth-form-group">
                  <label className="auth-label">
                    <span>Nhập lại mật khẩu <span className="auth-required-mark">*</span></span>
                  </label>
                  <div className="auth-input-wrapper">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`input ${fieldErrors.confirmPassword ? 'is-error' : (touched.confirmPassword && confirmPassword && confirmPassword === password ? 'is-success' : '')}`}
                      placeholder="Nhập lại mật khẩu"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setFieldErrors((prev) => ({ ...prev, confirmPassword: null }));
                      }}
                      onBlur={() => handleBlur('confirmPassword', confirmPassword)}
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
                  {fieldErrors.confirmPassword && (
                    <span className="error-message">{fieldErrors.confirmPassword}</span>
                  )}
                </div>

                {/* Terms and Conditions Checkbox */}
                <div className="auth-form-group">
                  <label className="auth-checkbox-label">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => {
                        setAgreeTerms(e.target.checked);
                        setFieldErrors((prev) => ({ ...prev, agreeTerms: null }));
                      }}
                      disabled={isSubmitting}
                    />
                    <span>
                      Tôi đồng ý với{' '}
                      <Link to="/terms" className="auth-link">Điều khoản sử dụng</Link> và{' '}
                      <Link to="/privacy" className="auth-link">Chính sách bảo mật</Link> của GHT.
                    </span>
                  </label>
                  {fieldErrors.agreeTerms && (
                    <span className="error-message">{fieldErrors.agreeTerms}</span>
                  )}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="btn-primary auth-submit-btn"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <ButtonSpinner /> Đang tạo tài khoản...
                    </>
                  ) : (
                    'Tạo tài khoản'
                  )}
                </button>
              </form>

              <div className="auth-card-note">
                Không gửi thư rác. Bạn có thể huỷ nhận thông tin bất cứ lúc nào.
              </div>
            </>
          ) : (
            /* ================= BƯỚC 2: XÁC THỰC EMAIL OTP ================= */
            <>
              <h2 className="auth-card-title">Xác thực địa chỉ Email</h2>
              <p className="auth-card-sub">
                Nhập mã OTP 6 chữ số đã được gửi tới email để kích hoạt tài khoản.
              </p>

              {error && <div className="auth-alert-box">{error}</div>}

              <form onSubmit={handleVerifyEmail} noValidate>
                <div className="auth-info-banner">
                  <i className="ti ti-mail-check"></i>
                  <div>
                    Mã xác thực đã được gửi đến <strong>{email}</strong>.{' '}
                    <button
                      type="button"
                      className="auth-resend-btn"
                      onClick={() => {
                        setStep(1);
                        setError('');
                      }}
                      style={{ textDecoration: 'underline', marginLeft: '4px' }}
                    >
                      Đổi thông tin
                    </button>
                  </div>
                </div>

                {/* Ô nhập OTP 6 số căn giữa to rõ */}
                <div className="auth-form-group">
                  <label className="auth-label">
                    <span>Mã xác thực OTP (6 số) <span className="auth-required-mark">*</span></span>
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
                      disabled={isVerifying}
                      autoFocus
                    />
                  </div>
                </div>

                {/* Nút gửi lại mã và đếm ngược 60s */}
                <div className="auth-resend-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
                    Chưa nhận được mã?
                  </span>
                  <button
                    type="button"
                    className="auth-resend-btn"
                    disabled={countdown > 0 || isResending}
                    onClick={handleResendOtp}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: countdown > 0 ? 'var(--color-text-muted)' : 'var(--color-primary, #2563eb)',
                      fontWeight: '600',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    {isResending ? (
                      'Đang gửi lại...'
                    ) : countdown > 0 ? (
                      `Gửi lại mã OTP (${countdown}s)`
                    ) : (
                      'Gửi lại mã OTP'
                    )}
                  </button>
                </div>

                {/* Nút kích hoạt tài khoản */}
                <button
                  type="submit"
                  className="btn-primary auth-submit-btn"
                  disabled={isVerifying || otp.trim().length !== 6}
                >
                  {isVerifying ? (
                    <>
                      <ButtonSpinner /> <span>Đang kích hoạt tài khoản...</span>
                    </>
                  ) : (
                    'Kích hoạt tài khoản ➔'
                  )}
                </button>
              </form>

              <div className="auth-card-note">
                Mã xác thực có hiệu lực trong vòng 10 phút. Vui lòng kiểm tra kỹ cả thư mục Hộp thư đến và Thư rác (Spam).
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Register;
