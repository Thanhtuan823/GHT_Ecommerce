import { createContext, useContext, useState, useEffect } from 'react';
import axiosClient from '../utils/axiosClient';
import { useAuth } from './AuthContext';

const WishlistContext = createContext();

export const useWishlist = () => useContext(WishlistContext);

export const WishlistProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [wishlist, setWishlist] = useState([]);

  const getGuestWishlist = () => {
    try {
      const data = localStorage.getItem('ght_guest_wishlist');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const setGuestWishlist = (items) => {
    localStorage.setItem('ght_guest_wishlist', JSON.stringify(items));
    setWishlist(items);
  };

  const fetchWishlist = async () => {
    if (token) {
      try {
        const res = await axiosClient.get('/users/wishlist');
        setWishlist(res.data.products);
      } catch (err) {
        console.error('Lỗi lấy wishlist', err);
      }
    } else {
      setWishlist(getGuestWishlist());
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [token]);

  const toggleWishlist = async (product) => {
    if (token) {
      try {
        const res = await axiosClient.post('/users/wishlist', { productId: product.id });
        if (res.data.wishlisted) {
          setWishlist([...wishlist, {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: product.price,
            inStock: product.inStock,
            image: product.images?.[0] || '/images/premium.png'
          }]);
        } else {
          setWishlist(wishlist.filter(w => w.id !== product.id));
        }
        return res.data.wishlisted;
      } catch (err) {
        console.error('Lỗi toggle wishlist', err);
        return false;
      }
    } else {
      let items = getGuestWishlist();
      const exists = items.some(w => w.id === product.id);
      if (exists) {
        items = items.filter(w => w.id !== product.id);
        setGuestWishlist(items);
        return false;
      } else {
        items.push({
          id: product.id,
          name: product.name,
          slug: product.slug,
          price: product.price,
          inStock: product.inStock,
          image: product.images?.[0] || '/images/premium.png'
        });
        setGuestWishlist(items);
        return true;
      }
    }
  };

  const syncWishlist = async () => {
    const items = getGuestWishlist();
    if (items.length === 0) return;

    for (const item of items) {
      try {
        await axiosClient.post('/users/wishlist', { productId: item.id });
      } catch (e) {
        console.error('Lỗi sync wishlist', e);
      }
    }
    localStorage.removeItem('ght_guest_wishlist');
    fetchWishlist();
  };

  return (
    <WishlistContext.Provider value={{ wishlist, toggleWishlist, syncWishlist, fetchWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};
