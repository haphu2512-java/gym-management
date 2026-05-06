import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { shiftService } from '../../services/shiftService';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    shift_name: shiftService.shiftOptions[0],
    starting_cash: '',
    ending_cash: '',
    note: '',
  });

  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await shiftService.getLatestShifts();
      setShifts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  const activeShift = useMemo(
    () => shifts.find((s) => s.shift_name === form.shift_name && s.status === 'open') || null,
    [shifts, form.shift_name],
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (activeShift) {
        await shiftService.closeShift({
          shiftId: activeShift.id,
          endingCash: Number(form.ending_cash || 0),
          note: form.note,
        });
      } else {
        await shiftService.openShift({
          shiftName: form.shift_name,
          startingCash: Number(form.starting_cash || 0),
          note: form.note,
        });
      }

      setForm({ ...form, starting_cash: '', ending_cash: '', note: '' });
      await loadShifts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modern-stack max-width-2">
      <div className="modern-card">
        <h3 className="modern-title flex-row"><Clock size={18} /> Bàn giao ca trực</h3>
        <form className="modern-form" onSubmit={handleSubmit}>
          <label className="field-label">Chọn ca làm</label>
          <select value={form.shift_name} onChange={(e) => setForm({ ...form, shift_name: e.target.value })}>
            {shiftService.shiftOptions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>

          <div className="form-grid-2">
            <div>
              <label className="field-label">Tiền đầu ca (TM)</label>
              <input
                type="number"
                value={form.starting_cash}
                onChange={(e) => setForm({ ...form, starting_cash: e.target.value })}
                placeholder="500000"
              />
            </div>
            <div>
              <label className="field-label">Tiền kết ca (TM)</label>
              <input
                type="number"
                value={form.ending_cash}
                onChange={(e) => setForm({ ...form, ending_cash: e.target.value })}
                placeholder="Chưa kết ca"
              />
            </div>
          </div>

          <label className="field-label">Ghi chú bàn giao</label>
          <textarea
            rows={3}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="Ví dụ: còn nợ khách 50k..."
          />

          <button type="submit" className="primary-btn large">
            {activeShift ? 'Chốt Ca Trực' : 'Mở Ca Trực'}
          </button>
        </form>
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang tải ca làm...</div>}

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
            </tr>
          </thead>
          <tbody>
            {shifts.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty-cell">Chưa có dữ liệu ca làm</td>
              </tr>
            )}
            {shifts.map((shift) => (
              <tr key={shift.id}>
                <td className="cell-main">{shift.shift_name}</td>
                <td>{formatDateTime(shift.start_time)}</td>
                <td>{formatDateTime(shift.end_time)}</td>
                <td>{Number(shift.starting_cash || 0).toLocaleString('vi-VN')}đ</td>
                <td>{Number(shift.ending_cash || 0).toLocaleString('vi-VN')}đ</td>
                <td>
                  <span className={`status-badge ${shift.status === 'open' ? 'active' : 'expired'}`}>
                    {shift.status === 'open' ? 'Đang mở' : 'Đã chốt'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
