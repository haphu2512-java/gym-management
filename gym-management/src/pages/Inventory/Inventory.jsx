import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, Settings } from 'lucide-react';
import { productService } from '../../services/productService';
import { useAuthStore } from '../../store/useAuthStore';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { useToast, ToastContainer } from '../../components/ui/Toast';
import { formatDateTime } from '../../utils/formatters';

const DRINK_THEMES = [
  { border: '#93c5fd', text: '#1e40af', dot: '#3b82f6', grad: 'linear-gradient(135deg, #3b82f6, #60a5fa)', bg: '#eff6ff' }, // Blue
  { border: '#86efac', text: '#166534', dot: '#22c55e', grad: 'linear-gradient(135deg, #22c55e, #4ade80)', bg: '#f0fdf4' }, // Green
  { border: '#fde047', text: '#854d0e', dot: '#eab308', grad: 'linear-gradient(135deg, #eab308, #facc15)', bg: '#fefce8' }, // Yellow
  { border: '#fdba74', text: '#9a3412', dot: '#f97316', grad: 'linear-gradient(135deg, #f97316, #fb923c)', bg: '#fff7ed' }, // Orange
  { border: '#fca5a5', text: '#9f1239', dot: '#ef4444', grad: 'linear-gradient(135deg, #ef4444, #f87171)', bg: '#fff1f2' }, // Red
  { border: '#d8b4fe', text: '#6b21a8', dot: '#a855f7', grad: 'linear-gradient(135deg, #a855f7, #c084fc)', bg: '#faf5ff' }, // Purple
  { border: '#99f6e4', text: '#0f766e', dot: '#14b8a6', grad: 'linear-gradient(135deg, #14b8a6, #2dd4bf)', bg: '#f0fdfa' }, // Teal
  { border: '#f9a8d4', text: '#9d174d', dot: '#ec4899', grad: 'linear-gradient(135deg, #ec4899, #f472b6)', bg: '#fdf2f8' }, // Pink
];

const getDrinkTheme = (name) => {
  if (!name) return DRINK_THEMES[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DRINK_THEMES.length;
  return DRINK_THEMES[index];
};

export default function Inventory() {
  const { user, profile, activeStaff } = useAuthStore();
  const { showError, showSuccess, toasts } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('sales'); // 'sales' or 'admin'
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: '', restock_quantity: '0', note: '', image_url: '' });
  const [imageFile, setImageFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Quantities for sales
  const [sellQuantities, setSellQuantities] = useState({});
  const [salesSearchTerm, setSalesSearchTerm] = useState('');

  // Doanh thu nước của ca hiện tại
  const [drinkRevenue, setDrinkRevenue] = useState(0);
  const [activeShift, setActiveShift] = useState(null);

  // Xác nhận xóa
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Thống kê
  const [salesLogs, setSalesLogs] = useState([]);
  const [statsDate, setStatsDate] = useState(new Date().toISOString().split('T')[0]);
  const [statsShiftName, setStatsShiftName] = useState('');
  const [statsPaymentMethod, setStatsPaymentMethod] = useState('');

  // Lấy ca đang mở nếu chưa có trong store
  useEffect(() => {
    const fetchShift = async () => {
      try {
        const { shift } = await shiftService.validateShiftForLogin();
        setActiveShift(shift);
        if (shift) {
          const rev = await productService.getDrinkRevenueForShift(shift.id);
          setDrinkRevenue(rev);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchShift();
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await productService.getAllProducts();
      setProducts(data);
      // Initialize quantities to 1
      const qtys = {};
      data.forEach(p => qtys[p.id] = 1);
      setSellQuantities(qtys);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    if (viewMode === 'stats') {
      setLoading(true);
      productService.getFilteredSalesLogs({
        date: statsDate,
        shiftName: statsShiftName,
        paymentMethod: statsPaymentMethod
      })
        .then(setSalesLogs)
        .catch(e => setError("Lỗi tải thống kê: " + e.message))
        .finally(() => setLoading(false));
    }
  }, [viewMode, statsDate, statsShiftName, statsPaymentMethod]);

  const handleQtyChange = (id, delta, stock) => {
    setSellQuantities(prev => {
      const current = prev[id] || 1;
      const next = Math.max(1, Math.min(stock, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setForm({ name: '', price: '', stock_quantity: '', restock_quantity: '0', note: '', image_url: '' });
    setImageFile(null);
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      restock_quantity: '0',
      note: product.note || '',
      image_url: product.image_url || ''
    });
    setImageFile(null);
    setShowModal(true);
  };

  const uploadToCloudinary = async (file) => {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset || cloudName === 'your_cloud_name' || uploadPreset === 'your_upload_preset') {
      throw new Error('Vui lòng cấu hình VITE_CLOUDINARY_CLOUD_NAME và VITE_CLOUDINARY_UPLOAD_PRESET trong file .env trước!');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error('Tải ảnh lên Cloudinary thất bại!');
    }

    const data = await res.json();
    return data.secure_url;
  };

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    setError('');
    setUploadingImage(true);
    try {
      let finalImageUrl = form.image_url;

      if (imageFile) {
        finalImageUrl = await uploadToCloudinary(imageFile);
      }

      const payload = {
        name: form.name,
        price: Number(form.price || 0),
        stock_quantity: Number(form.stock_quantity || 0) + Number(form.restock_quantity || 0),
        note: form.note,
        image_url: finalImageUrl
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, payload);
        await staffLogService.logAction({
          staffId: activeStaff?.id || user?.id,
          action: 'Nhập/Sửa kho',
          targetItem: editingProduct.name,
          details: { before: editingProduct.stock_quantity, after: payload.stock_quantity },
          note: 'Admin cập nhật sản phẩm',
        });
      } else {
        await productService.addProduct(payload);
        await staffLogService.logAction({
          staffId: activeStaff?.id || user?.id,
          action: 'Thêm sản phẩm',
          targetItem: payload.name,
          details: { quantity: payload.stock_quantity },
          note: 'Admin thêm sản phẩm mới',
        });
      }

      setShowModal(false);
      setEditingProduct(null);
      setForm({ name: '', price: '', stock_quantity: '', restock_quantity: '0', note: '', image_url: '' });
      setImageFile(null);
      await loadProducts();
      showSuccess('Cập nhật kho thành công!');
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
    }
  };

  // Bán hàng
  const [sellingItem, setSellingItem] = useState(null);

  const handleSell = async (product, method = 'TM') => {
    setError('');
    const shiftId = activeShift?.id || null;
    const qty = sellQuantities[product.id] || 1;

    if (!shiftId) {
      showError('Vui lòng mở ca làm việc trước khi thực hiện bán hàng.');
      return;
    }

    try {
      await productService.sellProduct(
        product,
        qty,
        activeShift.id,
        user?.id,
        activeStaff?.id,
        method
      );

      await staffLogService.logAction({
        staffId: user?.id,
        staffMemberId: activeStaff?.id,
        action: 'Bán nước/hàng hóa',
        targetItem: product.name,
        details: { qty, total: Number(product.price || 0) * qty, method },
        note: 'Nhân viên bán hàng từ kho nước',
      });

      // Update local state
      setProducts((prev) => prev.map((item) =>
        (item.id === product.id ? { ...item, stock_quantity: item.stock_quantity - qty } : item)
      ));

      // Reset quantity to 1
      setSellQuantities(prev => ({ ...prev, [product.id]: 1 }));

      // Cập nhật doanh thu nước real-time
      if (shiftId) {
        const rev = await productService.getDrinkRevenueForShift(shiftId);
        setDrinkRevenue(rev);
      }

      showSuccess(`Đã bán ${qty} ${product.name} (${method}) thành công!`);
      setSellingItem(null);
    } catch (err) {
      showError(`Bán hàng thất bại: ${err.message}`);
    }
  };

  // Xóa sản phẩm (chỉ admin)
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setError('');
    try {
      await productService.deleteProduct(deletingProduct.id);
      await staffLogService.logAction({
        staffId: activeStaff?.id || user?.id,
        action: 'Xóa sản phẩm',
        targetItem: deletingProduct.name,
        details: { id: deletingProduct.id },
        note: 'Admin xóa sản phẩm khỏi kho',
      });
      setDeletingProduct(null);
      await loadProducts();
      showSuccess(`Đã xóa sản phẩm ${deletingProduct.name} thành công!`);
    } catch (err) {
      showError(`Xóa sản phẩm thất bại: ${err.message}`);
      setDeletingProduct(null);
    }
  };

  return (
    <div className="modern-stack">
      <div className="modern-toolbar" style={{ flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 className="modern-title">Kho nước &amp; bán hàng</h3>
          <p className="muted-text">Bấm chọn số lượng và nhấn Bán hàng.</p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginLeft: 'auto' }}>
          {/* Doanh thu nước ca hiện tại */}
          <div style={{
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '800',
            color: '#0369a1',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShoppingCart size={16} />
            DT Nước: {drinkRevenue.toLocaleString('vi-VN')}đ
          </div>

          <div className="tab-group" style={{ display: 'flex', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              className={`tab-btn ${viewMode === 'sales' ? 'active' : ''}`}
              onClick={() => setViewMode('sales')}
              style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: viewMode === 'sales' ? '#fff' : 'transparent', fontWeight: viewMode === 'sales' ? '600' : 'normal', boxShadow: viewMode === 'sales' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              Bán hàng
            </button>
            {profile?.role === 'admin' && (
              <button
                className={`tab-btn ${viewMode === 'admin' ? 'active' : ''}`}
                onClick={() => setViewMode('admin')}
                style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: viewMode === 'admin' ? '#fff' : 'transparent', fontWeight: viewMode === 'admin' ? '600' : 'normal', boxShadow: viewMode === 'admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
              >
                Quản lý kho
              </button>
            )}
            <button
              className={`tab-btn ${viewMode === 'stats' ? 'active' : ''}`}
              onClick={() => setViewMode('stats')}
              style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: viewMode === 'stats' ? '#fff' : 'transparent', fontWeight: viewMode === 'stats' ? '600' : 'normal', boxShadow: viewMode === 'stats' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              Thống kê
            </button>
          </div>

          {profile?.role === 'admin' && (
            <button type="button" className="primary-btn" onClick={handleOpenCreate}>
              <Plus size={16} /> Thêm sản phẩm
            </button>
          )}
        </div>
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang xử lý...</div>}

      {/* POS Grid View */}
      {viewMode === 'sales' ? (
        <div className="modern-stack">
          <style>{`
            .pos-card-modern {
              background: #ffffff;
              border-radius: 16px;
              padding: 20px;
              display: flex;
              flex-direction: column;
              gap: 12px;
              transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
              position: relative;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
              border: 1.5px solid #cbd5e1;
            }
            .pos-card-modern:hover {
              transform: translateY(-4px);
              box-shadow: 0 12px 20px -8px rgba(0, 0, 0, 0.12);
              border-color: currentColor;
            }
            .pos-card-modern:active {
              transform: translateY(-1px);
            }
            .pos-search-input {
              width: 100%;
              max-width: 360px;
              padding: 10px 16px;
              border-radius: 12px;
              border: 1.5px solid #cbd5e1;
              background-color: #ffffff;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.15s ease;
              box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
            }
            .pos-search-input:focus {
              outline: none;
              border-color: #2563eb;
              box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
            }
            .btn-sell-pos:hover {
              filter: brightness(0.92);
              transform: scale(1.01);
            }
            .btn-sell-pos:active {
              transform: scale(0.99);
            }
          `}</style>

          {/* Quick search input */}
          <div style={{ marginBottom: '16px' }}>
            <input
              type="text"
              className="pos-search-input"
              placeholder="🔍 Tìm nhanh nước uống..."
              value={salesSearchTerm}
              onChange={(e) => setSalesSearchTerm(e.target.value)}
            />
          </div>

          <div className="pos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '32px', marginTop: '4px' }}>
            {products
              .filter(item => item.name.toLowerCase().includes(salesSearchTerm.toLowerCase()))
              .map((item) => {
                const qty = sellQuantities[item.id] || 1;
                const isOutOfStock = Number(item.stock_quantity || 0) <= 0;
                const isLowStock = Number(item.stock_quantity || 0) < 10;
                const theme = getDrinkTheme(item.name);

                return (
                  <div 
                    key={item.id} 
                    className="pos-card-modern" 
                    style={{ 
                      opacity: isOutOfStock ? 0.6 : 1,
                      borderLeft: isOutOfStock ? '5px solid #cbd5e1' : '5px solid ' + theme.dot,
                      borderColor: isOutOfStock ? '#e2e8f0' : theme.border,
                      color: theme.dot
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #cbd5e1' }}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div style={{
                        width: '48px',
                        height: '48px',
                        background: theme.grad,
                        borderRadius: '12px',
                        display: item.image_url ? 'none' : 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        fontWeight: '800',
                        color: '#ffffff'
                      }}>
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 10px',
                        borderRadius: '99px',
                        fontWeight: '800',
                        background: isOutOfStock ? '#fee2e2' : (isLowStock ? '#fef9c3' : '#f0fdf4'),
                        color: isOutOfStock ? '#dc2626' : (isLowStock ? '#854d0e' : '#16a34a'),
                        border: isOutOfStock ? '1px solid #fecaca' : (isLowStock ? '1px solid #fef08a' : '1px solid #bbf7d0')
                      }}>
                        Kho: {item.stock_quantity}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.name}>
                        {item.name}
                      </h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: '800', color: isOutOfStock ? '#64748b' : theme.text }}>
                        {Number(item.price || 0).toLocaleString('vi-VN')}đ
                      </p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '6px', borderRadius: '12px', marginTop: 'auto', border: '1px solid #f1f5f9' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQtyChange(item.id, -1, item.stock_quantity); }}
                        style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                        disabled={isOutOfStock}
                      >
                        <Minus size={14} />
                      </button>
                      <span style={{ fontWeight: '800', fontSize: '15px', color: '#1e293b' }}>{qty}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleQtyChange(item.id, 1, item.stock_quantity); }}
                        style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                        disabled={isOutOfStock || qty >= item.stock_quantity}
                      >
                        <Plus size={14} />
                      </button>
                    </div>

                    <button
                      className="btn-sell-pos"
                      style={{
                        width: '100%',
                        borderRadius: '12px',
                        padding: '11px',
                        fontWeight: '800',
                        color: '#ffffff',
                        background: isOutOfStock ? '#cbd5e1' : theme.grad,
                        border: 'none',
                        cursor: isOutOfStock ? 'not-allowed' : 'pointer',
                        boxShadow: isOutOfStock ? 'none' : '0 4px 12px ' + theme.dot + '30',
                        transition: 'all 0.2s ease',
                        fontSize: '14px'
                      }}
                      onClick={() => setSellingItem(item)}
                      disabled={isOutOfStock}
                    >
                      Bán hàng
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      ) : viewMode === 'stats' ? (
        /* Thống kê bán hàng */
        <div className="modern-stack">
          <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Ngày:</label>
              <input
                type="date"
                value={statsDate}
                onChange={(e) => setStatsDate(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Ca:</label>
              <select
                value={statsShiftName}
                onChange={(e) => setStatsShiftName(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="">Tất cả các ca</option>
                {shiftService.shiftOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Thanh toán:</label>
              <select
                value={statsPaymentMethod}
                onChange={(e) => setStatsPaymentMethod(e.target.value)}
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
              >
                <option value="">Tất cả</option>
                <option value="TM">Tiền mặt</option>
                <option value="CK">Chuyển khoản</option>
              </select>
            </div>
          </div>
          <div className="modern-table-wrap">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Thời gian</th>
                  <th>Sản phẩm</th>
                  <th>Số lượng</th>
                  <th>Tổng tiền</th>
                  <th>Phương thức</th>
                  <th>Nhân viên</th>
                </tr>
              </thead>
              <tbody>
                {!loading && salesLogs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty-cell">Chưa có dữ liệu bán hàng</td>
                  </tr>
                )}
                {salesLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <p className="cell-main">{formatDateTime(log.sold_at)}</p>
                      {log.shifts?.shift_name && <p className="cell-sub">{log.shifts.shift_name}</p>}
                    </td>
                    <td><p className="cell-main">{log.products?.name || 'N/A'}</p></td>
                    <td>{log.quantity}</td>
                    <td><p className="cell-main">{Number(log.total_price || 0).toLocaleString('vi-VN')}đ</p></td>
                    <td>
                      <span style={{
                        padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                        background: log.payment_method === 'CK' ? '#dbeafe' : '#f1f5f9',
                        color: log.payment_method === 'CK' ? '#1d4ed8' : '#475569'
                      }}>
                        {log.payment_method === 'CK' ? 'Chuyển khoản' : 'Tiền mặt'}
                      </span>
                    </td>
                    <td><p className="cell-main">{log.staff_members?.full_name || log.profiles?.full_name || 'N/A'}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Admin Table View */
        <div className="modern-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Giá bán</th>
                <th>Tồn kho</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {!loading && products.length === 0 && (
                <tr>
                  <td colSpan={4} className="table-empty-cell">Không có dữ liệu</td>
                </tr>
              )}
              {products.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                        />
                      ) : (
                        <div style={{ width: '36px', height: '36px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', color: '#94a3b8' }}>
                          N/A
                        </div>
                      )}
                      <div>
                        <p className="cell-main">{item.name}</p>
                        {item.note && <p className="cell-sub">{item.note}</p>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <p className="cell-main">{Number(item.price || 0).toLocaleString('vi-VN')}đ</p>
                  </td>
                  <td>
                    <span className={`stock-badge ${Number(item.stock_quantity || 0) < 10 ? 'low' : 'ok'}`}>
                      {item.stock_quantity}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => handleOpenEdit(item)}
                      >
                        <Settings size={14} style={{ marginRight: '4px' }} /> Nhập / Sửa
                      </button>
                      <button
                        type="button"
                        className="ghost-btn"
                        style={{ color: '#dc2626', background: '#fef2f2' }}
                        onClick={() => setDeletingProduct(item)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm/sửa sản phẩm */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{editingProduct ? 'Cập nhật / Nhập hàng' : 'Thêm sản phẩm nước'}</h3>
            <form className="modern-form" onSubmit={handleAddOrUpdate}>
              <div style={{ marginBottom: '12px' }}>
                <label className="cell-sub" style={{ display: 'block', marginBottom: '4px' }}>Tên sản phẩm</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Tên sản phẩm (ví dụ: Nước suối)"
                  required
                />
              </div>

              <div className="form-grid-2">
                <div>
                  <label className="cell-sub" style={{ display: 'block', marginBottom: '4px' }}>Giá bán (VNĐ)</label>
                  <input
                    type="number"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="Giá bán"
                    required
                  />
                </div>
                <div>
                  <label className="cell-sub" style={{ display: 'block', marginBottom: '4px' }}>Tồn kho hiện tại</label>
                  <input
                    type="number"
                    value={form.stock_quantity}
                    onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                    placeholder="Số lượng"
                    required
                    disabled={editingProduct !== null}
                  />
                </div>
              </div>

              {editingProduct && (
                <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                  <label className="cell-sub" style={{ display: 'block', marginBottom: '4px', color: '#166534', fontWeight: 'bold' }}>Nhập thêm hàng (+)</label>
                  <input
                    type="number"
                    value={form.restock_quantity}
                    onChange={(e) => setForm({ ...form, restock_quantity: e.target.value })}
                    placeholder="Số lượng nhập thêm"
                    style={{ borderColor: '#16a34a' }}
                  />
                  <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#15803d' }}>
                    Tổng kho sau khi lưu: <strong>{Number(form.stock_quantity) + Number(form.restock_quantity || 0)}</strong>
                  </p>
                </div>
              )}

              <div style={{ marginTop: '12px' }}>
                <label className="cell-sub" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Hình ảnh sản phẩm</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setImageFile(e.target.files[0]);
                    }
                  }}
                  style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
                />

                {/* Preview Image */}
                {(imageFile || form.image_url) && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                      alt="Xem trước hình ảnh"
                      style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    />
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {imageFile ? (
                        <span style={{ color: '#2563eb', fontWeight: 'bold' }}>Ảnh mới đã chọn (Sẽ tải lên khi nhấn lưu)</span>
                      ) : (
                        <span>Ảnh hiện tại trên Cloudinary</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '12px' }}>
                <label className="cell-sub" style={{ display: 'block', marginBottom: '4px' }}>Ghi chú</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Mô tả sản phẩm hoặc ghi chú nhập hàng..."
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button type="button" className="ghost-btn" onClick={() => setShowModal(false)} disabled={uploadingImage}>Hủy</button>
                <button type="submit" className="primary-btn" disabled={uploadingImage}>
                  {uploadingImage ? 'Đang tải ảnh...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận bán hàng & Chọn phương thức */}
      {sellingItem && (
        <div className="modal-backdrop" onClick={() => setSellingItem(null)}>
          <div className="modal-panel" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '8px' }}>Xác nhận bán hàng</h3>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Sản phẩm:</p>
              <p style={{ margin: '4px 0', fontSize: '18px', fontWeight: 'bold' }}>{sellingItem.name}</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
                <span>Số lượng: <strong>x{sellQuantities[sellingItem.id]}</strong></span>
                <span style={{ color: '#2563eb', fontWeight: '800' }}>
                  Tổng: {(Number(sellingItem.price || 0) * (sellQuantities[sellingItem.id] || 1)).toLocaleString('vi-VN')}đ
                </span>
              </div>
            </div>

            <p style={{ fontWeight: '600', marginBottom: '8px' }}>Phương thức thanh toán:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#0f172a', height: '48px' }}
                onClick={() => handleSell(sellingItem, 'TM')}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#2563eb', height: '48px' }}
                onClick={() => handleSell(sellingItem, 'CK')}
              >
                Chuyển khoản
              </button>
            </div>

            <button
              type="button"
              className="ghost-btn"
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => setSellingItem(null)}
            >
              Quay lại
            </button>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa sản phẩm */}
      {deletingProduct && (
        <div className="modal-backdrop" onClick={() => setDeletingProduct(null)}>
          <div className="modal-panel" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#dc2626' }}>Xác nhận xóa sản phẩm</h3>
            <p>
              Bạn có chắc muốn xóa sản phẩm <strong>{deletingProduct.name}</strong> khỏi kho?
              Hành động này sẽ xóa toàn bộ dữ liệu liên quan.
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setDeletingProduct(null)}>Hủy</button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#dc2626' }}
                onClick={handleConfirmDelete}
              >
                Xóa sản phẩm
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
