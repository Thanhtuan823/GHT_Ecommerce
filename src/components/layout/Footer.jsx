import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Left: Branding & Tagline */}
        <div className="footer-left">
          <div className="footer-brand-header">
            <img
              src="/images/logo_GHT_tron.jpg"
              alt="GHT E-Commerce Logo"
              className="footer-logo-img"
            />
            <span className="footer-logo">GHT_Ecom</span>
          </div>
          <span className="footer-tagline">Công nghệ phù hợp. Trải nghiệm an tâm.</span>
        </div>

        {/* Center: Hotline & Email */}
        <div className="footer-center">
          <span>Hỗ trợ: </span>
          <span className="footer-hotline">1900 6789</span>
          <span> • support@ght.vn</span>
        </div>

        {/* Right: Policy Links */}
        <div className="footer-right">
          <Link to="/policy/warranty" className="footer-link">
            Chính sách bảo hành
          </Link>
          <span className="footer-divider">/</span>
          <Link to="/policy/shipping" className="footer-link">
            Giao hàng & đổi trả
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
