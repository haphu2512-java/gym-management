import { useEffect, useState, useCallback } from 'react';
import { Plus, ShoppingCart } from 'lucide-react';
import { productService } from '../../services/productService';
import { useAuthStore } from '../../store/useAuthStore';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { useUIStore } from '../../store/useUIStore';
import DeleteProductModal from './DeleteProductModal';
import ProductSalesGrid from './ProductSalesGrid';
import ProductFormModal from './ProductFormModal';
import SalesStatsView from './SalesStatsView';
import SellConfirmModal from './SellConfirmModal';
import StockTable from './StockTable';

export default function Inventory() {
  const { user, profile, activeStaff } = useAuthStore();
  const addToast = useUIStore((state) => state.addToast);
  const showError = (msg) => addToast(msg, 'error');
  const showSuccess = (msg) => addToast(msg, 'success');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    if (submitting) return;
    setError('');
    const shiftId = activeShift?.id || null;
    const qty = sellQuantities[product.id] || 1;

    if (!shiftId) {
      showError('Vui lòng mở ca làm việc trước khi thực hiện bán hàng.');
      return;
    }

    setSubmitting(true);
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
    } finally {
      setSubmitting(false);
    }
  };

  // Kiểm tra quyền rollback bản ghi bán hàng (Chỉ admin, hoặc đồng thời thỏa mãn: trong ca mở, thuộc ca hoạt động và do chính nhân viên đó bán)
  const canRollback = (log) => {
    if (profile?.role === 'admin') return true;
    const isShiftOpen = log.shifts?.status === 'open';
    const isInActiveShift = activeShift && log.shift_id === activeShift.id;
    const isOwnSale = log.sold_by === user?.id || (activeStaff?.id && log.sold_by_member === activeStaff.id);
    return isShiftOpen && isInActiveShift && isOwnSale;
  };

  // Hoàn tác giao dịch bán hàng (Rollback)
  const handleRollback = async (log) => {
    if (!window.confirm(`Bạn có chắc muốn rollback (hoàn tác) giao dịch bán nước "${log.products?.name || 'N/A'}" này?\nHành động này sẽ xóa nhật ký bán hàng và cộng trả lại ${log.quantity} sản phẩm vào kho.`)) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Server ghi luôn nhật ký hoàn tác
      await productService.rollbackSale(log.id, activeStaff?.id);

      // Tải lại danh sách sản phẩm (để cập nhật số lượng tồn kho trên giao diện bán hàng)
      await loadProducts();

      // Cập nhật lại danh sách thống kê
      const updatedLogs = await productService.getFilteredSalesLogs({
        date: statsDate,
        shiftName: statsShiftName,
        paymentMethod: statsPaymentMethod
      });
      setSalesLogs(updatedLogs);

      // Cập nhật lại doanh thu nước của ca hiện tại
      if (activeShift) {
        const rev = await productService.getDrinkRevenueForShift(activeShift.id);
        setDrinkRevenue(rev);
      }

      showSuccess('Hoàn tác giao dịch bán hàng thành công!');
    } catch (err) {
      showError(`Hoàn tác thất bại: ${err.message}`);
    } finally {
      setLoading(false);
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
        <ProductSalesGrid
          products={products}
          salesSearchTerm={salesSearchTerm}
          setSalesSearchTerm={setSalesSearchTerm}
          sellQuantities={sellQuantities}
          handleQtyChange={handleQtyChange}
          setSellingItem={setSellingItem}
        />
      ) : viewMode === 'stats' ? (
        /* Thống kê bán hàng */
        <SalesStatsView
          loading={loading}
          salesLogs={salesLogs}
          statsDate={statsDate}
          setStatsDate={setStatsDate}
          statsShiftName={statsShiftName}
          setStatsShiftName={setStatsShiftName}
          statsPaymentMethod={statsPaymentMethod}
          setStatsPaymentMethod={setStatsPaymentMethod}
          canRollback={canRollback}
          handleRollback={handleRollback}
        />
      ) : (
        /* Admin Table View */
        <StockTable
          loading={loading}
          products={products}
          handleOpenEdit={handleOpenEdit}
          setDeletingProduct={setDeletingProduct}
        />
      )}

      {/* Modal thêm/sửa sản phẩm */}
      {showModal && (
        <ProductFormModal
          editingProduct={editingProduct}
          form={form}
          setForm={setForm}
          imageFile={imageFile}
          setImageFile={setImageFile}
          uploadingImage={uploadingImage}
          handleAddOrUpdate={handleAddOrUpdate}
          setShowModal={setShowModal}
        />
      )}

      {/* Modal xác nhận bán hàng & Chọn phương thức */}
      {sellingItem && (
        <SellConfirmModal
          sellingItem={sellingItem}
          setSellingItem={setSellingItem}
          sellQuantities={sellQuantities}
          submitting={submitting}
          handleSell={handleSell}
        />
      )}

      {/* Modal xác nhận xóa sản phẩm */}
      {deletingProduct && (
        <DeleteProductModal
          deletingProduct={deletingProduct}
          setDeletingProduct={setDeletingProduct}
          handleConfirmDelete={handleConfirmDelete}
        />
      )}

    </div>
  );
}
