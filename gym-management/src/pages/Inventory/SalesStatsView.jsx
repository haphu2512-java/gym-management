import { shiftService } from '../../services/shiftService';
import { formatDateTime } from '../../utils/formatters';

// Tab thống kê: lịch sử bán nước theo ngày/ca/HTTT, hoàn tác giao dịch
export default function SalesStatsView({
  loading,
  salesLogs,
  statsDate,
  setStatsDate,
  statsShiftName,
  setStatsShiftName,
  statsPaymentMethod,
  setStatsPaymentMethod,
  canRollback,
  handleRollback,
}) {
  return (
    <div className="modern-stack">
      <div style={{ display: 'flex', gap: '12px', background: '#f8fafc', padding: '12px', borderRadius: '12px', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Ngày:</label>
          <input
            type="date"
            value={statsDate}
            onChange={(e) => setStatsDate(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Ca:</label>
          <select
            value={statsShiftName}
            onChange={(e) => setStatsShiftName(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="">Tất cả các ca</option>
            {shiftService.shiftOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>Thanh toán:</label>
          <select
            value={statsPaymentMethod}
            onChange={(e) => setStatsPaymentMethod(e.target.value)}
            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
          >
            <option value="">Tất cả</option>
            <option value="TM">Tiền mặt</option>
            <option value="CK">Chuyển khoản</option>
          </select>
        </div>
      </div>
      <div className="modern-table-wrap">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Sản phẩm</th>
              <th>Số lượng</th>
              <th>Tổng tiền</th>
              <th>Phương thức</th>
              <th>Nhân viên</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && salesLogs.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty-cell">Chưa có dữ liệu bán hàng</td>
              </tr>
            )}
            {salesLogs.map((log) => (
              <tr key={log.id}>
                <td>
                  <p className="cell-main">{formatDateTime(log.sold_at)}</p>
                  {log.shifts?.shift_name && <p className="cell-sub">{log.shifts.shift_name}</p>}
                </td>
                <td><p className="cell-main">{log.products?.name || 'N/A'}</p></td>
                <td>{log.quantity}</td>
                <td><p className="cell-main">{Number(log.total_price || 0).toLocaleString('vi-VN')}đ</p></td>
                <td>
                  <span style={{
                    padding: '4px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
                    background: log.payment_method === 'CK' ? '#dbeafe' : '#f1f5f9',
                    color: log.payment_method === 'CK' ? '#1d4ed8' : '#475569'
                  }}>
                    {log.payment_method === 'CK' ? 'Chuyển khoản' : 'Tiền mặt'}
                  </span>
                </td>
                <td><p className="cell-main">{log.staff_members?.full_name || log.profiles?.full_name || 'N/A'}</p></td>
                <td>
                  {canRollback(log) ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      style={{
                        color: '#dc2626',
                        background: '#fef2f2',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                      onClick={() => handleRollback(log)}
                    >
                      Hoàn tác
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
