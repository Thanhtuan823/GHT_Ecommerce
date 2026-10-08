import { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../utils/axiosClient';
import { useAuth } from './AuthContext';
import { useToast } from '../components/common/ToastContext';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const { user, token } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState({ items: [], totalPrice: 0 });
  const [cartCount, setCartCount] = useState(0);

  const getGuestCart = () => {
    try {
      const data = localStorage.getItem('ght_guest_cart');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const setGuestCart = (items) => {
    localStorage.setItem('ght_guest_cart', JSON.stringify(items));
    // Calculate total price based on items (assuming we don't have accurate price without fetching, but we can store it or calculate later)
    const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setCart({ items, totalPrice });
    setCartCount(items.reduce((sum, item) => sum + item.quantity, 0));
  };

  const fetchCart = async () => {
    if (token) {
      try {
        const res = await axiosClient.get('/cart');
        setCart(res.data);
        setCartCount(res.data.items.reduce((sum, item) => sum + item.quantity, 0));
      } catch (err) {
        console.error('Lỗi lấy giỏ hàng', err);
      }
    } else {
      const items = getGuestCart();
      setGuestCart(items);
    }
  };

  useEffect(() => {
    fetchCart();
  }, [token]);

  const addToCart = async (product, quantity = 1) => {
    if (token) {
      try {
        const res = await axiosClient.post('/cart/add', { productId: product.id, quantity });
        setCart(res.data);
        setCartCount(res.data.items.reduce((sum, item) => sum + item.quantity, 0));
        return true;
      } catch (err) {
        toast.error(err.response?.data?.message || 'Lỗi thêm vào giỏ hàng');
        return false;
      }
    } else {
      let items = getGuestCart();
      const existing = items.find(i => i.productId === product.id);
      if (existing) {
        existing.quantity += quantity;
      } else {
        items.push({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          price: product.price,
          inStock: product.inStock,
          image: product.images?.[0] || '/images/premium.png',
          quantity
        });
      }
      setGuestCart(items);
      return true;
    }
  };

  const removeFromCart = async (productId) => {
    if (token) {
      try {
        const res = await axiosClient.delete(`/cart/${productId}`);
        setCart(res.data);
        setCartCount(res.data.items.reduce((sum, item) => sum + item.quantity, 0));
      } catch (err) {
        console.error('Lỗi xóa sản phẩm', err);
      }
    } else {
      let items = getGuestCart();
      items = items.filter(i => i.productId !== productId);
      setGuestCart(items);
    }
  };

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) {
      return removeFromCart(productId);
    }
    // For API, we might need a separate PUT endpoint or just call add with difference.
    // Our API only has POST /cart/add (which increments). It lacks PUT /cart/{id}.
    // Wait, flow docs Task 3 says: `PUT /api/cart/{itemId}`: Cập nhật số lượng.
    // Let me add `PUT /api/cart/{productId}` in CartController!
    if (token) {
      try {
        const res = await axiosClient.put(`/cart/${productId}`, { quantity });
        setCart(res.data);
        setCartCount(res.data.items.reduce((sum, item) => sum + item.quantity, 0));
      } catch (err) {
        toast.error(err.response?.data?.message || 'Lỗi cập nhật số lượng');
      }
    } else {
      let items = getGuestCart();
      const existing = items.find(i => i.productId === productId);
      if (existing) {
        existing.quantity = quantity;
      }
      setGuestCart(items);
    }
  };

  const syncCart = async () => {
    const items = getGuestCart();
    if (items.length === 0) return;

    try {
      const payload = {
        items: items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      };
      // We pass the token automatically via axiosClient interceptor
      const res = await axiosClient.post('/cart/sync', payload);
      setCart(res.data);
      setCartCount(res.data.items.reduce((sum, item) => sum + item.quantity, 0));
      localStorage.removeItem('ght_guest_cart');
    } catch (err) {
      console.error('Lỗi đồng bộ giỏ hàng', err);
    }
  };

  return (
    <CartContext.Provider value={{ cart, cartCount, addToCart, removeFromCart, updateQuantity, syncCart, fetchCart }}>
      {children}
    </CartContext.Provider>
  );
};
