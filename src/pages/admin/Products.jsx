import { useState, useEffect, useCallback, useTransition } from 'react';
import { useSearchParams } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/common/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import ButtonSpinner from '../../components/common/ButtonSpinner';
import { PRODUCT_TAGS, getTagLabel, getTagColor } from '../../utils/tagHelper';
import './AdminProducts.css';

export default function AdminProducts() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startTransition] = useTransition();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('ALL'); // 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

  // Modal create/edit
  const [showForm, setShowForm] = useState(false);

  const handleCloseForm = () => {
    setShowForm(false);
    if (searchParams.get('editId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('editId');
      setSearchParams(newParams, { replace: true });
    }
  };
  const [formData, setFormData] = useState(initialFormState());
  const [customTagInput, setCustomTagInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [productToDelete, setProductToDelete] = useState(null);

  // Quick Category creation (Admin only)
  const isAdmin = user?.role === 'Admin';
  const [showQuickCatModal, setShowQuickCatModal] = useState(false);
  const [quickCatForm, setQuickCatForm] = useState({ name: '', description: '' });
  const [isSavingQuickCat, setIsSavingQuickCat] = useState(false);
  const [quickCatError, setQuickCatError] = useState('');

  const handleCreateQuickCategory = async (e) => {
    if (e) e.preventDefault();
    if (!quickCatForm.name.trim()) {
      setQuickCatError('Vui lòng nhập tên danh mục');
      return;
    }
    setIsSavingQuickCat(true);
    setQuickCatError('');
    try {
      const res = await axiosClient.post('/categories', {
        name: quickCatForm.name.trim(),
        description: quickCatForm.description.trim() || null
      });
      const newCat = res.data;
      setCategories((prev) => [...prev, newCat]);
      setFormData((prev) => ({ ...prev, categoryId: newCat.id }));
      toast.success(`Đã tạo và chọn danh mục "${newCat.name}"!`);
      setShowQuickCatModal(false);
      setQuickCatForm({ name: '', description: '' });
    } catch (err) {
      setQuickCatError(err.response?.data?.message || 'Không thể tạo danh mục');
    } finally {
      setIsSavingQuickCat(false);
    }
  };

  const handleToggleTag = (tagId) => {
    setFormData((prev) => {
      const currentTags = Array.isArray(prev.tags) ? prev.tags : [];
      if (currentTags.includes(tagId)) {
        return { ...prev, tags: currentTags.filter((t) => t !== tagId) };
      } else {
        return { ...prev, tags: [...currentTags, tagId] };
      }
    });
  };

  const handleAddCustomTag = (e) => {
    if (e) e.preventDefault();
    const tag = customTagInput.trim().toLowerCase();
    if (!tag) return;
    setFormData((prev) => {
      const currentTags = Array.isArray(prev.tags) ? prev.tags : [];
      if (!currentTags.includes(tag)) {
        return { ...prev, tags: [...currentTags, tag] };
      }
      return prev;
    });
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData((prev) => ({
      ...prev,
      tags: (Array.isArray(prev.tags) ? prev.tags : []).filter((t) => t !== tagToRemove)
    }));
  };

  function initialFormState() {
    return {
      id: null,
      name: '',
      price: 0,
      inStock: 0,
      categoryId: '',
      brand: '',
      images: [],
      specs: {
        description: '',
        cpu: '',
        ram: '',
        storage: '',
        screen: '',
        gpu: '',
        weight: '',
        battery: ''
      },
      tags: []
    };
  }

  // Debounce search input by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      startTransition(() => {
        setDebouncedSearch(searchTerm);
        setPagination((prev) => ({ ...prev, page: 1 }));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Load categories once
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await axiosClient.get('/categories');
        setCategories(res.data || []);
      } catch (err) {
        console.error('Không thể tải danh mục', err);
      }
    };
    loadCategories();
  }, []);

  // Fetch products server-side
  const fetchProducts = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10'
      });
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (categoryFilter) params.append('category', categoryFilter);

      const res = await axiosClient.get(`/products?${params.toString()}`);
      let list = res.data?.data || [];

      // Filter by stock status if requested
      if (stockFilter === 'IN_STOCK') {
        list = list.filter((p) => p.inStock > 5);
      } else if (stockFilter === 'LOW_STOCK') {
        list = list.filter((p) => p.inStock > 0 && p.inStock <= 5);
      } else if (stockFilter === 'OUT_OF_STOCK') {
        list = list.filter((p) => p.inStock <= 0);
      }

      setProducts(list);
      setPagination(res.data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Không thể tải danh sách sản phẩm');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryFilter, stockFilter, toast]);

  useEffect(() => {
    fetchProducts(pagination.page);
  }, [fetchProducts, pagination.page]);

  // Handle image upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    setIsUploading(true);
    try {
      const res = await axiosClient.post('/upload?type=product', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const imgUrl = res.data?.url?.startsWith('http')
        ? res.data.url
        : `http://localhost:5000${res.data?.url}`;

      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, imgUrl]
      }));
      toast.success('Tải ảnh thành công');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi upload ảnh');
    } finally {
      setIsUploading(false);
      e.target.value = null;
    }
  };

  const handleAddImageUrl = () => {
    const url = prompt('Nhập URL hình ảnh:');
    if (url && url.trim()) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, url.trim()] }));
    }
  };

  const handleRemoveImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const editProduct = (p) => {
    let parsedSpecs = {
      description: '',
      cpu: '',
      ram: '',
      storage: '',
      screen: '',
      gpu: '',
      weight: '',
      battery: ''
    };
    if (p.specs) {
      try {
        const obj = typeof p.specs === 'string' ? JSON.parse(p.specs) : p.specs;
        if (obj && typeof obj === 'object') {
          parsedSpecs = { ...parsedSpecs, ...obj };
        }
      } catch (e) {
        console.warn('Lỗi parse specs:', e);
      }
    }

    setFormData({
      id: p.id,
      name: p.name,
      price: p.price,
      inStock: p.inStock,
      categoryId: p.categoryId,
      brand: p.brand || '',
      images: p.images || [],
      specs: parsedSpecs,
      tags: Array.isArray(p.tags)
        ? p.tags
        : (typeof p.tags === 'string' ? p.tags.split(',').map(t => t.trim()).filter(Boolean) : [])
    });
    setError('');
    setShowForm(true);
  };

  const handleAiSuggestSpecs = () => {
    const nameLower = (formData.name || '').toLowerCase();
    const brandLower = (formData.brand || '').toLowerCase();

    let suggested = {
      description: '',
      cpu: '',
      ram: '',
      storage: '',
      screen: '',
      gpu: '',
      weight: '',
      battery: ''
    };

    if (nameLower.includes('macbook air') || nameLower.includes('air m3')) {
      suggested = {
        description: 'Laptop mỏng nhẹ cao cấp trang bị chip Apple M3 đột phá, thiết kế nhôm nguyên khối sang trọng, thời lượng pin cả ngày dài và màn hình Liquid Retina tuyệt đẹp.',
        cpu: 'Apple M3 (8-core CPU, 16-core Neural Engine)',
        ram: '16GB Unified Memory',
        storage: '512GB SSD siêu tốc',
        screen: '13.6 inch Liquid Retina (2560 x 1664) 500 nits True Tone',
        gpu: '10-core GPU tích hợp Apple Silicon',
        weight: '1.24 kg • Pin 52.6Wh lên đến 18 giờ',
        battery: 'Lên đến 18 giờ lướt web và xem video'
      };
    } else if (nameLower.includes('macbook pro') || (brandLower === 'apple' && nameLower.includes('pro'))) {
      suggested = {
        description: 'Đỉnh cao hiệu năng đồ họa chuyên nghiệp và lập trình, màn hình Liquid Retina XDR độ sáng 1600 nits, tản nhiệt tối ưu và cổng kết nối đa dạng.',
        cpu: 'Apple M3 Pro / Max (12-core CPU, 18-core GPU)',
        ram: '36GB Unified Memory',
        storage: '1TB SSD PCIe Gen4',
        screen: '16.2 inch Liquid Retina XDR (3456 x 2234) 120Hz ProMotion',
        gpu: '18-core GPU Apple Silicon',
        weight: '2.16 kg • Pin 100Wh sạc nhanh 140W',
        battery: 'Lên đến 22 giờ sử dụng liên tục'
      };
    } else if (nameLower.includes('dell xps') || nameLower.includes('xps 15')) {
      suggested = {
        description: 'Dòng máy trạm di động cao cấp với thiết kế viền siêu mỏng InfinityEdge, màn hình chuẩn màu điện ảnh và sức mạnh đồ họa RTX 40 series vượt trội.',
        cpu: 'Intel Core i7-13700H (14 nhân, 20 luồng, up to 5.0GHz)',
        ram: '16GB DDR5 4800MHz (Hỗ trợ nâng cấp tối đa 64GB)',
        storage: '512GB M.2 PCIe 4.0 NVMe SSD',
        screen: '15.6 inch OLED 3.5K (3456 x 2160) Touch 400 nits 100% DCI-P3',
        gpu: 'NVIDIA GeForce RTX 4050 6GB GDDR6',
        weight: '1.92 kg • Pin 86Wh hỗ trợ sạc nhanh Type-C',
        battery: 'Pin 86Wh (Khoảng 8 - 10 giờ sử dụng văn phòng)'
      };
    } else if (nameLower.includes('zephyrus') || nameLower.includes('rog') || nameLower.includes('gaming')) {
      suggested = {
        description: 'Cỗ máy chiến game và sáng tạo nội dung siêu mỏng nhẹ, khung nhôm CNC cao cấp, màn hình OLED 3K 120Hz chuẩn gaming và tản nhiệt buồng hơi thông minh.',
        cpu: 'AMD Ryzen 9 8945HS (8 nhân, 16 luồng, 16MB Cache, up to 5.2GHz)',
        ram: '32GB LPDDR5X 6400MHz Dual-channel',
        storage: '1TB PCIe 4.0 NVMe M.2 SSD',
        screen: '14 inch ROG Nebula Display 3K OLED 120Hz 0.2ms G-Sync',
        gpu: 'NVIDIA GeForce RTX 4060 8GB GDDR6 (TGP 90W MUX Switch)',
        weight: '1.50 kg • Pin 73Wh hỗ trợ sạc Type-C 100W',
        battery: 'Pin 73Wh 4-cell Li-ion sạc nhanh 50% trong 30 phút'
      };
    } else if (nameLower.includes('lg gram') || nameLower.includes('gram 16')) {
      suggested = {
        description: 'Đỉnh cao siêu mỏng nhẹ với trọng lượng chỉ 1.19kg, độ bền đạt chuẩn quân đội MIL-STD-810H, màn hình 16 inch tỷ lệ 16:10 tối ưu làm việc.',
        cpu: 'Intel Core Ultra 7 155H (16 nhân, 22 luồng, Intel AI Boost)',
        ram: '16GB LPDDR5X 7467MHz Dual-channel',
        storage: '512GB M.2 NVMe PCIe 4.0 SSD (2 khe cắm)',
        screen: '16.0 inch WQXGA (2560 x 1600) IPS Anti-glare 350 nits DCI-P3 99%',
        gpu: 'Intel Arc Graphics tích hợp',
        weight: '1.19 kg • Pin 77Wh bền bỉ cả ngày',
        battery: 'Pin 77Wh (Thời lượng sử dụng thực tế lên tới 16 giờ)'
      };
    } else if (nameLower.includes('spectre') || nameLower.includes('x360')) {
      suggested = {
        description: 'Laptop 2-in-1 xoay gập 360 độ sang trọng bậc nhất, màn hình cảm ứng OLED rực rỡ kèm bút cảm ứng, tối ưu cho doanh nhân và công việc linh hoạt.',
        cpu: 'Intel Core Ultra 7 155H (16 nhân, 22 luồng, NPU AI tích hợp)',
        ram: '16GB LPDDR5X 7467MHz Onboard',
        storage: '1TB PCIe Gen4 NVMe TLC M.2 SSD',
        screen: '14.0 inch 2.8K OLED (2880 x 1800) Touch xoay gập 360 độ 120Hz',
        gpu: 'Intel Arc Graphics tích hợp',
        weight: '1.44 kg • Pin 68Wh sạc nhanh 50% trong 45 phút',
        battery: 'Pin 68Wh hỗ trợ công nghệ sạc thông minh HP Fast Charge'
      };
    } else if (nameLower.includes('thinkpad') || nameLower.includes('x1 carbon')) {
      suggested = {
        description: 'Biểu tượng doanh nhân đỉnh cao với bàn phím huyền thoại, vỏ sợi carbon siêu nhẹ và bền bỉ chuẩn quân sự, bảo mật vân tay và nhận diện khuôn mặt IR.',
        cpu: 'Intel Core Ultra 7 155U (12 nhân, 14 luồng, up to 4.8GHz)',
        ram: '32GB LPDDR5X 6400MHz',
        storage: '1TB SSD M.2 2280 PCIe 4.0 Opal 2.0',
        screen: '14.0 inch 2.8K OLED (2880 x 1800) AG/AR/AS 400 nits 100% DCI-P3',
        gpu: 'Intel Graphics tích hợp',
        weight: '1.09 kg • Pin 57Wh hỗ trợ sạc nhanh Rapid Charge',
        battery: 'Pin 57Wh sạc nhanh 80% trong 60 phút'
      };
    } else if (nameLower.includes('chuột') || nameLower.includes('mx master') || nameLower.includes('mouse')) {
      suggested = {
        description: 'Chuột công thái học cao cấp chuẩn master dành cho lập trình viên và nhà thiết kế, thiết kế ôm tay chống mỏi, con lăn điện từ MagSpeed và nút bấm êm ái.',
        cpu: 'Cảm biến Darkfield độ chính xác cao 8000 DPI (lướt trên mọi bề mặt, kể cả kính)',
        ram: 'Bộ nhớ Onboard lưu 3 profile tùy biến cử chỉ',
        storage: 'Kết nối không dây Logi Bolt & Bluetooth Low Energy (kết nối cùng lúc 3 thiết bị)',
        screen: 'Con lăn MagSpeed cuộn siêu nhanh 1.000 dòng/giây, công nghệ Silent Touch',
        gpu: 'Tương thích Windows, macOS, Linux, iPadOS qua phần mềm Logi Options+',
        weight: '141g • Pin sạc USB-C dùng liên tục 70 ngày sau 1 lần sạc đầy',
        battery: 'Pin sạc Li-Po 500mAh dùng 70 ngày cho 1 lần sạc'
      };
    } else {
      suggested = {
        description: 'Sản phẩm công nghệ chính hãng sở hữu cấu hình mạnh mẽ, thiết kế hiện đại, độ bền bỉ cao, đáp ứng trọn vẹn cả nhu cầu học tập, làm việc lẫn giải trí.',
        cpu: 'Intel Core i7 thế hệ mới (Đa nhân, xử lý mượt mà)',
        ram: '16GB DDR5 tốc độ cao đa nhiệm mượt mà',
        storage: '512GB SSD NVMe PCIe 4.0 tốc độ cao',
        screen: '15.6 inch FHD IPS sắc nét, chống chói',
        gpu: 'Đồ họa thế hệ mới tối ưu đồ họa & giải trí',
        weight: '1.5 kg • Pin dung lượng lớn hỗ trợ sạc nhanh',
        battery: 'Pin dung lượng lớn đáp ứng cả ngày dài'
      };
    }

    setFormData((prev) => ({
      ...prev,
      specs: {
        ...prev.specs,
        ...suggested
      }
    }));
    toast.success('✦ AI đã gợi ý và điền tự động cấu hình & mô tả!');
  };

  // Deep-linking: tự động mở Modal chỉnh sửa khi có query param ?editId=
  const editId = searchParams.get('editId');
  useEffect(() => {
    if (!editId) return;
    const targetId = parseInt(editId, 10);
    if (isNaN(targetId)) return;

    let isMounted = true;
    const loadAndEdit = async () => {
      // Tìm trong danh sách hiện tại nếu có
      const found = products.find((p) => p.id === targetId);
      if (found) {
        editProduct(found);
        return;
      }

      // Nếu không có trong trang hiện tại, gọi API lấy chi tiết sản phẩm
      try {
        const res = await axiosClient.get(`/products/${targetId}`);
        if (res.data && isMounted) {
          editProduct(res.data);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Không thể tải sản phẩm để sửa:', err);
          toast.error('Không tìm thấy sản phẩm cần chỉnh sửa');
        }
      }
    };

    loadAndEdit();

    return () => {
      isMounted = false;
    };
  }, [editId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        price: Number(formData.price),
        inStock: Number(formData.inStock),
        categoryId: Number(formData.categoryId),
        brand: formData.brand,
        images: formData.images,
        specs: typeof formData.specs === 'object' && formData.specs !== null ? formData.specs : {},
        tags: Array.isArray(formData.tags) ? formData.tags : []
      };

      if (formData.id) {
        await axiosClient.put(`/products/${formData.id}`, payload);
        toast.success('Cập nhật sản phẩm thành công');
      } else {
        await axiosClient.post('/products', payload);
        toast.success('Thêm sản phẩm mới thành công');
      }

      handleCloseForm();
      fetchProducts(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu');
      toast.error(err.response?.data?.message || 'Không thể lưu sản phẩm');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await axiosClient.delete(`/products/${productToDelete}`);
        toast.success('Xóa sản phẩm thành công');
        fetchProducts(pagination.page);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Không thể xóa sản phẩm');
      } finally {
        setProductToDelete(null);
      }
    }
  };

  const formatPrice = (val) => `${new Intl.NumberFormat('vi-VN').format(val || 0)}đ`;

  return (
    <div className="admin-products-page">
      {/* Header */}
      <div className="admin-products-header">
        <div>
          <h1 className="admin-products-title">Quản lý Sản phẩm</h1>
          <p className="admin-products-subtitle">
            Quản trị danh mục hàng hóa, theo dõi biến động tồn kho và giá niêm yết
          </p>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setFormData(initialFormState());
            setError('');
            setShowForm(true);
          }}
        >
          <i className="ti ti-plus"></i> Thêm sản phẩm
        </button>
      </div>

      {/* Main Content Card */}
      <div className="admin-products-content-card">
        {/* Toolbar */}
        <div className="admin-products-toolbar">
          <div className="admin-products-search-box">
            <i className="ti ti-search admin-products-search-icon"></i>
            <input
              type="text"
              className="admin-products-search-input"
              placeholder="Tìm theo tên sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="admin-products-filters">
            {/* Category Filter */}
            <select
              className="admin-products-select"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              className="admin-products-select"
              value={stockFilter}
              onChange={(e) => {
                setStockFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              <option value="ALL">Tất cả tồn kho</option>
              <option value="IN_STOCK">Còn hàng (&gt; 5)</option>
              <option value="LOW_STOCK">Sắp hết (1 - 5)</option>
              <option value="OUT_OF_STOCK">Hết hàng (0)</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="admin-products-table-container">
          <table className="admin-products-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá bán</th>
                <th>Tồn kho</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                    <ButtonSpinner /> Đang tải dữ liệu sản phẩm...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="admin-empty-table">
                      <i className="ti ti-package-off"></i>
                      <span>Không tìm thấy sản phẩm nào theo điều kiện lọc</span>
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const categoryName = categories.find((c) => c.id === p.categoryId)?.name || 'Chung';
                  const isOutOfStock = p.inStock <= 0;
                  const isLowStock = p.inStock > 0 && p.inStock <= 5;

                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-text-muted)' }}>#{p.id}</td>
                      <td>
                        <div className="admin-product-cell">
                          <img
                            src={p.images?.[0] || '/images/premium.png'}
                            alt={p.name}
                            className="admin-product-thumb"
                            onError={(e) => { e.target.src = '/images/premium.png'; }}
                          />
                          <div className="admin-product-meta">
                            <span className="admin-product-name">{p.name}</span>
                            {p.brand && <span className="admin-product-brand">{p.brand}</span>}
                            {p.tags && p.tags.length > 0 && (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                                {p.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    style={{
                                      fontSize: '10px',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: `${getTagColor(tag)}15`,
                                      color: getTagColor(tag),
                                      fontWeight: 600,
                                      border: `1px solid ${getTagColor(tag)}35`
                                    }}
                                  >
                                    {getTagLabel(tag)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge-category">{categoryName}</span>
                      </td>
                      <td>
                        <span className="admin-product-price">{formatPrice(p.price)}</span>
                      </td>
                      <td>
                        <span
                          className={`badge-stock ${
                            isOutOfStock ? 'out-stock' : isLowStock ? 'low-stock' : 'in-stock'
                          }`}
                        >
                          {isOutOfStock
                            ? 'Hết hàng (0)'
                            : isLowStock
                            ? `Sắp hết (${p.inStock})`
                            : `Còn ${p.inStock} cái`}
                        </span>
                      </td>
                      <td>
                        <div className="admin-products-actions">
                          <button
                            type="button"
                            className="btn-action-icon"
                            title="Sửa sản phẩm"
                            onClick={() => editProduct(p)}
                          >
                            <i className="ti ti-edit"></i>
                          </button>
                          {user?.role === 'Admin' && (
                            <button
                              type="button"
                              className="btn-action-icon danger"
                              title="Xóa sản phẩm"
                              onClick={() => setProductToDelete(p.id)}
                            >
                              <i className="ti ti-trash"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="admin-products-pagination">
            <span>
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> (Tổng cộng {pagination.total} sản phẩm)
            </span>

            <div className="admin-pagination-btns">
              <button
                type="button"
                className="admin-page-btn"
                disabled={pagination.page <= 1 || loading}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
              >
                Trước
              </button>

              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => {
                if (
                  p === 1 ||
                  p === pagination.totalPages ||
                  (p >= pagination.page - 1 && p <= pagination.page + 1)
                ) {
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`admin-page-btn ${p === pagination.page ? 'is-active' : ''}`}
                      disabled={loading}
                      onClick={() => setPagination((prev) => ({ ...prev, page: p }))}
                    >
                      {p}
                    </button>
                  );
                }
                return null;
              })}

              <button
                type="button"
                className="admin-page-btn"
                disabled={pagination.page >= pagination.totalPages || loading}
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add / Edit Product */}
      {showForm && (
        <div className="admin-modal-overlay" onClick={handleCloseForm}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">
                {formData.id ? 'Sửa thông tin sản phẩm' : 'Thêm sản phẩm mới'}
              </h3>
              <button
                type="button"
                className="admin-modal-close-btn"
                onClick={handleCloseForm}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Banner cảnh báo AI (Contextual Alert Banner) */}
            {((!formData.specs?.cpu || !formData.specs?.ram || !formData.specs?.description) || editId) && formData.id && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderLeft: '4px solid #f59e0b',
                padding: '10px 14px',
                borderRadius: '6px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <i className="ti ti-alert-triangle" style={{ color: '#d97706', fontSize: '18px', flexShrink: 0 }}></i>
                <span style={{ fontSize: '12.5px', color: '#92400e', lineHeight: 1.4 }}>
                  <strong>⚠️ Cảnh báo chất lượng AI:</strong> Sản phẩm này chưa có thông số cấu hình và mô tả. Vui lòng cập nhật bên dưới để đạt chuẩn chất lượng.
                </span>
              </div>
            )}

            {error && (
              <div style={{ color: 'var(--color-danger)', marginBottom: '12px', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                  Tên sản phẩm *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ví dụ: MacBook Pro 16 Space Black"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Giá bán (VND) *
                  </label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Tồn kho *
                  </label>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.inStock}
                    onChange={(e) => setFormData({ ...formData, inStock: e.target.value })}
                    required
                    min="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>
                      Danh mục *
                    </label>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickCatForm({ name: '', description: '' });
                          setQuickCatError('');
                          setShowQuickCatModal(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '0'
                        }}
                        title="Tạo nhanh danh mục mới"
                      >
                        <i className="ti ti-plus"></i> Thêm nhanh
                      </button>
                    )}
                  </div>
                  <select
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
                    Thương hiệu
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Ví dụ: Apple, ASUS, Dell..."
                  />
                </div>
              </div>

              {/* Mô tả tóm tắt sản phẩm */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>
                    Mô tả tóm tắt sản phẩm
                  </label>
                  <button
                    type="button"
                    onClick={handleAiSuggestSpecs}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 600,
                      backgroundColor: '#f5f3ff',
                      color: '#7c3aed',
                      border: '1px solid #ddd6fe',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    title="Dựa trên tên sản phẩm để gợi ý thông số và mô tả tự động"
                  >
                    <i className="ti ti-sparkles" style={{ fontSize: '13px' }}></i>
                    <span>✦ AI gợi ý thông số</span>
                  </button>
                </div>
                <textarea
                  className="input"
                  rows={3}
                  style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', fontSize: '13px', lineHeight: 1.4 }}
                  value={formData.specs?.description || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    specs: { ...formData.specs, description: e.target.value }
                  })}
                  placeholder="Giới thiệu điểm nổi bật, thiết kế, thời lượng pin và đối tượng phù hợp..."
                />
              </div>

              {/* Khối Thông số kỹ thuật chi tiết (Grid 2 cột) */}
              <div style={{ marginBottom: '18px', border: '1px solid var(--color-border)', padding: '14px', borderRadius: '8px', backgroundColor: '#fcfcfd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="ti ti-cpu" style={{ color: '#2563eb' }}></i>
                    <span>Thông số kỹ thuật chi tiết (Specs)</span>
                  </label>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    Hiển thị trên bảng so sánh và hỗ trợ bộ lọc AI
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Vi xử lý (CPU)
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      value={formData.specs?.cpu || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        specs: { ...formData.specs, cpu: e.target.value }
                      })}
                      placeholder="Ví dụ: Apple M3 8-core, Intel Core i7-13700H"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Dung lượng RAM
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      value={formData.specs?.ram || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        specs: { ...formData.specs, ram: e.target.value }
                      })}
                      placeholder="Ví dụ: 16GB LPDDR5, 32GB DDR5"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Ổ cứng / Bộ nhớ
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      value={formData.specs?.storage || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        specs: { ...formData.specs, storage: e.target.value }
                      })}
                      placeholder="Ví dụ: 512GB NVMe SSD, 1TB SSD"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Màn hình
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      value={formData.specs?.screen || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        specs: { ...formData.specs, screen: e.target.value }
                      })}
                      placeholder="Ví dụ: 14 inch Liquid Retina 120Hz, 15.6 inch FHD IPS"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Card đồ họa (GPU/VGA)
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      value={formData.specs?.gpu || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        specs: { ...formData.specs, gpu: e.target.value }
                      })}
                      placeholder="Ví dụ: 10-core GPU, NVIDIA RTX 4060 8GB"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                      Trọng lượng & Pin
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', boxSizing: 'border-box', fontSize: '12px' }}
                      value={formData.specs?.weight || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        specs: { ...formData.specs, weight: e.target.value }
                      })}
                      placeholder="Ví dụ: 1.24 kg, Pin 70Wh"
                    />
                  </div>
                </div>
              </div>

              {/* Tags Selector (Multi-Select Chips & Custom Tag) */}
              <div style={{ marginBottom: '18px', border: '1px solid var(--color-border)', padding: '14px', borderRadius: '8px', backgroundColor: '#fafbfd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    Nhãn phân loại (Tags)
                  </label>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {Array.isArray(formData.tags) ? formData.tags.length : 0} nhãn đã chọn
                  </span>
                </div>

                {/* Predefined chips */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  {PRODUCT_TAGS.map((t) => {
                    const isSelected = Array.isArray(formData.tags) && formData.tags.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleToggleTag(t.id)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected ? `2px solid ${t.color}` : '1px solid var(--color-border)',
                          backgroundColor: isSelected ? `${t.color}18` : '#ffffff',
                          color: isSelected ? t.color : 'var(--color-text-secondary)',
                          boxShadow: isSelected ? `0 0 0 1px ${t.color}25` : 'none'
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: t.color
                          }}
                        />
                        {t.label}
                        {isSelected && <i className="ti ti-check" style={{ fontSize: '12px', marginLeft: '2px' }}></i>}
                      </button>
                    );
                  })}
                </div>

                {/* Custom tags input */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Nhập tag tùy chỉnh (ví dụ: oled, rtx-4060...)"
                    value={customTagInput}
                    onChange={(e) => setCustomTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomTag();
                      }
                    }}
                    style={{ flex: 1, height: '36px', fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    className="btn-outline"
                    onClick={handleAddCustomTag}
                    style={{ height: '36px', padding: '0 12px', fontSize: '12px' }}
                  >
                    + Thêm tag
                  </button>
                </div>

                {/* Selected tags badges list */}
                {Array.isArray(formData.tags) && formData.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: `${getTagColor(tag)}20`,
                          color: getTagColor(tag),
                          border: `1px solid ${getTagColor(tag)}40`,
                          fontWeight: 600
                        }}
                      >
                        {getTagLabel(tag)}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: getTagColor(tag),
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: 0,
                            lineHeight: 1,
                            marginLeft: '2px'
                          }}
                          title="Xóa tag"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Images */}
              <div style={{ marginBottom: '20px', border: '1px solid var(--color-border)', padding: '16px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: '600', fontSize: '13px' }}>
                  Hình ảnh sản phẩm
                </label>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <label className="btn-outline" style={{ cursor: 'pointer', fontSize: '13px' }}>
                    {isUploading ? <><ButtonSpinner /> Đang tải...</> : <><i className="ti ti-upload"></i> Upload File</>}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </label>
                  <button type="button" className="btn-outline" onClick={handleAddImageUrl}>
                    + Dán Link URL
                  </button>
                </div>

                {formData.images.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {formData.images.map((img, idx) => (
                      <div key={idx} style={{ position: 'relative', width: '70px', height: '70px' }}>
                        <img
                          src={img}
                          alt="preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: '#dc2626',
                            color: 'white',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={handleCloseForm}
                  disabled={isSaving}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? <><ButtonSpinner /> Đang lưu...</> : 'Lưu sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Category Mini-Modal */}
      {showQuickCatModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '20px'
          }}
          onClick={() => !isSavingQuickCat && setShowQuickCatModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>
                <i className="ti ti-folder-plus" style={{ color: '#2563eb', marginRight: '6px' }}></i>
                Thêm nhanh danh mục mới
              </h4>
              <button
                type="button"
                onClick={() => !isSavingQuickCat && setShowQuickCatModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuickCategory}>
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {quickCatError && (
                  <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: '6px', fontSize: '12px' }}>
                    {quickCatError}
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>
                    Tên danh mục <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder="Ví dụ: Máy tính bảng, Loa Bluetooth..."
                    value={quickCatForm.name}
                    onChange={(e) => setQuickCatForm({ ...quickCatForm, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600 }}>
                    Mô tả (tùy chọn)
                  </label>
                  <textarea
                    className="input"
                    rows={2}
                    style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
                    placeholder="Mô tả tóm tắt..."
                    value={quickCatForm.description}
                    onChange={(e) => setQuickCatForm({ ...quickCatForm, description: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ padding: '12px 18px', borderTop: '1px solid var(--color-border)', backgroundColor: '#fafbfd', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setShowQuickCatModal(false)}
                  disabled={isSavingQuickCat}
                  style={{ fontSize: '13px', padding: '6px 14px' }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSavingQuickCat}
                  style={{ fontSize: '13px', padding: '6px 14px' }}
                >
                  {isSavingQuickCat ? <><ButtonSpinner /> Đang tạo...</> : 'Tạo và chọn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="Xác nhận xóa sản phẩm"
        message="Bạn có chắc chắn muốn xóa sản phẩm này không? Hành động này sẽ loại bỏ sản phẩm khỏi danh mục bán."
        onConfirm={confirmDelete}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
}
