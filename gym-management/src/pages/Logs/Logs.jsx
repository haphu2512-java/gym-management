import { useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { staffLogService } from '../../services/staffLogService';
import { formatDateTime } from '../../utils/formatters';

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterDate, setFilterDate] = useState('');
  const itemsPerPage = 50;

  const loadLogs = useCallback(async (page, date) => {
    setLoading(true);
    setError('');
    try {
      const { data, totalCount: count } = await staffLogService.getLogs(page, itemsPerPage, date);
      setLogs(data);
      setTotalCount(count);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [itemsPerPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs(currentPage, filterDate);
    }, 0);
    return () => clearTimeout(timer);
  }, [currentPage, filterDate, loadLogs]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Nhật ký hoạt động</h3>
          <p className="muted-text">Theo dõi thao tác của tất cả nhân viên trên hệ thống.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => {
              setFilterDate(e.target.value);
              setCurrentPage(1);
            }}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '130px' }}
            title="Lọc theo ngày"
          />
          <button type="button" className="ghost-btn" onClick={() => loadLogs(currentPage, filterDate)}>
            Làm mới
          </button>
        </div>
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang tải dữ liệu...</div>}

      <div className="modern-table-wrap" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <table className="modern-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Nhân viên</th>
              <th>Hành động</th>
              <th>Đối tượng</th>
              <th>Ghi chú / Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty-cell">Không có dữ liệu</td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(log.created_at)}</td>
                <td>
                  <span className={`stock-badge ${log.staff_members?.full_name ? 'ok' : 'warning'}`}>
                    {log.staff_members?.full_name || log.profiles?.full_name || 'Hệ thống'}
                  </span>
                </td>
                <td>
                  <strong>{log.action}</strong>
                </td>
                <td>{log.target_item}</td>
                <td>
                  <p>{log.note}</p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre style={{ fontSize: '11px', background: '#f1f5f9', padding: '4px', borderRadius: '4px', marginTop: '4px', maxWidth: '300px', overflowX: 'auto' }}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', marginTop: 'auto' }}>
            <span className="muted-text" style={{ fontSize: '13px' }}>
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} / {totalCount} nhật ký
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
    </div>
  );
}
