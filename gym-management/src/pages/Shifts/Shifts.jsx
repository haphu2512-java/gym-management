import { useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { useAuthStore } from '../../store/useAuthStore';
import { paymentService } from '../../services/paymentService';
import { productService } from '../../services/productService';
import { expenseService } from '../../services/expenseService';
import { staffLogService } from '../../services/staffLogService';
import { formatDateTime } from '../../utils/formatters';

export default function Shifts() {
  const { user } = useAuthStore();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('shift');
  const [suggestedEndingCash, setSuggestedEndingCash] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [expenseForm, setExpenseForm] = useState({ amount: '', reason: '' });
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

  // Tính toán tiền bàn giao khi có ca đang mở
  const calculateHandoverCash = async (shift) => {
    try {
      if (!shift) return 0;
      
      // Lấy tất cả TM payments cho ca này (Hội viên)
      const payments = await paymentService.getPaymentsByShift(shift.id, 'TM', true);
      const totalMemberCash = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Lấy doanh thu nước bằng Tiền mặt (TM) cho ca này
      const totalDrinkCash = await productService.getDrinkRevenueForShift(shift.id, 'TM');
      
      // Lấy tổng chi
      const shiftExpense = await expenseService.getTotalByShift(shift.id);
      setTotalExpense(shiftExpense);

      // Công thức: Tiền kết ca = Tiền đầu ca + TM hội viên + TM nước - Chi
      return (Number(shift.starting_cash) || 0) + totalMemberCash + totalDrinkCash - shiftExpense;
    } catch (error) {
      console.error('Error calculating handover cash:', error);
      return 0;
    }
  };

  // Cập nhật suggested cash khi activeShift thay đổi
  useEffect(() => {
    if (activeShift) {
      calculateHandoverCash(activeShift).then(setSuggestedEndingCash);
      expenseService.getByShift(activeShift.id).then(setExpenses).catch(() => setExpenses([]));
    } else {
      setSuggestedEndingCash(0);
      setTotalExpense(0);
      setExpenses([]);
    }
  }, [activeShift]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setError('');
    if (!activeShift?.id) {
      setError('Vui long mo ca truoc khi ghi nhan chi.');
      return;
    }
    try {
      const createdExpense = await expenseService.createExpense({
        shiftId: activeShift.id,
        amount: Number(expenseForm.amount || 0),
        reason: expenseForm.reason,
        staffId: user?.id,
      });

      await staffLogService.logAction({
        staffId: user?.id,
        action: 'Them khoan chi',
        targetItem: activeShift.shift_name,
        details: {
          shiftId: activeShift.id,
          expenseId: createdExpense.id,
          amount: Number(expenseForm.amount || 0),
        },
        note: expenseForm.reason || 'Chi trong ca',
      });

      setExpenseForm({ amount: '', reason: '' });
      const [rows, suggested] = await Promise.all([
        expenseService.getByShift(activeShift.id),
        calculateHandoverCash(activeShift.id),
      ]);
      setExpenses(rows);
      setSuggestedEndingCash(suggested);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (activeShift) {
        await shiftService.closeShift({
          shiftId: activeShift.id,
          endingCash: Number(form.ending_cash || 0),
          note: form.note,
          staffId: user?.id,
          shiftName: activeShift.shift_name,
        });
      } else {
        await shiftService.openShift({
          shiftName: form.shift_name,
          startingCash: Number(form.starting_cash || 0),
          note: form.note,
          staffId: user?.id,
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
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button type="button" className={activeTab === 'shift' ? 'primary-btn' : 'ghost-btn'} onClick={() => setActiveTab('shift')}>
            Ca truc
          </button>
          <button type="button" className={activeTab === 'expense' ? 'primary-btn' : 'ghost-btn'} onClick={() => setActiveTab('expense')}>
            Chi
          </button>
        </div>
        <h3 className="modern-title flex-row"><Clock size={18} /> Bàn giao ca trực</h3>
        {activeTab === 'shift' && (
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
                placeholder={activeShift ? `Gợi ý: ${suggestedEndingCash.toLocaleString('vi-VN')}` : "Chưa kết ca"}
              />
              {activeShift && suggestedEndingCash > 0 && (
                <small className="field-hint">
                  Du kien: {suggestedEndingCash.toLocaleString('vi-VN')}d (TM hoi vien + TM nuoc - chi)
                </small>
              )}
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
        )}

        {activeTab === 'expense' && (
          <div className="modern-stack">
            <form className="modern-form" onSubmit={handleAddExpense}>
              <div className="form-grid-2">
                <input
                  type="number"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  placeholder="So tien chi"
                  required
                />
                <input
                  value={expenseForm.reason}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                  placeholder="Ly do chi"
                />
              </div>
              <button type="submit" className="primary-btn" disabled={!activeShift}>
                Them khoan chi
              </button>
            </form>
            <div className="modern-info">
              Tong chi ca hien tai: {Number(totalExpense || 0).toLocaleString('vi-VN')}d
            </div>
            <div className="modern-table-wrap">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>So tien</th>
                    <th>Ly do</th>
                    <th>Thoi gian</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan={3} className="table-empty-cell">Chua co khoan chi</td></tr>
                  )}
                  {expenses.map((item) => (
                    <tr key={item.id}>
                      <td>{Number(item.amount || 0).toLocaleString('vi-VN')}d</td>
                      <td>{item.reason || '-'}</td>
                      <td>{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
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
