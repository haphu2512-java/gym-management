export default function DeleteConfirmModal({
  member,
  onConfirm,
  onCancel
}) {
  if (!member) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: '#dc2626' }}>Xác nhận xóa hội viên</h3>
        <p>
          Bạn có chắc muốn xóa hội viên <strong>{member.full_name}</strong> ({member.member_code})?
          Hành động này sẽ ẩn hội viên khỏi danh sách quản lý.
        </p>
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>Hủy</button>
          <button
            type="button"
            className="primary-btn"
            style={{ background: '#dc2626' }}
            onClick={onConfirm}
          >
            Xác nhận xóa
          </button>
        </div>
      </div>
    </div>
  );
}
