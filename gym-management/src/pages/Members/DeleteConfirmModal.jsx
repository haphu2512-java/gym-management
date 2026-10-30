import { useState } from 'react';

const methodLabel = (m) => (m === 'CK' ? 'chuyển khoản' : 'tiền mặt');

export default function DeleteConfirmModal({
  member,
  hasActiveShift,
  shiftPayments = [],
  paymentsLoading = false,
  onConfirm,
  onCancel
}) {
  // Khoản thu trong ca đang mở (khoản dương); có thì mặc định là xóa do nhập nhầm
  const mistakePayments = shiftPayments.filter((p) => Number(p.amount) > 0);
  const canVoid = hasActiveShift && mistakePayments.length > 0;
  const [reason, setReason] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundMethod, setRefundMethod] = useState('TM');
  const [note, setNote] = useState('');

  if (!member) return null;

  const mode = reason ?? (canVoid ? 'mistake' : 'quit');
  const voidTotal = mistakePayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const refund = Number(refundAmount || 0);
  const invalidRefund = refund < 0 || (refund > 0 && !hasActiveShift);
  const disabled = paymentsLoading
    || (mode === 'mistake' && !canVoid)
    || (mode === 'quit' && invalidRefund);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: 'var(--danger)' }}>Xác nhận xóa hội viên</h3>
        <p>
          Xóa hội viên <strong>{member.full_name}</strong> ({member.member_code})? Hội viên sẽ bị ẩn khỏi danh sách.
        </p>

        <div className="modern-form" style={{ marginTop: '12px' }}>
          <label className="field-label">Lý do xóa</label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', opacity: canVoid ? 1 : 0.5 }}>
            <input
              type="radio"
              style={{ width: 'auto', flex: 'none', margin: '3px 0 0' }}
              name="delete-reason"
              checked={mode === 'mistake'}
              disabled={!canVoid}
              onChange={() => setReason('mistake')}
            />
            <span>
              <strong>Bấm nhầm / nhập nhầm trong ca này</strong>
              <div className="cell-sub">
                {paymentsLoading
                  ? 'Đang kiểm tra khoản thu trong ca...'
                  : canVoid
                    ? `Hủy các khoản đã thu trong ca đang mở: ${mistakePayments
                        .map((p) => `${Number(p.amount).toLocaleString('vi-VN')}đ ${methodLabel(p.payment_method)}`)
                        .join(', ')}. Tiền ca trừ lại đúng số này.`
                    : 'Chỉ dùng được khi hội viên được thu tiền trong ca đang mở.'}
              </div>
            </span>
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '8px' }}>
            <input
              type="radio"
              style={{ width: 'auto', flex: 'none', margin: '3px 0 0' }}
              name="delete-reason"
              checked={mode === 'quit'}
              onChange={() => setReason('quit')}
            />
            <span>
              <strong>Khách nghỉ / lý do khác</strong>
              <div className="cell-sub">Các khoản đã thu giữ nguyên trong doanh thu. Có thể ghi hoàn tiền bên dưới.</div>
            </span>
          </label>

          {mode === 'quit' && (
            <>
              <label className="field-label" style={{ marginTop: '12px' }}>Số tiền hoàn lại cho khách (để trống nếu không hoàn)</label>
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
                  <p className="cell-sub" style={{ marginTop: '4px' }}>
                    Khoản hoàn tiền -{refund.toLocaleString('vi-VN')}đ sẽ được ghi vào ca đang mở.
                  </p>
                </>
              )}
              {refund > 0 && !hasActiveShift && (
                <div className="modern-error">Cần mở ca trước khi ghi nhận hoàn tiền.</div>
              )}
            </>
          )}

          <label className="field-label" style={{ marginTop: '12px' }}>Ghi chú</label>
          <input
            type="text"
            placeholder={mode === 'mistake' ? 'VD: Nhập trùng, chọn nhầm gói...' : 'VD: Khách nghỉ...'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onCancel}>Hủy</button>
          <button
            type="button"
            className="primary-btn"
            style={{ background: 'var(--danger)' }}
            disabled={disabled}
            onClick={() => onConfirm(mode === 'mistake'
              ? { voidCurrentShift: true, voidTotal, note }
              : { refundAmount: refund, refundMethod, note })}
          >
            {mode === 'mistake' ? `Xóa và hủy ${voidTotal.toLocaleString('vi-VN')}đ` : 'Xác nhận xóa'}
          </button>
        </div>
      </div>
    </div>
  );
}
