// Modal xác nhận bán và chọn phương thức thanh toán
export default function SellConfirmModal({
  sellingItem,
  setSellingItem,
  sellQuantities,
  submitting,
  handleSell,
}) {
  return (
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
  );
}
