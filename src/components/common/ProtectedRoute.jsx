import { useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from './ToastContext';

const ProtectedRoute = ({ allowedRoles }) => {
  const { user } = useAuth();
  const toast = useToast();
  const hasNotifiedRef = useRef(false);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (!hasNotifiedRef.current) {
      hasNotifiedRef.current = true;
      toast?.warning?.('Bạn đang đăng nhập bằng tài khoản quản trị/nhân sự.');
    }
    if (user.role === 'Admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    if (user.role === 'Staff') {
      return <Navigate to="/staff/orders" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
