/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { productService } from '../../services/productService';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', stock_quantity: '', note: '' });

  const loadProducts = async () => {
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
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await productService.addProduct({
        name: form.name,
        price: Number(form.price || 0),
        stock_quantity: Number(form.stock_quantity || 0),
        note: form.note,
      });
      setShowModal(false);
      setForm({ name: '', price: '', stock_quantity: '', note: '' });
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSell = async (product) => {
    setError('');
    try {
      const updated = await productService.sellOneBottle(product);
      setProducts((prev) => prev.map((item) => (item.id === product.id ? updated : item)));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Kho nước & bán hàng</h3>
          <p className="muted-text">Quản lý tồn kho theo thời gian thực.</p>
        </div>
        <button type="button" className="primary-btn" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Thêm sản phẩm
        </button>
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang tải kho...</div>}

      <div className="product-grid">
        {products.map((item) => (
          <div key={item.id} className="modern-card product-card">
            <div>
              <div className="product-top">
                <h4>{item.name}</h4>
                <span className={`stock-badge ${Number(item.stock_quantity || 0) < 10 ? 'low' : 'ok'}`}>
                  Kho: {item.stock_quantity}
                </span>
              </div>
              <p className="product-price">{Number(item.price || 0).toLocaleString('vi-VN')}đ</p>
            </div>
            <button
              type="button"
              className="dark-btn"
              onClick={() => handleSell(item)}
              disabled={Number(item.stock_quantity || 0) <= 0}
            >
              <Plus size={16} /> Bán 1 chai
            </button>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Thêm sản phẩm nước</h3>
            <form className="modern-form" onSubmit={handleAdd}>
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
    </div>
  );
}


