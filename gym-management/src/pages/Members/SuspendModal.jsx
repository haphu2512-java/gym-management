import { formatDate } from '../../utils/formatters';

export default function SuspendModal({
  member,
  suspendInfo,
  onConfirm,
  onCancel,
  submitting
}) {
  if (!member) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: 'var(--warn)' }}>Bảo lưu hội viên</h3>
        <p style={{ fontSize: '14px', color: 'var(--muted)', marginBottom: '20px' }}>
          Hội viên <strong>{member.full_name}</strong> sẽ được tạm dừng gói tập từ hôm nay.
        </p>
        <div className="modern-info" style={{ background: 'var(--warn-soft)', border: '1px solid var(--warn-soft)', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Ngày hết hạn hiện tại:</span>
            <strong>{formatDate(suspendInfo.endDate)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Số ngày còn lại:</span>
            <strong style={{ color: 'var(--warn-ink)', fontSize: '18px' }}>{suspendInfo.remainingDays} ngày</strong>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--subtle)' }}>
          * Lưu ý: Sau khi bảo lưu, hội viên sẽ không thể check-in cho đến khi được kích hoạt lại.
        </p>
        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button type="button" className="ghost-btn" onClick={onCancel} disabled={submitting}>Hủy</button>
          <button
            type="button"
            className="primary-btn"
            style={{ background: 'var(--warn)' }}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận bảo lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}
