import { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import axiosClient from '../utils/axiosClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
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

  const login = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
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

  const openProfileModal = () => setIsProfileModalOpen(true);
  const closeProfileModal = () => setIsProfileModalOpen(false);

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
        updateUser,
        fetchProfile
      }}
    >
      {!isLoading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
