import { useState } from 'react';

export default function DeleteConfirmModal({
  member,
  hasActiveShift,
  onConfirm,
  onCancel
}) {
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('TM');
  const [note, setNote] = useState('');

  if (!member) return null;

  const refund = Number(refundAmount || 0);
  const invalidRefund = refund < 0 || (refund > 0 && !hasActiveShift);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: '#dc2626' }}>Xác nhận xóa hội viên</h3>
        <p>
          Bạn có chắc muốn xóa hội viên <strong>{member.full_name}</strong> ({member.member_code})?
          Hội viên sẽ bị ẩn khỏi danh sách. Các khoản đã thu trước đây vẫn giữ nguyên trong doanh thu.
        </p>

        <div className="modern-form" style={{ marginTop: '12px' }}>
          <label className="field-label">Số tiền hoàn lại cho khách (để trống nếu không hoàn)</label>
          <input
            type="number"
            min="0"
            step="1000"
            placeholder="0"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
          {refund > 0 && (
            <>
              <label className="field-label">Hình thức hoàn tiền</label>
              <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
                <option value="TM">Tiền mặt</option>
                <option value="CK">Chuyển khoản</option>
              </select>
              <label className="field-label">Lý do</label>
              <input
                type="text"
                placeholder="VD: Khách nghỉ, nhập nhầm..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <p className="cell-sub" style={{ marginTop: '4px' }}>
                Khoản hoàn tiền -{refund.toLocaleString()}đ sẽ được ghi vào ca đang mở.
              </p>
            </>
          )}
          {refund > 0 && !hasActiveShift && (
            <div className="modern-error">Cần mở ca trước khi ghi nhận hoàn tiền.</div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>Hủy</button>
          <button
            type="button"
            className="primary-btn"
            style={{ background: '#dc2626' }}
            disabled={invalidRefund}
            onClick={() => onConfirm({ refundAmount: refund, refundMethod, note })}
          >
            Xác nhận xóa
          </button>
        </div>
      </div>
    </div>
  );
}
