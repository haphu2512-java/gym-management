import { useEffect, useState } from 'react';
import { staffLogService } from '../../services/staffLogService';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await staffLogService.getLogs();
      setLogs(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Nhật ký hoạt động</h3>
          <p className="muted-text">Theo dõi thao tác của tất cả nhân viên trên hệ thống.</p>
        </div>
        <button type="button" className="ghost-btn" onClick={loadLogs}>
          Làm mới
        </button>
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang tải dữ liệu...</div>}

      <div className="modern-table-wrap">
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
                  <span className="stock-badge ok">{log.profiles?.full_name || 'Không xác định'}</span>
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
      </div>
    </div>
  );
}
