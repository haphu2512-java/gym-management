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
  const { user, profile } = useAuthStore();
  const [shifts, setShifts] = useState([]);
  const [skipTimeCheck, setSkipTimeCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('shift');
  const [suggestedEndingCash, setSuggestedEndingCash] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [expenseForm, setExpenseForm] = useState(() => {
    const saved = localStorage.getItem('gym_expense_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return { amount: '', reason: '' };
  });

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('gym_shift_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) { }
    }
    return {
      shift_name: shiftService.shiftOptions[0],
      starting_cash: '',
      ending_cash: '',
      note: '',
    };
  });

  useEffect(() => {
    localStorage.setItem('gym_shift_form', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    localStorage.setItem('gym_expense_form', JSON.stringify(expenseForm));
  }, [expenseForm]);

  const [selectedShiftSummary, setSelectedShiftSummary] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);

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

  const openShiftDetail = async (shift) => {
    setSelectedShiftSummary(null);
    setShowDetailModal(true);
    setSummaryLoading(true);
    try {
      const summary = await shiftService.getShiftSummary(shift.id);
      setSelectedShiftSummary(summary);
    } catch (err) {
      setError("Lỗi tải chi tiết ca: " + err.message);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
  }, []);

  // Tìm bất kỳ ca nào đang mở (không lọc theo tên dropdown)
  const activeShift = useMemo(
    () => shifts.find((s) => s.status === 'open') || null,
    [shifts],
  );

  const previousShift = useMemo(
    () => shifts.find((s) => s.status === 'closed') || null,
    [shifts]
  );
  const previousEndingCash = previousShift ? Number(previousShift.ending_cash || 0) : 0;

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
      // Bug fix: truyền activeShift object, không phải activeShift.id
      const [rows, suggested] = await Promise.all([
        expenseService.getByShift(activeShift.id),
        calculateHandoverCash(activeShift),
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
        if (form.ending_cash === '') {
          throw new Error('Vui lòng nhập tiền kết ca trước khi chốt ca.');
        }

        if (activeShift.opened_by !== user?.id && profile?.role !== 'admin') {
          throw new Error('Chỉ người mở ca hoặc Quản lý mới được phép chốt ca này.');
        }

        await shiftService.closeShift({
          shiftId: activeShift.id,
          endingCash: Number(form.ending_cash),
          note: form.note,
          staffId: user?.id,
          shiftName: activeShift.shift_name,
        });
      } else {
        if (form.starting_cash === '') {
          throw new Error('Vui lòng nhập tiền đầu ca trước khi mở ca.');
        }

        await shiftService.openShift({
          shiftName: form.shift_name,
          startingCash: Number(form.starting_cash),
          note: form.note,
          staffId: user?.id,
          skipTimeCheck: profile?.role === 'admin' && skipTimeCheck,
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
            <select value={form.shift_name} onChange={(e) => setForm({ ...form, shift_name: e.target.value })} disabled={!!activeShift}>
              {shiftService.shiftOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            {!activeShift && (() => {
              const schedule = shiftService.shiftTimeMap?.[form.shift_name];
              return schedule ? (
                <small className="field-hint">
                  ⏰ Khung giờ: <strong>{schedule.label}</strong>
                </small>
              ) : null;
            })()}

            <div style={{ marginBottom: '16px' }}>
              {!activeShift ? (
                <div>
                  <label className="field-label">Tiền đầu ca (TM)</label>
                  <input
                    type="number"
                    value={form.starting_cash}
                    onChange={(e) => setForm({ ...form, starting_cash: e.target.value })}
                    placeholder={previousEndingCash > 0 ? `Gợi ý: ${previousEndingCash.toLocaleString('vi-VN')}` : "Ví dụ: 500000"}
                  />
                  {previousEndingCash > 0 && (
                    <small className="field-hint">
                      Gợi ý lấy từ tiền kết ca của {previousShift?.shift_name || 'ca trước'}: {previousEndingCash.toLocaleString('vi-VN')}đ
                    </small>
                  )}
                </div>
              ) : (
                <div>
                  <label className="field-label">Tiền kết ca (TM)</label>
                  <input
                    type="number"
                    value={form.ending_cash}
                    onChange={(e) => setForm({ ...form, ending_cash: e.target.value })}
                    placeholder={`Gợi ý: ${suggestedEndingCash.toLocaleString('vi-VN')}`}
                  />
                  {suggestedEndingCash > 0 && (
                    <small className="field-hint">
                      Dự kiến: {suggestedEndingCash.toLocaleString('vi-VN')}đ (Tiền đầu ca + TM hội viên + TM nước - chi)
                    </small>
                  )}

                  <label className="field-label">Ghi chú bàn giao</label>
                  <textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ví dụ: còn nợ khách 50k..."
                  />
                </div>
              )}
            </div>

            {!activeShift && profile?.role === 'admin' && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '12px', 
                marginBottom: '20px',
                padding: '12px 20px',
                background: '#eff6ff',
                borderRadius: '12px',
                border: '1px solid #bfdbfe',
                width: 'fit-content',
                margin: '0 auto 20px auto'
              }}>
                <input
                  type="checkbox"
                  id="skipTimeCheck"
                  checked={skipTimeCheck}
                  onChange={(e) => setSkipTimeCheck(e.target.checked)}
                  style={{ width: '22px', height: '22px', cursor: 'pointer', accentColor: '#2563eb' }}
                />
                <label 
                  htmlFor="skipTimeCheck" 
                  style={{ 
                    fontSize: '14px', 
                    fontWeight: '700', 
                    color: '#1e40af', 
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  Bỏ qua giới hạn giờ (Admin override)
                </label>
              </div>
            )}

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
                  <button className="link-btn" onClick={() => openShiftDetail(shift)}>Chi tiết</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showDetailModal && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="modal-panel" style={{ width: 'min(800px, 96vw)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Chi tiết: {selectedShiftSummary?.shift?.shift_name} ({formatDateTime(selectedShiftSummary?.shift?.start_time)})</h3>
              <button className="ghost-btn" onClick={() => setShowDetailModal(false)}>Đóng</button>
            </div>

            {summaryLoading ? (
              <div className="modern-info">Đang tải dữ liệu ca...</div>
            ) : selectedShiftSummary ? (
              <div className="modern-stack" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                  <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                    <p className="cell-sub">Nhân viên mở ca</p>
                    <p className="cell-main">{selectedShiftSummary.shift?.profiles?.full_name || 'N/A'}</p>
                  </div>
                  <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                    <p className="cell-sub">Doanh thu dự kiến (TM)</p>
                    <p className="cell-main">
                      {Number(
                        (selectedShiftSummary.shift?.starting_cash || 0) +
                        selectedShiftSummary.payments.filter(p => p.payment_method === 'TM').reduce((s, p) => s + p.amount, 0) +
                        selectedShiftSummary.sales.filter(s => s.payment_method === 'TM').reduce((s, p) => s + p.total_price, 0) -
                        selectedShiftSummary.expenses.reduce((s, e) => s + e.amount, 0)
                      ).toLocaleString()}đ
                    </p>
                  </div>
                  <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                    <p className="cell-sub">Doanh thu thực tế (TM)</p>
                    <p className="cell-main">
                      {selectedShiftSummary.shift?.status === 'closed'
                        ? `${Number(selectedShiftSummary.shift?.ending_cash || 0).toLocaleString()}đ`
                        : 'Chưa chốt ca'}
                    </p>
                  </div>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Hội viên mới & Gia hạn ({selectedShiftSummary.payments.length})</h4>
                  <table className="modern-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Hội viên</th>
                        <th>Số tiền</th>
                        <th>HTTT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShiftSummary.payments.length === 0 && (
                        <tr><td colSpan={3} className="table-empty-cell">Không có phát sinh</td></tr>
                      )}
                      {selectedShiftSummary.payments.map(p => (
                        <tr key={p.id}>
                          <td>{p.members?.member_code} - {p.members?.full_name}</td>
                          <td>{Number(p.amount).toLocaleString()}đ</td>
                          <td>{p.payment_method}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Bán nước ({selectedShiftSummary.sales.length})</h4>
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
                      {selectedShiftSummary.sales.length === 0 && (
                        <tr><td colSpan={4} className="table-empty-cell">Không có phát sinh</td></tr>
                      )}
                      {selectedShiftSummary.sales.map(s => (
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
                  <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Khoản chi ({selectedShiftSummary.expenses.length})</h4>
                  <table className="modern-table" style={{ fontSize: '13px' }}>
                    <thead>
                      <tr>
                        <th>Lý do</th>
                        <th>Số tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedShiftSummary.expenses.length === 0 && (
                        <tr><td colSpan={2} className="table-empty-cell">Không có khoản chi</td></tr>
                      )}
                      {selectedShiftSummary.expenses.map(e => (
                        <tr key={e.id}>
                          <td>{e.reason}</td>
                          <td>{Number(e.amount).toLocaleString()}đ</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedShiftSummary.shift?.note && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                    <p className="cell-sub">Ghi chú ca:</p>
                    <p style={{ margin: 0, fontSize: '14px' }}>{selectedShiftSummary.shift.note}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
