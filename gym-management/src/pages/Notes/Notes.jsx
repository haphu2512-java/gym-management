import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { shiftNoteService } from '../../services/shiftNoteService';
import { staffLogService } from '../../services/staffLogService';
import { useAuthStore } from '../../store/useAuthStore';
import { formatDateTime } from '../../utils/formatters';

export default function Notes() {
  const { user, activeStaff } = useAuthStore();
  const [sharedNotes, setSharedNotes] = useState([]);
  const [editingNote, setEditingNote] = useState(null);
  const [noteForm, setNoteForm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const notes = await shiftNoteService.getAllNotes();
      setSharedNotes(notes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSharedNote = async (e) => {
    e.preventDefault();
    if (!noteForm.trim()) return;
    if (!activeStaff) {
      setError('Vui lòng chọn nhân viên trực (mở ca) trước khi viết ghi chú.');
      return;
    }
    
    try {
      setError('');
      if (editingNote) {
        await shiftNoteService.updateNote(editingNote.id, noteForm);
        await staffLogService.logAction({
          staffId: user?.id,
          staffMemberId: activeStaff?.id,
          action: 'Sửa ghi chú chung',
          targetItem: 'Sổ nhật ký',
          note: `Nội dung mới: ${noteForm.substring(0, 50)}${noteForm.length > 50 ? '...' : ''}`
        });
        setEditingNote(null);
      } else {
        await shiftNoteService.addNote(noteForm, activeStaff.id);
        await staffLogService.logAction({
          staffId: user?.id,
          staffMemberId: activeStaff?.id,
          action: 'Thêm ghi chú chung',
          targetItem: 'Sổ nhật ký',
          note: noteForm.substring(0, 100)
        });
      }
      setNoteForm('');
      await loadNotes();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSharedNote = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa ghi chú này?')) return;
    try {
      setError('');
      await shiftNoteService.deleteNote(id);
      await staffLogService.logAction({
        staffId: user?.id,
        staffMemberId: activeStaff?.id,
        action: 'Xóa ghi chú chung',
        targetItem: 'Sổ nhật ký'
      });
      await loadNotes();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modern-stack max-width-2">
      <div className="modern-card">
        <h3 className="modern-title flex-row"><BookOpen size={18} /> Ghi chú chung (Sổ nhật ký)</h3>
        {error && <div className="modern-error" style={{ marginBottom: '16px' }}>{error}</div>}
        
        <form className="modern-form" onSubmit={handleAddSharedNote}>
          <label className="field-label">{editingNote ? 'Sửa ghi chú' : 'Thêm ghi chú mới'}</label>
          <textarea
            rows={4}
            value={noteForm}
            onChange={(e) => setNoteForm(e.target.value)}
            placeholder="Nhập nội dung ghi chú cho các ca sau (Cần đang trong ca trực)..."
            required
          />
          <div className="flex-row" style={{ gap: '8px', marginTop: '8px' }}>
            <button type="submit" className="primary-btn">
              {editingNote ? 'Cập nhật' : 'Gửi ghi chú'}
            </button>
            {editingNote && (
              <button type="button" className="ghost-btn" onClick={() => {
                setEditingNote(null);
                setNoteForm('');
              }}>Hủy</button>
            )}
          </div>
        </form>

        <div className="modern-stack" style={{ marginTop: '24px', gap: '12px' }}>
          {loading && <p className="muted-text">Đang tải dữ liệu...</p>}
          {!loading && sharedNotes.length === 0 && <p className="muted-text">Chưa có ghi chú nào.</p>}
          {sharedNotes.map(note => (
            <div key={note.id} className="modern-card" style={{ padding: '16px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="flex-row" style={{ justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e40af' }}>
                  👤 {note.staff_members?.full_name || 'Hệ thống'}
                </span>
                <span className="muted-text" style={{ fontSize: '12px' }}>
                  {formatDateTime(note.created_at)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>{note.content}</p>
              <div className="flex-row" style={{ gap: '12px', marginTop: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: '12px', color: '#2563eb' }}
                  onClick={() => {
                    setEditingNote(note);
                    setNoteForm(note.content);
                  }}
                >Sửa</button>
                <button
                  type="button"
                  className="link-btn"
                  style={{ fontSize: '12px', color: '#dc2626' }}
                  onClick={() => handleDeleteSharedNote(note.id)}
                >Xóa</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
