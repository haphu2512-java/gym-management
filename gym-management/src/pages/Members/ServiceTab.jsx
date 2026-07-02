import { useEffect, useState, useCallback } from 'react';
import { Plus, Minus, Trash2, ShoppingCart, Settings } from 'lucide-react';
import { additionalService } from '../../services/additionalService';
import { useAuthStore } from '../../store/useAuthStore';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { useToast, ToastContainer } from '../../components/ui/Toast';
import { formatDateTime } from '../../utils/formatters';

export default function ServiceTab() {
  const { user, profile, activeStaff } = useAuthStore();
  const { showError, showSuccess, toasts } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState('sales'); // 'sales' or 'admin'
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({ name: '', price: '', note: '' });

  // Quantities for sales
  const [sellQuantities, setSellQuantities] = useState({});

  // Doanh thu dịch vụ của ca hiện tại
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
          const rev = await additionalService.getServiceRevenueForShift(shift.id);
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
      const data = await additionalService.getAllServices();
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
      additionalService.getFilteredServiceLogs({ 
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
    setForm({ name: '', price: '', note: '' });
    setShowModal(true);
  };

  const handleOpenEdit = (product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      price: String(product.price),
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
        note: form.note,
      };

      if (editingProduct) {
        await additionalService.updateService(editingProduct.id, payload);
        await staffLogService.logAction({
          staffId: activeStaff?.id || user?.id,
          action: 'Cập nhật dịch vụ',
          targetItem: editingProduct.name,
          details: { before: editingProduct.price, after: payload.price },
          note: 'Admin cập nhật dịch vụ',
        });
      } else {
        await additionalService.addService(payload);
        await staffLogService.logAction({
          staffId: activeStaff?.id || user?.id,
          action: 'Thêm dịch vụ',
          targetItem: payload.name,
          details: { price: payload.price },
          note: 'Admin thêm dịch vụ mới',
        });
      }

      setShowModal(false);
      setEditingProduct(null);
      setForm({ name: '', price: '', note: '' });
      await loadProducts();
      showSuccess('Cập nhật thành công!');
    } catch (err) {
      setError(err.message);
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
      await additionalService.sellService(
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
        action: 'Bán dịch vụ',
        targetItem: product.name,
        details: { qty, total: Number(product.price || 0) * qty, method },
        note: 'Nhân viên bán dịch vụ (Tập ngày, PT...)',
      });

      // Reset quantity to 1
      setSellQuantities(prev => ({ ...prev, [product.id]: 1 }));

      // Cập nhật doanh thu dịch vụ real-time
      if (shiftId) {
        const rev = await additionalService.getServiceRevenueForShift(shiftId);
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

  // Xóa sản phẩm (chỉ admin)
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    setError('');
    try {
      await additionalService.deleteService(deletingProduct.id);
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
          <h3 className="modern-title">Dịch vụ bổ sung</h3>
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
            DT Dịch vụ: {drinkRevenue.toLocaleString('vi-VN')}đ
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
              <Plus size={16} /> Thêm dịch vụ
            </button>
          )}
        </div>
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang xử lý...</div>}

      {/* POS Grid View */}
      {viewMode === 'sales' ? (
        <div className="pos-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '8px' }}>
          {products.map((item) => {
            const qty = sellQuantities[item.id] || 1;
            const isService = item.product_type === 'service';
            const isOutOfStock = !isService && Number(item.stock_quantity || 0) <= 0;
            const isLowStock = !isService && Number(item.stock_quantity || 0) < 10;

            return (
              <div key={item.id} className="pos-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', transition: 'all 0.2s', opacity: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ width: '40px', height: '40px', background: '#f8fafc', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 'bold', color: '#64748b' }}>
                    {item.name.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ 
                    fontSize: '11px', 
                    padding: '2px 8px', 
                    borderRadius: '99px', 
                    fontWeight: 'bold',
                    background: '#e0e7ff',
                    color: '#4f46e5'
                  }}>
                    Dịch vụ
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
                    onClick={() => handleQtyChange(item.id, -1, 999)}
                    style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{qty}</span>
                  <button 
                    onClick={() => handleQtyChange(item.id, 1, 999)}
                    style={{ width: '32px', height: '32px', border: 'none', background: '#fff', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <button 
                  className="primary-btn" 
                  style={{ width: '100%', borderRadius: '10px', padding: '10px' }}
                  onClick={() => setSellingItem(item)}
                >
                  Bán hàng
                </button>
              </div>
            );
          })}
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
                  <th>Thanh toán</th>
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
                    <td><p className="cell-main">{log.services?.name || 'N/A'}</p></td>
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
                <th>Dịch vụ</th>
                <th>Giá bán</th>
                <th>Loại</th>
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
                    <span className="stock-badge ok" style={{ background: '#e0e7ff', color: '#4f46e5' }}>Dịch vụ</span>
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
            <h3>{editingProduct ? 'Cập nhật dịch vụ' : 'Thêm dịch vụ'}</h3>
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

              <div className="form-grid-2" style={{ marginBottom: '12px' }}>
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
                <button type="button" className="ghost-btn" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="primary-btn">Lưu thay đổi</button>
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
                disabled={submitting}
              >
                {submitting ? '...' : 'Tiền mặt'}
              </button>
              <button 
                type="button" 
                className="primary-btn" 
                style={{ background: '#2563eb', height: '48px' }}
                onClick={() => handleSell(sellingItem, 'CK')}
                disabled={submitting}
              >
                {submitting ? '...' : 'Chuyển khoản'}
              </button>
            </div>
            
            <button 
              type="button" 
              className="ghost-btn" 
              style={{ width: '100%', marginTop: '12px' }}
              onClick={() => setSellingItem(null)}
              disabled={submitting}
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
