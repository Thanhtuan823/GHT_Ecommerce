import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import axiosClient from '../utils/axiosClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const getStoredToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(getStoredToken);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await axiosClient.get('/users/profile');
      if (res.data) {
        setUser((prev) => ({
          ...(prev || {}),
          ...res.data
        }));
      }
    } catch (err) {
      console.error('Lỗi tải thông tin user', err);
    }
  }, []);

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Check expiry (in seconds)
        if (decoded.exp * 1000 < Date.now()) {
          logout();
        } else {
          setUser({
            id: decoded.nameid || decoded.sub,
            email: decoded.email,
            name: decoded.unique_name || decoded.name,
            role: decoded.role || decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'],
            avatar: decoded.avatar
          });
          // Đồng bộ thông tin chi tiết (Phone, DefaultAddress, v.v.)
          fetchProfile();
        }
      } catch (err) {
        logout();
      }
    } else {
      setUser(null);
    }
    setIsLoading(false);
  }, [token, fetchProfile]);

  const login = (newToken, remember = true) => {
    if (remember) {
      localStorage.setItem('token', newToken);
      sessionStorage.removeItem('token');
    } else {
      sessionStorage.setItem('token', newToken);
      localStorage.removeItem('token');
    }
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setIsProfileModalOpen(false);
  };

  const updateUser = (data) => {
    setUser((prev) => ({
      ...(prev || {}),
      ...data
    }));
  };

  const [isVouchersModalOpen, setIsVouchersModalOpen] = useState(false);
  const [voucherModalOptions, setVoucherModalOptions] = useState({});
  const openProfileModal = useCallback(() => setIsProfileModalOpen(true), []);
  const closeProfileModal = useCallback(() => setIsProfileModalOpen(false), []);

  const openVouchersModal = useCallback((options = {}) => {
    setVoucherModalOptions(options);
    setIsVouchersModalOpen(true);
  }, []);
  const closeVouchersModal = useCallback(() => {
    setIsVouchersModalOpen(false);
    setVoucherModalOptions({});
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isLoading,
        isProfileModalOpen,
        openProfileModal,
        closeProfileModal,
        isVouchersModalOpen,
        voucherModalOptions,
        openVouchersModal,
        closeVouchersModal,
        updateUser,
        fetchProfile
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
