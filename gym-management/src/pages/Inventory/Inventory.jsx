import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, Settings } from 'lucide-react';
import { productService } from '../../services/productService';
import { useAuthStore } from '../../store/useAuthStore';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { useToast, ToastContainer } from '../../components/ui/Toast';

export default function Inventory() {
  const { user, profile, assignedShift } = useAuthStore();
  const { showError, showSuccess, toasts } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('sales'); // 'sales' or 'admin'
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: '', note: '' });

  // Quantities for sales
  const [sellQuantities, setSellQuantities] = useState({});

  // Doanh thu nước của ca hiện tại
  const [drinkRevenue, setDrinkRevenue] = useState(0);
  const [activeShift, setActiveShift] = useState(assignedShift || null);

  // Xác nhận xóa
  const [deletingProduct, setDeletingProduct] = useState(null);

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

  const handleQtyChange = (id, delta, stock) => {
    setSellQuantities(prev => {
      const current = prev[id] || 1;
      const next = Math.max(1, Math.min(stock, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleOpenCreate = () => {
    setEditingProduct(null);
    setForm({ name: '', price: '', stock_quantity: '', note: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      price: String(product.price),
      stock_quantity: String(product.stock_quantity),
      note: product.note || ''
    });
    setShowModal(true);
  };

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = {
        name: form.name,
        price: Number(form.price || 0),
        stock_quantity: Number(form.stock_quantity || 0),
        note: form.note,
      };

      if (editingProduct) {
        await productService.updateProduct(editingProduct.id, payload);
        await staffLogService.logAction({
          staffId: user?.id,
          action: 'Nhập/Sửa kho',
          targetItem: editingProduct.name,
          details: { before: editingProduct.stock_quantity, after: payload.stock_quantity },
          note: 'Admin cập nhật sản phẩm',
        });
      } else {
        await productService.addProduct(payload);
        await staffLogService.logAction({
          staffId: user?.id,
          action: 'Thêm sản phẩm',
          targetItem: payload.name,
          details: { quantity: payload.stock_quantity },
          note: 'Admin thêm sản phẩm mới',
        });
      }

      setShowModal(false);
      setEditingProduct(null);
      setForm({ name: '', price: '', stock_quantity: '', note: '' });
      await loadProducts();
      showSuccess('Cập nhật kho thành công!');
    } catch (err) {
      setError(err.message);
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
      await productService.sellProduct(product, qty, shiftId, user?.id, method);

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
        staffId: user?.id,
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
            <button 
              className={`tab-btn ${viewMode === 'admin' ? 'active' : ''}`}
              onClick={() => setViewMode('admin')}
              style={{ padding: '6px 12px', border: 'none', borderRadius: '6px', fontSize: '13px', cursor: 'pointer', background: viewMode === 'admin' ? '#fff' : 'transparent', fontWeight: viewMode === 'admin' ? '600' : 'normal', boxShadow: viewMode === 'admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}
            >
              Quản lý kho
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
      {loading && <div className="modern-info">Đang tải kho...</div>}

      {/* POS Grid View */}
      {viewMode === 'sales' ? (
        <div className="pos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '8px' }}>
          {products.map((item) => {
            const qty = sellQuantities[item.id] || 1;
            const isOutOfStock = Number(item.stock_quantity || 0) <= 0;
            const isLowStock = Number(item.stock_quantity || 0) < 10;

            return (
              <div key={item.id} className="pos-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'all 0.2s', opacity: isOutOfStock ? 0.7 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', color: '#64748b' }}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '99px', 
                    fontWeight: 'bold',
                    background: isOutOfStock ? '#fee2e2' : (isLowStock ? '#fef9c3' : '#f0fdf4'),
                    color: isOutOfStock ? '#dc2626' : (isLowStock ? '#854d0e' : '#16a34a')
                  }}>
                    Kho: {item.stock_quantity}
                  </span>
                </div>

                <div>
                  <h4 style={{ margin: 0, fontSize: '15px', color: '#0f172a' }}>{item.name}</h4>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#2563eb' }}>
                    {Number(item.price || 0).toLocaleString('vi-VN')}đ
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc', padding: '4px', borderRadius: '10px', marginTop: 'auto' }}>
                  <button 
                    onClick={() => handleQtyChange(item.id, -1, item.stock_quantity)}
                    style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    disabled={isOutOfStock}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{qty}</span>
                  <button 
                    onClick={() => handleQtyChange(item.id, 1, item.stock_quantity)}
                    style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                    disabled={isOutOfStock || qty >= item.stock_quantity}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button 
                  className="primary-btn" 
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                  onClick={() => setSellingItem(item)}
                  disabled={isOutOfStock}
                >
                  Bán hàng
                </button>
              </div>
            );
          })}
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
                    <p className="cell-main">{item.name}</p>
                    {item.note && <p className="cell-sub">{item.note}</p>}
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
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Tên sản phẩm"
                required
              />
              <div className="form-grid-2">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="Giá bán"
                  required
                />
                <input
                  type="number"
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                  placeholder="Số lượng"
                  required
                />
              </div>
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú"
              />
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="primary-btn">Lưu</button>
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
