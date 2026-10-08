import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import Profile from './pages/profile/Profile';
import ProductList from './pages/products/ProductList';
import ProductDetail from './pages/products/ProductDetail';
import AdminProducts from './pages/admin/Products';
import Cart from './pages/cart/Cart';
import Wishlist from './pages/wishlist/Wishlist';
import Checkout from './pages/checkout/Checkout';
import Payment from './pages/checkout/Payment';
import OrderHistory from './pages/orders/OrderHistory';
import OrderDetail from './pages/orders/OrderDetail';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <Routes>
              <Route path="/" element={<MainLayout />}>
            <Route index element={<div style={{ textAlign: 'center', marginTop: '80px' }}><h1 style={{ color: 'var(--color-accent)', fontSize: '32px' }}>Trang chủ GHT_Ecom</h1><p style={{ color: 'var(--color-text-secondary)' }}>Hệ thống thương mại điện tử</p></div>} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            
            <Route path="products" element={<ProductList />} />
            <Route path="products/:slug" element={<ProductDetail />} />
            <Route path="cart" element={<Cart />} />
            <Route path="wishlist" element={<Wishlist />} />
            
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="profile" element={<Profile />} />
              <Route path="checkout" element={<Checkout />} />
              <Route path="payment/:orderId" element={<Payment />} />
              <Route path="orders" element={<OrderHistory />} />
              <Route path="orders/:id" element={<OrderDetail />} />
            </Route>

            {/* Admin/Staff Routes */}
            <Route element={<ProtectedRoute allowedRoles={['Admin', 'Staff']} />}>
              <Route path="admin" element={<Navigate to="/admin/products" replace />} />
              <Route path="admin/products" element={<AdminProducts />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
            </Routes>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
