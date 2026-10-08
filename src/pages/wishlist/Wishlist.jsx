import { Link } from 'react-router-dom';
import { useWishlist } from '../../context/WishlistContext';
import ProductCard from '../../components/product/ProductCard';

const Wishlist = () => {
  const { wishlist } = useWishlist();

  return (
    <div style={{ maxWidth: '1200px', margin: '40px auto', padding: '0 24px' }}>
      <h1 style={{ marginBottom: '24px' }}>Danh sách yêu thích ({wishlist.length})</h1>
      {wishlist.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--color-bg-white)', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❤️</div>
          <h2 style={{ marginBottom: '12px' }}>Chưa có sản phẩm yêu thích</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: '24px' }}>Hãy thêm sản phẩm vào danh sách yêu thích để dễ dàng theo dõi.</p>
          <Link to="/products" className="btn-primary" style={{ padding: '10px 20px', textDecoration: 'none' }}>Khám phá ngay</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
          {wishlist.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
