// Modal thêm/sửa sản phẩm, nhập hàng, ảnh
export default function ProductFormModal({
  editingProduct,
  form,
  setForm,
  imageFile,
  setImageFile,
  uploadingImage,
  handleAddOrUpdate,
  setShowModal,
}) {
  return (
    <div className="modal-backdrop" onClick={() => setShowModal(false)}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h3>{editingProduct ? 'Cập nhật / Nhập hàng' : 'Thêm sản phẩm nước'}</h3>
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

          <div className="form-grid-2">
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
            <div>
              <label className="cell-sub" style={{ display: 'block', marginBottom: '4px' }}>Tồn kho hiện tại</label>
              <input
                type="number"
                value={form.stock_quantity}
                onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                placeholder="Số lượng"
                required
                disabled={editingProduct !== null}
              />
            </div>
          </div>

          {editingProduct && (
            <div style={{ marginTop: '12px', padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <label className="cell-sub" style={{ display: 'block', marginBottom: '4px', color: '#166534', fontWeight: 'bold' }}>Nhập thêm hàng (+)</label>
              <input
                type="number"
                value={form.restock_quantity}
                onChange={(e) => setForm({ ...form, restock_quantity: e.target.value })}
                placeholder="Số lượng nhập thêm"
                style={{ borderColor: '#16a34a' }}
              />
              <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#15803d' }}>
                Tổng kho sau khi lưu: <strong>{Number(form.stock_quantity) + Number(form.restock_quantity || 0)}</strong>
              </p>
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <label className="cell-sub" style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>Hình ảnh sản phẩm</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImageFile(e.target.files[0]);
                }
              }}
              style={{ width: '100%', padding: '6px', border: '1px solid #cbd5e1', borderRadius: '8px' }}
            />

            {/* Preview Image */}
            {(imageFile || form.image_url) && (
              <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={imageFile ? URL.createObjectURL(imageFile) : form.image_url}
                  alt="Xem trước hình ảnh"
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  {imageFile ? (
                    <span style={{ color: '#2563eb', fontWeight: 'bold' }}>Ảnh mới đã chọn (Sẽ tải lên khi nhấn lưu)</span>
                  ) : (
                    <span>Ảnh hiện tại trên Cloudinary</span>
                  )}
                </div>
              </div>
            )}
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
            <button type="button" className="ghost-btn" onClick={() => setShowModal(false)} disabled={uploadingImage}>Hủy</button>
            <button type="submit" className="primary-btn" disabled={uploadingImage}>
              {uploadingImage ? 'Đang tải ảnh...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
