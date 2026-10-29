import { computeHandoverCash } from '../../utils/handoverCash';
import { formatDateTime, formatMemberCode } from '../../utils/formatters';

const sumTM = (rows, field) => rows
  .filter((r) => r.payment_method === 'TM')
  .reduce((sum, r) => sum + Number(r[field] || 0), 0);

// Tiền mặt dự kiến cuối ca, cùng công thức với gợi ý khi chốt ca
function expectedCash(summary) {
  return computeHandoverCash({
    startingCash: summary.shift?.starting_cash,
    memberCash: sumTM(summary.payments.filter((p) => p.is_verified !== false), 'amount'),
    serviceCash: sumTM(summary.serviceSales || [], 'total_price'),
    drinkCash: sumTM(summary.sales, 'total_price'),
    expenses: summary.expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
  });
}

export default function ShiftDetailModal({ summary, loading, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" style={{ width: 'min(800px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>Chi tiết: {summary?.shift?.shift_name} ({formatDateTime(summary?.shift?.start_time)})</h3>
          <button className="ghost-btn" onClick={onClose}>Đóng</button>
        </div>

        {loading ? (
          <div className="modern-info">Đang tải dữ liệu ca...</div>
        ) : summary ? (
          <div className="modern-stack" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                <p className="cell-sub">Nhân viên trực ca</p>
                <p className="cell-main">{summary.shift?.staff_members?.full_name || summary.shift?.profiles?.full_name || 'N/A'}</p>
              </div>
              <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                <p className="cell-sub">Doanh thu dự kiến (TM)</p>
                <p className="cell-main">
                  {expectedCash(summary).toLocaleString()}đ
                </p>
              </div>
              <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                <p className="cell-sub">Doanh thu thực tế (TM)</p>
                <p className="cell-main">
                  {summary.shift?.status === 'closed'
                    ? `${Number(summary.shift?.ending_cash || 0).toLocaleString()}đ`
                    : 'Chưa chốt ca'}
                </p>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Hội viên mới & Gia hạn ({summary.payments.length})</h4>
              <table className="modern-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Hội viên</th>
                    <th>Số tiền</th>
                    <th>HTTT</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.payments.length === 0 && (
                    <tr><td colSpan={3} className="table-empty-cell">Không có phát sinh</td></tr>
                  )}
                  {summary.payments.map(p => (
                    <tr key={p.id}>
                      <td>{formatMemberCode(p.members?.member_code)} - {p.members?.full_name}</td>
                      <td>{Number(p.amount).toLocaleString()}đ</td>
                      <td>{p.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Bán Dịch vụ ({summary.serviceSales?.length || 0})</h4>
              <table className="modern-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Dịch vụ</th>
                    <th>SL</th>
                    <th>Tổng</th>
                    <th>HTTT</th>
                  </tr>
                </thead>
                <tbody>
                  {(!summary.serviceSales || summary.serviceSales.length === 0) && (
                    <tr><td colSpan={4} className="table-empty-cell">Không có phát sinh</td></tr>
                  )}
                  {summary.serviceSales?.map(s => (
                    <tr key={s.id}>
                      <td>{s.services?.name}</td>
                      <td>{s.quantity}</td>
                      <td>{Number(s.total_price).toLocaleString()}đ</td>
                      <td>{s.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Bán nước ({summary.sales.length})</h4>
              <table className="modern-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Sản phẩm</th>
                    <th>SL</th>
                    <th>Tổng</th>
                    <th>HTTT</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.sales.length === 0 && (
                    <tr><td colSpan={4} className="table-empty-cell">Không có phát sinh</td></tr>
                  )}
                  {summary.sales.map(s => (
                    <tr key={s.id}>
                      <td>{s.products?.name}</td>
                      <td>{s.quantity}</td>
                      <td>{Number(s.total_price).toLocaleString()}đ</td>
                      <td>{s.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Khoản chi ({summary.expenses.length})</h4>
              <table className="modern-table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Lý do</th>
                    <th>Số tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.expenses.length === 0 && (
                    <tr><td colSpan={2} className="table-empty-cell">Không có khoản chi</td></tr>
                  )}
                  {summary.expenses.map(e => (
                    <tr key={e.id}>
                      <td>{e.reason}</td>
                      <td>{Number(e.amount).toLocaleString()}đ</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {summary.shift?.note && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                <p className="cell-sub">Ghi chú ca:</p>
                <p style={{ margin: 0, fontSize: '14px' }}>{summary.shift.note}</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
