import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { productService } from '../../services/productService';
import { useAuthStore } from '../../store/useAuthStore';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';

export default function Inventory() {
  const { user, profile, assignedShift } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: '', note: '' });

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
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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
    } catch (err) {
      setError(err.message);
    }
  };

  // Bán 1 chai — cập nhật doanh thu ngay sau khi bán
  const handleSell = async (product) => {
    setError('');
    try {
      const shiftId = activeShift?.id || null;
      const updated = await productService.sellOneBottle(product, shiftId, user?.id);
      setProducts((prev) => prev.map((item) => (item.id === product.id ? updated : item)));

      // Cập nhật doanh thu nước real-time
      if (shiftId) {
        const rev = await productService.getDrinkRevenueForShift(shiftId);
        setDrinkRevenue(rev);
      }
    } catch (err) {
      setError(err.message);
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
    } catch (err) {
      setError(err.message);
      setDeletingProduct(null);
    }
  };

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Kho nước &amp; bán hàng</h3>
          <p className="muted-text">Quản lý tồn kho theo thời gian thực.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Doanh thu nước ca hiện tại */}
          <div style={{
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: '12px',
            padding: '8px 14px',
            fontSize: '13px',
            fontWeight: '800',
            color: '#047857',
          }}>
            DT Nước ({activeShift?.shift_name || 'Chưa mở ca'}): {drinkRevenue.toLocaleString('vi-VN')}đ
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
                      className="dark-btn"
                      onClick={() => handleSell(item)}
                      disabled={Number(item.stock_quantity || 0) <= 0}
                    >
                      <Plus size={14} style={{ marginRight: '4px' }} /> Bán 1
                    </button>
                    {profile?.role === 'admin' && (
                      <>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => handleOpenEdit(item)}
                        >
                          Nhập / Sửa
                        </button>
                        <button
                          type="button"
                          className="ghost-btn"
                          style={{ color: '#dc2626', background: '#fef2f2' }}
                          onClick={() => setDeletingProduct(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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

      {/* Modal xác nhận xóa sản phẩm */}
      {deletingProduct && (
        <div className="modal-backdrop" onClick={() => setDeletingProduct(null)}>
          <div className="modal-panel" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#dc2626' }}>Xác nhận xóa sản phẩm</h3>
            <p>
              Bạn có chắc muốn xóa sản phẩm <strong>{deletingProduct.name}</strong> khỏi kho?
              Hành động này sẽ xóa toàn bộ dữ liệu liên quan và không thể hoàn tác.
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
    </div>
  );
}
