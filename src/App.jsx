import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ProductList from './pages/products/ProductList';
import ProductDetail from './pages/products/ProductDetail';
import AdminProducts from './pages/admin/Products';
import AdminDashboard from './pages/admin/Dashboard';
import AdminDiscounts from './pages/admin/Discounts';
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

// Helper component to open modal if user visits /profile directly
const ProfileRouteRedirect = () => {
  const { openProfileModal } = useAuth();
  useEffect(() => {
    openProfileModal();
  }, [openProfileModal]);
  return <Navigate to="/" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CartProvider>
            <WishlistProvider>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Navigate to="/products" replace />} />
                  <Route path="login" element={<Login />} />
                  <Route path="register" element={<Register />} />
                  
                  <Route path="products" element={<ProductList />} />
                  <Route path="products/:slug" element={<ProductDetail />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="wishlist" element={<Wishlist />} />
                  
                  {/* Protected Routes */}
                  <Route element={<ProtectedRoute />}>
                    <Route path="profile" element={<ProfileRouteRedirect />} />
                    <Route path="checkout" element={<Checkout />} />
                    <Route path="payment/:orderId" element={<Payment />} />
                    <Route path="orders" element={<OrderHistory />} />
                    <Route path="orders/:id" element={<OrderDetail />} />
                  </Route>

                  {/* Staff Operations Route */}
                  <Route element={<ProtectedRoute allowedRoles={['Admin', 'Staff']} />}>
                    <Route path="staff/orders" element={<StaffOrders />} />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>

                {/* Admin Routes with AdminLayout */}
                <Route element={<ProtectedRoute allowedRoles={['Admin', 'Staff']} />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="dashboard" replace />} />
                    <Route path="dashboard" element={<AdminDashboard />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="discounts" element={<AdminDiscounts />} />
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
