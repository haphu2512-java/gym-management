import { formatDateTime } from '../../utils/formatters';

export default function ShiftHistory({ shifts, filterDate, onFilterDateChange, onOpenDetail }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="modern-title" style={{ margin: 0 }}>Lịch sử ca làm</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '500' }}>Lọc theo ngày:</span>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => onFilterDateChange(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line-strong)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          {filterDate && (
            <button
              type="button"
              className="ghost-btn"
              onClick={() => onFilterDateChange('')}
              style={{ padding: '6px 12px', fontSize: '13px', height: 'auto' }}
            >
              Xem tất cả
            </button>
          )}
        </div>
      </div>

      <div className="modern-table-wrap">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Ca</th>
              <th>Bắt đầu</th>
              <th>Kết thúc</th>
              <th>Tiền đầu ca</th>
              <th>Tiền kết ca</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr>
                <td colSpan={7} className="table-empty-cell">Chưa có dữ liệu ca làm</td>
              </tr>
            )}
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td className="cell-main">{shift.shift_name}</td>
                <td>{formatDateTime(shift.start_time)}</td>
                <td>{formatDateTime(shift.end_time) || '-'}</td>
                <td>{Number(shift.starting_cash || 0).toLocaleString('vi-VN')}đ</td>
                <td>{shift.status === 'closed' ? `${Number(shift.ending_cash || 0).toLocaleString('vi-VN')}đ` : '---'}</td>
                <td>
                  <span className={`status-badge ${shift.status === 'open' ? 'active' : 'expired'}`}>
                    {shift.status === 'open' ? 'Đang mở' : 'Đã chốt'}
                  </span>
                </td>
                <td>
                  <button className="link-btn" onClick={() => onOpenDetail(shift)}>Chi tiết</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
