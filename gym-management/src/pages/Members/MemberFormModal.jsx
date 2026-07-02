import { formatDate } from '../../utils/formatters';
import logo from '../../assets/logo.png';



export default function MemberFormModal({
  editingMember,
  form,
  onFormChange,
  onSubmit,
  onCancel,
  historyLogs,
  historyLoading,
  profile,
  onLogVerification,
  submitting
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-panel" style={{ width: 'min(900px, 96vw)', maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img src={logo} alt="Logo" style={{ width: '40px', height: 'auto', borderRadius: '8px' }} />
            <h3 style={{ margin: 0 }}>Chi tiết hội viên: {editingMember?.full_name || 'Mới'}</h3>
          </div>
          <button className="ghost-btn" onClick={onCancel} disabled={submitting}>Đóng</button>
        </div>

        <div className="form-grid-2" style={{ gap: '24px', alignItems: 'start' }}>
          {/* Cột 1: Thông tin hội viên */}
          <div className="modern-card" style={{ padding: '20px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>Thông tin cơ bản</h4>
            <form className="modern-form" onSubmit={onSubmit}>
              <div className="form-grid-2">
                <div>
                  <label className="cell-sub">Mã HV (Không bắt buộc)</label>
                  <input
                    value={form.member_code}
                    onChange={(e) => onFormChange('member_code', e.target.value)}
                    placeholder="Mã hội viên"
                  />
                </div>
                <div>
                  <label className="cell-sub">Họ tên</label>
                  <input
                    value={form.full_name}
                    onChange={(e) => onFormChange('full_name', e.target.value)}
                    placeholder="Họ tên hội viên"
                    required
                  />
                </div>
              </div>

              {!editingMember && (
                <>
                  <div style={{ marginTop: '12px' }}>
                    <label className="cell-sub">Ngày bắt đầu tập</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => onFormChange('start_date', e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <label className="cell-sub">Loại gói</label>
                    <select
                      value={form.membership_category}
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
                        value={form.package_type}
                        onChange={(e) => onFormChange('package_type', e.target.value)}
                        placeholder="Gói (tháng)"
                        required
                      />
                    </div>
                    <div>
                      <label className="cell-sub">Phí hội viên</label>
                      <input
                        type="number"
                        value={form.fee}
                        onChange={(e) => onFormChange('fee', e.target.value)}
                        placeholder="Phí hội viên"
                        required
                      />
                    </div>
                  </div>
                </>
              )}

              {!editingMember && (
                <div>
                  <label className="cell-sub">Hình thức thanh toán</label>
                  <select
                    value={form.payment_method}
                    onChange={(e) => onFormChange('payment_method', e.target.value)}
                  >
                    <option value="TM">TM - Tiền mặt</option>
                    <option value="CK">CK - Chuyển khoản</option>
                  </select>
                </div>
              )}

              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <input
                  type="checkbox"
                  id="fingerprint_status"
                  checked={form.fingerprint_status}
                  onChange={(e) => onFormChange('fingerprint_status', e.target.checked)}
                  disabled={editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')}
                  style={{ width: '20px', height: '20px', cursor: (editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')) ? 'not-allowed' : 'pointer', accentColor: '#2563eb' }}
                />
                <label
                  htmlFor="fingerprint_status"
                  style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: (editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')) ? '#94a3b8' : '#334155',
                    cursor: (editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')) ? 'not-allowed' : 'pointer',
                    userSelect: 'none',
                    margin: 0
                  }}
                >
                  {editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')
                    ? 'Đã đăng ký vân tay (Đã thiết lập)'
                    : 'Đã đăng ký vân tay'}
                </label>
              </div>

              {editingMember && (
                <div style={{ marginTop: '12px' }}>
                  <label className="cell-sub">Ngày hết hạn</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => onFormChange('end_date', e.target.value)}
                  />
                </div>
              )}

              <div style={{ marginTop: '8px' }}>
                <label className="cell-sub">Ghi chú</label>
                <textarea
                  rows={3}
                  value={form.note}
                  onChange={(e) => onFormChange('note', e.target.value)}
                  placeholder="Ghi chú"
                />
              </div>

              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button type="submit" className="primary-btn" style={{ width: '100%' }} disabled={submitting}>
                  {submitting 
                    ? 'Đang xử lý...' 
                    : (editingMember ? 'Cập nhật thông tin' : 'Tạo hội viên mới')}
                </button>
              </div>
            </form>
          </div>

          {/* Cột 2: Lịch sử gia hạn */}
          <div className="modern-card" style={{ padding: '20px', border: '1px solid #e2e8f0', flex: 1 }}>
            <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>Lịch sử gia hạn & Hoạt động</h4>

            <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {editingMember ? (
                <div className="modern-table-wrap" style={{ border: 'none' }}>
                  <table className="modern-table" style={{ minWidth: '100%' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr>
                        <th>Ngày</th>
                        <th>Hành động</th>
                        <th>Chi tiết gói</th>
                        {profile?.role === 'admin' && <th>Nhân viên</th>}
                        {profile?.role === 'admin' && <th>Thanh toán</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {historyLoading ? (
                        <tr><td colSpan={profile?.role === 'admin' ? 5 : 3} className="table-empty-cell">Đang tải...</td></tr>
                      ) : historyLogs.length === 0 ? (
                        <tr><td colSpan={profile?.role === 'admin' ? 5 : 3} className="table-empty-cell">Chưa có lịch sử</td></tr>
                      ) : historyLogs.map(log => (
                        <tr key={log.id} style={{ fontSize: '12px' }}>
                          <td>{formatDate(log.created_at)}</td>
                          <td>
                            <strong style={{ color: '#0f172a' }}>
                              {log.action === 'CREATE' && '🆕 Đăng ký'}
                              {log.action === 'RENEW' && '⏳ Gia hạn'}
                              {log.action === 'UPDATE' && '📝 Sửa'}
                              {log.action === 'VERIFY_PAYMENT' && '✅ Duyệt'}
                            </strong>
                          </td>
                          <td>
                            {log.package_type && (
                              <div>{log.package_type} th - {Number(log.fee || 0).toLocaleString()}đ</div>
                            )}
                            <div className="cell-sub">{log.note}</div>
                          </td>
                          {profile?.role === 'admin' && (
                            <td>{log.staff_members?.full_name || log.profiles?.full_name || 'Hệ thống'}</td>
                          )}
                          {profile?.role === 'admin' && (
                            <td>
                              {log.payment_method === 'CK' && !log.is_payment_verified ? (
                                <button
                                  className="primary-btn"
                                  style={{ background: '#f59e0b', padding: '6px 10px', fontSize: '11px' }}
                                  onClick={() => onLogVerification(log)}
                                >
                                  Duyệt CK
                                </button>
                              ) : log.payment_method === 'CK' ? (
                                <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Đã duyệt</span>
                              ) : log.payment_method === 'TM' ? (
                                <span style={{ color: '#64748b' }}>Tiền mặt</span>
                              ) : null}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="modern-info">Lịch sử sẽ hiển thị sau khi hội viên được tạo.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
