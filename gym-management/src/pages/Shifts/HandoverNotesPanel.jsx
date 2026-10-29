import { Trash2 } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

// Nhật ký bàn giao: ghi chú của các ca gần đây
export default function HandoverNotesPanel({ shifts, isAdmin, onDeleteNote }) {
  return (
    <div className="modern-card notes-panel">
      <h3 className="modern-title flex-row" style={{ color: '#92400e' }}>📜 Nhật ký bàn giao</h3>
      <div className="notes-list">
        {shifts.filter(s => s.note).map((s) => (
          <div key={s.id} className="note-item">
            <div className="note-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>{s.shift_name}</strong>
              <div className="flex-row" style={{ gap: '8px', alignItems: 'center' }}>
                <span>{formatDateTime(s.start_time)}</span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onDeleteNote(s.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#dc2626',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.7,
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = 0.7}
                    title="Xóa ghi chú bàn giao"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="note-staff">
              👤 {s.staff_members?.full_name || 'Hệ thống'} {s.status === 'open' && <span className="status-badge active">Đang trực</span>}
            </div>
            <p className="note-content">{s.note}</p>
          </div>
        ))}
        {shifts.filter(s => s.note).length === 0 && (
          <div className="muted-text" style={{ textAlign: 'center', padding: '20px' }}>Chưa có ghi chú nào</div>
        )}
      </div>
    </div>
  );
}
