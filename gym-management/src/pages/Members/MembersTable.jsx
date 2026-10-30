import { useState, useEffect } from 'react';
import { Eye, Trash2, RefreshCcw, PauseCircle, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate } from '../../utils/formatters';
import { getMemberStatus as getStatus } from '../../utils/memberStatus';

export default function MembersTable({
  loading,
  filtered,
  activeTab,
  profile,
  onEditMember,
  onRenewMember,
  onSuspendMember,
  onReactivateMember,
  onDeleteMember
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [filtered.length]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="modern-table-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <table className="modern-table">
        <thead>
          <tr>
            <th>Ngày hành động</th>
            <th>Hội viên</th>
            <th>Ngày hết hạn</th>
            <th>Trạng thái</th>
            {activeTab === 'suspended' && <th>Ngày bảo lưu</th>}
            <th>Ghi chú</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {!loading && paginated.length === 0 && (
            <tr>
              <td colSpan={7} className="table-empty-cell">Không có dữ liệu</td>
            </tr>
          )}
          {paginated.map((m) => {
            const status = getStatus(m);
            const createdDate = new Date(m.created_at);
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const showWarning = !m.member_code && m.created_at && (createdDate <= sevenDaysAgo);

            return (
              <tr key={m.id}>
                <td>
                  <p className="cell-main">{formatDate(m.last_active_at || m.created_at) || 'N/A'}</p>
                </td>
                <td>
                  <p className="cell-main">{m.full_name}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {m.member_code ? (
                      <p className="cell-sub">ID : {m.member_code}</p>
                    ) : (
                      <p className="cell-sub" style={{ color: 'var(--subtle)', fontStyle: 'italic' }}>Chưa có mã</p>
                    )}
                    {showWarning && (
                      <span 
                        className="pay-badge" 
                        style={{ 
                          background: 'var(--danger-soft)', 
                          color: 'var(--danger-ink)', 
                          border: '1px solid var(--danger-line)', 
                          padding: '2px 6px',
                          borderRadius: 'var(--radius)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px'
                        }}
                        title="Tài khoản đăng ký hơn 7 ngày nhưng chưa có mã hội viên"
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }}></span>
                        Chưa gắn mã &gt; 7 ngày
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <p className="cell-main">{formatDate(m.end_date) || 'N/A'}</p>
                  <p className="cell-sub">
                    {m.membership_category ? `(${m.membership_category.toUpperCase()}) ` : ''}
                    {m.package_type ? `${m.package_type} tháng` : 'Chưa có gói'} - {Number(m.fee || 0).toLocaleString()}đ
                  </p>
                </td>
                <td>
                  <span
                    className={`status-badge ${status === 'Active' ? 'active' : status === 'Suspended' ? 'suspended' : 'expired'}`}
                    style={status === 'Suspended' ? { background: 'var(--warn-soft)', color: 'var(--warn-ink)' } : {}}
                  >
                    {status === 'Active' ? 'Đang tập' : status === 'Suspended' ? 'Bảo lưu' : 'Hết hạn'}
                  </span>
                  {m.payment_method === 'CK' && !m.is_payment_verified && (
                    <span className="pay-badge" style={{ background: 'var(--warn-soft)', color: 'var(--warn-ink)', marginLeft: '4px' }}>Chờ duyệt</span>
                  )}
                </td>
                {activeTab === 'suspended' && (
                  <td>
                    <p className="cell-main">{formatDate(m.suspended_at)}</p>
                    <p className="cell-sub">Còn {m.remaining_days} ngày</p>
                  </td>
                )}
                <td style={{ maxWidth: '150px' }}>
                  <div
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '12px',
                      color: 'var(--muted)'
                    }}
                    title={m.note}
                  >
                    {m.note || '-'}
                  </div>
                </td>
                <td>
                  <div className="table-actions" style={{ gap: '8px' }}>
                    <button
                      type="button"
                      className="ghost-btn-sm"
                      onClick={() => onEditMember(m)}
                      title="Xem chi tiết & Sửa"
                      style={{ padding: '6px' }}
                    >
                      <Eye size={18} />
                    </button>
                    {status !== 'Suspended' && (
                      <button
                        type="button"
                        className="ghost-btn-sm"
                        onClick={() => onRenewMember(m)}
                        title="Gia hạn gói tập"
                        style={{ padding: '6px' }}
                      >
                        <RefreshCcw size={18} />
                      </button>
                    )}
                    {status === 'Suspended' ? (
                      <button
                        type="button"
                        className="ghost-btn-sm"
                        onClick={() => onReactivateMember(m)}
                        title="Kích hoạt lại"
                        style={{ padding: '6px' }}
                      >
                        <Plus size={18} />
                      </button>
                    ) : status === 'Active' && (
                      <button
                        type="button"
                        className="ghost-btn-sm"
                        onClick={() => onSuspendMember(m)}
                        title="Bảo lưu gói tập"
                        style={{ padding: '6px' }}
                      >
                        <PauseCircle size={18} />
                      </button>
                    )}
                    {profile?.role === 'admin' && (
                      <button
                        type="button"
                        className="ghost-btn-sm"
                        style={{ color: 'var(--danger)', padding: '6px' }}
                        onClick={() => onDeleteMember(m)}
                        title="Xóa hội viên"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)', marginTop: 'auto' }}>
          <span className="muted-text" style={{ fontSize: '13px' }}>
            Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filtered.length)} / {filtered.length} hội viên
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="ghost-btn" 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ padding: '6px 12px' }}
            >
              <ChevronLeft size={16} /> Trước
            </button>
            <span style={{ padding: '6px 12px', fontSize: '14px', fontWeight: '500' }}>
              Trang {currentPage} / {totalPages}
            </span>
            <button 
              className="ghost-btn" 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              style={{ padding: '6px 12px' }}
            >
              Sau <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
