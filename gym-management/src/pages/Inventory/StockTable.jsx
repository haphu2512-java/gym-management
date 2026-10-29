import { Settings, Trash2 } from 'lucide-react';

// Tab quản lý kho (admin): danh sách sản phẩm, sửa, xóa
export default function StockTable({
  loading,
  products,
  handleOpenEdit,
  setDeletingProduct,
}) {
  return (
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
  );
}
