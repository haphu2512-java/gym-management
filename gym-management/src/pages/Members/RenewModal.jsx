import { formatDate, getLocalISODate } from '../../utils/formatters';

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

  const todayStr = getLocalISODate();
  const isExpired = member.end_date && member.end_date < todayStr;

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
                min="1"
                max="36"
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

          {isExpired && (
            <div style={{ marginTop: '14px' }}>
              <label className="cell-sub" style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>Phương thức gia hạn (Hội viên đã hết hạn)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={renewForm.renew_from === 'today'}
                    onChange={() => onFormChange('renew_from', 'today')}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  Gia hạn từ ngày gia hạn (Hôm nay: {formatDate(todayStr)})
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', color: '#334155' }}>
                  <input
                    type="checkbox"
                    checked={renewForm.renew_from === 'expired'}
                    onChange={() => onFormChange('renew_from', 'expired')}
                    style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  Gia hạn từ ngày hết hạn (Ngày hết hạn: {formatDate(member.end_date)})
                </label>
              </div>
            </div>
          )}

          <div className="modal-actions" style={{ marginTop: '16px' }}>
            <button type="button" className="ghost-btn" onClick={onCancel}>Hủy</button>
            <button type="submit" className="primary-btn">Xác nhận gia hạn</button>
          </div>
        </form>
      </div>
    </div>
  );
}
