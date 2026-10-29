// Modal xác nhận xóa sản phẩm
export default function DeleteProductModal({
  deletingProduct,
  setDeletingProduct,
  handleConfirmDelete,
}) {
  return (
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
  );
}
