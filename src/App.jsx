import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import ProductList from './pages/products/ProductList';
import ProductDetail from './pages/products/ProductDetail';
import AdminProducts from './pages/admin/Products';
import AdminDashboard from './pages/admin/Dashboard';
import AdminDiscounts from './pages/admin/Discounts';
import AdminUsers from './pages/admin/Users';
import Cart from './pages/cart/Cart';
import Wishlist from './pages/wishlist/Wishlist';
import Checkout from './pages/checkout/Checkout';
import Payment from './pages/checkout/Payment';
import FloatingChatbot from './components/chat/FloatingChatbot';
import ProfileModal from './components/profile/ProfileModal';
import OrderHistory from './pages/orders/OrderHistory';
import OrderDetail from './pages/orders/OrderDetail';
import StaffOrders from './pages/staff/StaffOrders';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ToastProvider } from './components/common/ToastContext';

// Helper redirect on /profile
const ProfileRouteRedirect = () => {
  const { openProfileModal } = useAuth();
  useEffect(() => {
    openProfileModal();
  }, [openProfileModal]);
  return <Navigate to="/" replace />;
};

// Helper redirect on /admin root based on role
const AdminIndexRedirect = () => {
  const { user } = useAuth();
  if (user?.role === 'Staff') {
    return <Navigate to="/staff/orders" replace />;
  }
  return <Navigate to="/admin/dashboard" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Routes>
                {/* Customer & Public Facing Routes */}
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Navigate to="/products" replace />} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  <Route path="forgot-password" element={<ForgotPassword />} />
                  
                  <Route path="products" element={<ProductList />} />
                  <Route path="products/:slug" element={<ProductDetail />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="wishlist" element={<Wishlist />} />
                  
                  {/* Protected Customer Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="profile" element={<ProfileRouteRedirect />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="payment/:orderId" element={<Payment />} />
                    <Route path="orders" element={<OrderHistory />} />
                    <Route path="orders/:id" element={<OrderDetail />} />
                  </Route>

                  {/* Fallback for public layout */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>

                {/* Operations & Admin Unified Shell (AdminLayout) */}
                <Route element={<ProtectedRoute allowedRoles={['Admin', 'Staff']} />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminIndexRedirect />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="discounts" element={<AdminDiscounts />} />
                    <Route path="users" element={<AdminUsers />} />
                  </Route>
                  {/* Staff Route under AdminLayout Shell */}
                  <Route path="/staff" element={<AdminLayout />}>
                    <Route index element={<Navigate to="orders" replace />} />
                    <Route path="orders" element={<StaffOrders />} />
                  </Route>
                </Route>
              </Routes>
              <FloatingChatbot />
              <ProfileModal />
            </WishlistProvider>
          </CartProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
