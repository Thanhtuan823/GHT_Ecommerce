import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import './Cart.css';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const { openVouchersModal } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const items = cart?.items || [];

  // Selection state for items (default all selected)
  const [selectedProductIds, setSelectedProductIds] = useState(() =>
    items.map((it) => it.productId)
  );

  // Sync selection when cart items change
  const isAllSelected = items.length > 0 && items.every((it) => selectedProductIds.includes(it.productId));

  const handleToggleAll = () => {
    if (isAllSelected) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(items.map((it) => it.productId));
    }
  };

  const handleToggleItem = (productId) => {
    setSelectedProductIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectedItems = useMemo(() => {
    return items.filter((it) => selectedProductIds.includes(it.productId));
  }, [items, selectedProductIds]);

  const totalPrice = useMemo(() => {
    return selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [selectedItems]);

  const handleCheckout = () => {
    if (selectedItems.length === 0) {
      toast.error('Vui lòng chọn ít nhất một sản phẩm để thanh toán');
      return;
    }

    const outOfStockItems = selectedItems.filter((item) => item.inStock !== undefined && item.inStock < item.quantity);
    if (outOfStockItems.length > 0) {
      toast.error(
        `Sản phẩm "${outOfStockItems[0].productName}" không đủ số lượng tồn kho (còn ${outOfStockItems[0].inStock}). Vui lòng điều chỉnh lại.`
      );
      return;
    }

    navigate('/checkout');
  };

  const handleCopyCode = async () => {
    const code = 'GHTSALE10';
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback cho HTTP hoặc IP local
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast.success('Đã sao chép mã GHTSALE10!');
    } catch {
      toast.error('Không thể sao chép, vui lòng copy thủ công: GHTSALE10');
    }
  };

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  if (items.length === 0) {
    return (
      <div className="cart-page-wrapper">
        <nav className="cart-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Trang chủ</Link>
          <span>/</span>
          <span>Giỏ hàng</span>
        </nav>

        <div className="cart-empty-state">
          <div className="cart-empty-icon"><i className="ti ti-shopping-cart"></i></div>
          <h2 className="cart-empty-title">Giỏ hàng của bạn đang trống</h2>
          <p className="cart-empty-desc">
            Khám phá các thiết bị công nghệ chính hãng và thêm sản phẩm yêu thích vào giỏ hàng.
          </p>
          <Link to="/products" className="btn-primary">
            Khám phá sản phẩm →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page-wrapper">
      {/* Breadcrumb */}
      <nav className="cart-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <span>Giỏ hàng</span>
      </nav>

      {/* Header Row */}
      <div className="cart-header-row">
        <div className="cart-title-box">
          <h1>Giỏ hàng của bạn</h1>
          <p>
            {items.length} sản phẩm • Sẵn sàng cho ngày làm việc mới
          </p>
        </div>

        <Link to="/products" className="btn-ghost">
          ← Tiếp tục mua sắm
        </Link>
      </div>

      {/* 2-Column Body Layout (65% / 35%) */}
      <div className="cart-body-layout">
        {/* Left Column: Items List Card */}
        <div className="cart-items-card">
          <div className="cart-list-header">
            <label className="cart-select-all-label">
              <input
                type="checkbox"
                className="cart-custom-checkbox"
                checked={isAllSelected}
                onChange={handleToggleAll}
              />
              <span>Chọn tất cả ({items.length})</span>
            </label>

            <div className="cart-table-columns-legend">
              <span>Đơn giá</span>
              <span>Số lượng</span>
              <span>Thành tiền</span>
            </div>
          </div>

          <div className="cart-items-body">
            {items.map((item) => {
              const isChecked = selectedProductIds.includes(item.productId);
              const inStock = item.inStock ?? 24;
              const isOut = inStock <= 0;
              const itemSubtotal = item.price * item.quantity;
              const specsText = item.specsLine || (item.brand ? `${item.brand} • Chính hãng` : 'Chính hãng • Bảo hành 24T');

              return (
                <div key={item.productId} className="cart-item-row">
                  <div className="cart-item-checkbox">
                    <input
                      type="checkbox"
                      className="cart-custom-checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleItem(item.productId)}
                    />
                  </div>

                  <div className="cart-item-image-wrapper">
                    <img
                      src={item.image || '/images/premium.png'}
                      alt={item.productName}
                      className="cart-item-image"
                    />
                  </div>

                  <div className="cart-item-details">
                    <Link
                      to={`/products/${item.productSlug || item.productId}`}
                      className="cart-item-title"
                      title={item.productName}
                    >
                      {item.productName}
                    </Link>
                    <span className="cart-item-specs">{specsText}</span>
                    <span className={`cart-item-stock-badge ${isOut ? 'is-out' : ''}`}>
                      {isOut ? 'Tạm hết hàng' : 'Còn hàng'}
                    </span>
                  </div>

                  <div className="cart-item-unit-price">
                    {formatPrice(item.price)}
                  </div>

                  <div className="cart-stepper-box">
                    <button
                      type="button"
                      className="cart-stepper-btn"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="Giảm số lượng"
                    >
                      –
                    </button>
                    <input
                      type="text"
                      className="cart-stepper-input"
                      value={item.quantity}
                      readOnly
                    />
                    <button
                      type="button"
                      className="cart-stepper-btn"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= inStock}
                      aria-label="Tăng số lượng"
                    >
                      +
                    </button>
                  </div>

                  <div className="cart-item-subtotal-column">
                    <span className="cart-item-subtotal">
                      {formatPrice(itemSubtotal)}
                    </span>
                    <button
                      type="button"
                      className="cart-item-remove-btn"
                      onClick={() => removeFromCart(item.productId)}
                    >
                      Xóa sản phẩm
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Sticky Summary (top: 80px) */}
        <aside className="cart-sticky-summary">
          <h2 className="cart-summary-title">Tóm tắt đơn hàng</h2>

          <div className="cart-summary-row">
            <span>Tổng tiền gốc</span>
            <span>{formatPrice(totalPrice)}</span>
          </div>

          <div className="cart-summary-row">
            <span>Vận chuyển GHN</span>
            <span className="cart-summary-value-free">Miễn phí</span>
          </div>

          <div className="cart-summary-divider" />

          <div className="cart-summary-total-row">
            <span className="cart-summary-total-label">Tổng thanh toán</span>
            <span className="cart-summary-total-amount">
              {formatPrice(totalPrice)}
            </span>
          </div>

          <p className="cart-summary-subnote">
            Đã bao gồm VAT. Miễn phí giao hàng toàn quốc qua GHN cho đơn từ 5.000.000đ.
          </p>

          <button
            type="button"
            className="btn-primary cart-checkout-btn"
            onClick={handleCheckout}
            disabled={selectedItems.length === 0}
          >
            Thanh toán ({selectedItems.length} sản phẩm)
          </button>

          <div className="cart-voucher-banner-btn-box" style={{ marginTop: '12px', marginBottom: '8px' }}>
            <button
              id="cart-open-vouchers-btn"
              type="button"
              className="btn-ghost"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                borderColor: 'var(--color-primary, #2563eb)',
                color: 'var(--color-primary, #2563eb)',
                fontWeight: '600',
                padding: '10px 14px',
                borderRadius: '8px'
              }}
              onClick={() => openVouchersModal({
                currentOrderAmount: totalPrice,
                onApply: (selectedCode) => {
                  toast.success(`Đã chọn mã ${selectedCode}! Tiến hành thanh toán để áp dụng.`);
                  handleCheckout();
                }
              })}
            >
              <i className="ti ti-ticket"></i>
              <span>🎟️ Chọn mã ưu đãi</span>
            </button>
          </div>

          <p className="cart-discount-hint">
            Bạn có thể áp mã giảm giá ở bước này hoặc thanh toán.
          </p>

          <div className="cart-trust-note">
            <i className="ti ti-lock"></i>
            <span>Thanh toán bảo mật qua chuyển khoản ngân hàng.</span>
          </div>
        </aside>
      </div>

      {/* Bottom Extra Sections */}
      <div className="cart-extra-sections">
        {/* Section: Mua sắm an tâm */}
        <section className="cart-trust-box-section">
          <div className="cart-trust-box-header">
            <i className="ti ti-shield-check"></i>
            <span>Mua sắm an tâm cùng GHT</span>
          </div>
          <p className="cart-trust-box-desc">
            Mọi sản phẩm được bảo hành chính hãng 24 tháng, hỗ trợ 1 đổi 1 trong 7 ngày đầu nếu phát sinh lỗi từ nhà sản xuất.
          </p>
          <a href="#shipping-policy" className="cart-trust-box-link">
            ✓ Miễn phí giao hàng GHN cho đơn từ 5.000.000đ
          </a>
        </section>

        {/* Section: Đừng bỏ lỡ ưu đãi */}
        <section className="cart-promo-voucher-box">
          <div className="cart-promo-text">
            <h3>Đừng bỏ lỡ ưu đãi cho đơn hàng này</h3>
            <p>Mã <strong>GHTSALE10</strong> giảm 10%, tối đa 500.000đ • Áp dụng cho đơn từ 1.000.000đ</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => openVouchersModal({
                currentOrderAmount: selectedTotal,
                onApply: (code) => {
                  toast.success(`Đã chọn mã ${code}! Đang chuyển đến trang thanh toán...`);
                  navigate('/checkout');
                }
              })}
              style={{
                borderColor: '#2563eb',
                color: '#2563eb',
                fontWeight: '600'
              }}
            >
              <i className="ti ti-ticket"></i> 🎟️ Chọn mã ưu đãi
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleCopyCode}
            >
              <i className="ti ti-copy"></i> Sao chép mã
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Cart;
