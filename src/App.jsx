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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<div style={{ textAlign: 'center', marginTop: '80px' }}><h1 style={{ color: 'var(--color-accent)', fontSize: '32px' }}>Trang chủ GHT_Ecom</h1><p style={{ color: 'var(--color-text-secondary)' }}>Hệ thống thương mại điện tử</p></div>} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />
            
            <Route path="products" element={<ProductList />} />
            <Route path="products/:slug" element={<ProductDetail />} />
            
            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="profile" element={<Profile />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
