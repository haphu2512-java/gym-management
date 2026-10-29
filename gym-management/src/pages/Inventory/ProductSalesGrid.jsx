import { Minus, Plus } from 'lucide-react';

// Tab bán hàng: lưới sản phẩm, chọn số lượng, bấm bán
export default function ProductSalesGrid({
  products,
  salesSearchTerm,
  setSalesSearchTerm,
  sellQuantities,
  handleQtyChange,
  setSellingItem,
}) {
  return (
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
  );
}

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
