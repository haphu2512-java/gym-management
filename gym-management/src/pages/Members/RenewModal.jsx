function calculateFee(category, packageType) {
  const PRICING_TIERS = {
    normal: { 1: 350000, 3: 795000, 6: 1440000 },
    couple: { 1: 320000, 3: 720000, 6: 1320000 },
    team: { 1: 300000, 3: 660000, 6: 1200000 }
  };
  return PRICING_TIERS[category]?.[packageType] || '';
}

export default function RenewModal({
  member,
  renewForm,
  onFormChange,
  onSubmit,
  onCancel
}) {
  if (!member) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h3>Gia hạn hội viên: {member.full_name}</h3>
        <form className="modern-form" onSubmit={onSubmit}>
          <div>
            <label className="cell-sub">Loại gói</label>
            <select
              value={renewForm.membership_category}
              onChange={(e) => onFormChange('membership_category', e.target.value)}
            >
              <option value="normal">Thường</option>
              <option value="couple">Couple</option>
              <option value="team">Team</option>
            </select>
          </div>
          <div className="form-grid-2" style={{ marginTop: '12px' }}>
            <div>
              <label className="cell-sub">Gói (tháng)</label>
              <input
                type="number"
                value={renewForm.package_type}
                onChange={(e) => onFormChange('package_type', e.target.value)}
                placeholder="Gói (tháng)"
                required
              />
            </div>
            <div>
              <label className="cell-sub">Phí hội viên</label>
              <input
                type="number"
                value={renewForm.fee}
                onChange={(e) => onFormChange('fee', e.target.value)}
                placeholder="Phí hội viên"
                required
              />
            </div>
          </div>
          <div style={{ marginTop: '12px' }}>
            <label className="cell-sub">Hình thức thanh toán</label>
            <select
              value={renewForm.payment_method}
              onChange={(e) => onFormChange('payment_method', e.target.value)}
            >
              <option value="TM">TM - Tiền mặt</option>
              <option value="CK">CK - Chuyển khoản</option>
            </select>
          </div>
          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="ghost-btn" onClick={onCancel}>Hủy</button>
            <button type="submit" className="primary-btn">Xác nhận gia hạn</button>
          </div>
        </form>
      </div>
    </div>
  );
}
