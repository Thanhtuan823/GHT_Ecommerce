import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/common/ToastContext';
import './Cart.css';

const Cart = () => {
  const { cart, removeFromCart, updateQuantity } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  const handleCheckout = () => {
    const outOfStockItems = cart.items.filter(item => item.inStock < item.quantity);
    if (outOfStockItems.length > 0) {
      toast.error(`Sản phẩm ${outOfStockItems[0].productName} không đủ hàng (chỉ còn ${outOfStockItems[0].inStock}). Vui lòng điều chỉnh lại.`);
      return;
    }
    navigate('/checkout');
  };

  if (!cart.items || cart.items.length === 0) {
    return (
      <div className="cart-empty">
        <div className="ti-shopping-cart" style={{ fontSize: '64px', color: 'var(--color-text-disabled)', marginBottom: '16px' }}></div>
        <h2>Giỏ hàng trống</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>Bạn chưa có sản phẩm nào trong giỏ hàng.</p>
        <Link to="/products" className="btn-primary">Khám phá sản phẩm →</Link>
      </div>
    );
  }

  const totalPrice = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="cart-page">
      <h1 style={{ fontSize: '24px', marginBottom: '24px' }}>Giỏ hàng của bạn</h1>
      
      <div className="cart-container">
        <div className="cart-items">
          {cart.items.map(item => (
            <div key={item.productId} className="cart-item">
              <img src={item.image} alt={item.productName} className="cart-item-image" />
              <div className="cart-item-info">
                <Link to={`/products/${item.productSlug}`} className="cart-item-name">{item.productName}</Link>
                <div className="cart-item-price">{new Intl.NumberFormat('vi-VN').format(item.price)} đ</div>
                {item.inStock < item.quantity && (
                  <div style={{ color: 'var(--color-danger)', fontSize: '12px', marginTop: '4px' }}>
                    Chỉ còn {item.inStock} sản phẩm
                  </div>
                )}
              </div>
              <div className="cart-item-actions">
                <div className="quantity-control">
                  <button onClick={() => updateQuantity(item.productId, item.quantity - 1)}>-</button>
                  <input type="number" value={item.quantity} readOnly />
                  <button onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={item.quantity >= item.inStock}>+</button>
                </div>
                <button className="btn-remove" onClick={() => removeFromCart(item.productId)}>Xóa</button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="cart-summary">
          <h3>Tóm tắt đơn hàng</h3>
          <div className="summary-row">
            <span>Tạm tính</span>
            <strong>{new Intl.NumberFormat('vi-VN').format(totalPrice)} đ</strong>
          </div>
          <div className="summary-row">
            <span>Giảm giá</span>
            <strong>0 đ</strong>
          </div>
          <div className="summary-total">
            <span>Tổng cộng</span>
            <strong>{new Intl.NumberFormat('vi-VN').format(totalPrice)} đ</strong>
          </div>
          <button className="btn-primary" style={{ width: '100%', padding: '14px', fontSize: '16px' }} onClick={handleCheckout}>
            TIẾN HÀNH THANH TOÁN
          </button>
          <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '12px' }}>
            Phí vận chuyển sẽ được tính ở bước thanh toán.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Cart;
