import { CupSoda, Minus, Plus, Search } from 'lucide-react';

// Mốc để vẽ thanh tồn kho: từ 50 chai trở lên coi như đầy
const STOCK_FULL = 50;

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
      <div className="search-box pos-search">
        <Search size={16} />
        <input
          type="text"
          placeholder="Tìm nhanh nước uống..."
          value={salesSearchTerm}
          onChange={(e) => setSalesSearchTerm(e.target.value)}
        />
      </div>

      <div className="pos-grid">
        {products
          .filter(item => item.name.toLowerCase().includes(salesSearchTerm.toLowerCase()))
          .map((item) => {
            const qty = sellQuantities[item.id] || 1;
            const stock = Number(item.stock_quantity || 0);
            const isOutOfStock = stock <= 0;
            const isLowStock = stock < 10;
            const fill = Math.min(100, Math.round((stock / STOCK_FULL) * 100));

            return (
              <div
                key={item.id}
                className={`pos-card ${isOutOfStock ? 'is-out' : isLowStock ? 'is-low' : ''}`}
              >
                <div className="pos-card-body">
                  <div className="pos-card-top">
                    <div className="pos-thumb" aria-hidden="true">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt=""
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <CupSoda size={22} />
                      )}
                    </div>
                    <h4 className="pos-name" title={item.name}>{item.name}</h4>
                  </div>

                  <div className="pos-price-row">
                    <p className="pos-price">
                      {Number(item.price || 0).toLocaleString('vi-VN')}<small>đ</small>
                    </p>
                    <span className="pos-stock-pill">
                      {isOutOfStock ? 'Hết hàng' : isLowStock ? `Sắp hết · ${stock}` : `Còn ${stock}`}
                    </span>
                  </div>

                  <div className="stock-meter-bar" aria-hidden="true"><span style={{ width: `${fill}%` }} /></div>
                </div>

                <div className="pos-actions">
                  <div className="qty-stepper">
                    <button
                      type="button"
                      aria-label="Bớt 1"
                      onClick={(e) => { e.stopPropagation(); handleQtyChange(item.id, -1, item.stock_quantity); }}
                      disabled={isOutOfStock || qty <= 1}
                    >
                      <Minus size={18} />
                    </button>
                    <span>{qty}</span>
                    <button
                      type="button"
                      aria-label="Thêm 1"
                      onClick={(e) => { e.stopPropagation(); handleQtyChange(item.id, 1, item.stock_quantity); }}
                      disabled={isOutOfStock || qty >= item.stock_quantity}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <button
                    type="button"
                    className="btn-sell-pos"
                    onClick={() => setSellingItem(item)}
                    disabled={isOutOfStock}
                  >
                    Bán
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
