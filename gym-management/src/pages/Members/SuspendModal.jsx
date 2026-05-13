import { formatDate } from '../../utils/formatters';

export default function SuspendModal({
  member,
  suspendInfo,
  onConfirm,
  onCancel
}) {
  if (!member) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: '#f59e0b' }}>Bảo lưu hội viên</h3>
        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
          Hội viên <strong>{member.full_name}</strong> sẽ được tạm dừng gói tập từ hôm nay.
        </p>
        <div className="modern-info" style={{ background: '#fffbeb', border: '1px solid #fef3c7', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Ngày hết hạn hiện tại:</span>
            <strong>{formatDate(suspendInfo.endDate)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Số ngày còn lại:</span>
            <strong style={{ color: '#b45309', fontSize: '18px' }}>{suspendInfo.remainingDays} ngày</strong>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#94a3b8' }}>
          * Lưu ý: Sau khi bảo lưu, hội viên sẽ không thể check-in cho đến khi được kích hoạt lại.
        </p>
        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="ghost-btn" onClick={onCancel}>Hủy</button>
          <button
            type="button"
            className="primary-btn"
            style={{ background: '#f59e0b' }}
            onClick={onConfirm}
          >
            Xác nhận bảo lưu
          </button>
        </div>
      </div>
    </div>
  );
}
