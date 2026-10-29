import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { staffService } from '../../services/staffService';
import { useAuthStore } from '../../store/useAuthStore';
import { paymentService } from '../../services/paymentService';
import { productService } from '../../services/productService';
import { additionalService } from '../../services/additionalService';
import { expenseService } from '../../services/expenseService';
import { staffLogService } from '../../services/staffLogService';
import { getLocalISODate } from '../../utils/formatters';
import { deviceSecurity } from '../../utils/deviceSecurity';
import { computeHandoverCash } from '../../utils/handoverCash';
import ExpensePanel from './ExpensePanel';
import HandoverNotesPanel from './HandoverNotesPanel';
import ShiftDetailModal from './ShiftDetailModal';
import ShiftHistory from './ShiftHistory';

export default function Shifts() {
  const { user, profile, activeStaff, setActiveStaff } = useAuthStore();
  const [staffMembers, setStaffMembers] = useState([]);
  const [shifts, setShifts] = useState([]);

  // Tìm bất kỳ ca nào đang mở (không lọc theo tên dropdown)
  const activeShift = useMemo(
    () => shifts.find((s) => s.status === 'open') || null,
    [shifts],
  );
  const [skipTimeCheck, setSkipTimeCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shiftFilterDate, setShiftFilterDate] = useState(getLocalISODate());

  const [weeklySchedules, setWeeklySchedules] = useState([]);
  const [isStaffManuallySelected, setIsStaffManuallySelected] = useState(false);

  const todayDayIndex = useMemo(() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1; // 0 = Mon, 6 = Sun
  }, []);

  const currentWeekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const year = monday.getFullYear();
    const month = String(monday.getMonth() + 1).padStart(2, '0');
    const dateDay = String(monday.getDate()).padStart(2, '0');
    return `${year}-${month}-${dateDay}`;
  }, []);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('shift');
  const [isTrusted, setIsTrusted] = useState(deviceSecurity.isDeviceTrusted());
  const [deviceSecret, setDeviceSecret] = useState('');
  const [suggestedEndingCash, setSuggestedEndingCash] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [totalExpense, setTotalExpense] = useState(0);
  const [latestClosedShift, setLatestClosedShift] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editingExpenseForm, setEditingExpenseForm] = useState({ amount: '', reason: '' });

  const [expenseForm, setExpenseForm] = useState(() => {
    const saved = localStorage.getItem('gym_expense_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Dữ liệu cũ trong localStorage bị hỏng thì bỏ qua
      }
    }
    return { amount: '', reason: '' };
  });

  const [form, setForm] = useState(() => {
    const saved = localStorage.getItem('gym_shift_form');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Dữ liệu cũ trong localStorage bị hỏng thì bỏ qua
      }
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

  const loadShifts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let shiftsData;
      if (shiftFilterDate) {
        shiftsData = await shiftService.getShiftsByDate(shiftFilterDate);
      } else {
        shiftsData = await shiftService.getLatestShifts(20);
      }
      setShifts(shiftsData);
      
      const latestClosed = await shiftService.getLatestClosedShift();
      setLatestClosedShift(latestClosed);

      // Gợi ý ca làm dựa trên thời gian thực hoặc ca chốt gần nhất
      const active = shiftsData.find((s) => s.status === 'open') || null;
      if (!active) {
        const shiftOrder = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5'];
        
        // Lấy tất cả các ca đã chốt trong ngày hôm nay
        const todayStr = getLocalISODate();
        const todayShifts = shiftsData.filter(s => s.start_time && s.start_time.startsWith(todayStr));
        const closedShiftNames = new Set(
          todayShifts
            .filter(s => s.status === 'closed')
            .map(s => s.shift_name)
        );

        // Gợi ý ca theo giờ thực tế
        const hour = new Date().getHours();
        let suggested = 'Ca 5';
        if (hour >= 5 && hour < 8) suggested = 'Ca 1';
        else if (hour >= 8 && hour < 11) suggested = 'Ca 2';
        else if (hour >= 11 && hour < 16) suggested = 'Ca 3';
        else if (hour >= 16 && hour < 19) suggested = 'Ca 4';

        // Nếu ca gợi ý theo giờ đã bị chốt, tìm ca kế tiếp chưa chốt
        if (closedShiftNames.has(suggested)) {
          const startIndex = shiftOrder.indexOf(suggested);
          let foundNext = false;
          for (let i = startIndex + 1; i < shiftOrder.length; i++) {
            if (!closedShiftNames.has(shiftOrder[i])) {
              suggested = shiftOrder[i];
              foundNext = true;
              break;
            }
          }
          if (!foundNext) {
            for (let i = 0; i < startIndex; i++) {
              if (!closedShiftNames.has(shiftOrder[i])) {
                suggested = shiftOrder[i];
                break;
              }
            }
          }
        }

        setForm(prev => ({ ...prev, shift_name: suggested }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [shiftFilterDate]);

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
  }, [loadShifts]);

  useEffect(() => {
    // Tải danh sách nhân viên cho dropdown
    staffService.getStaffMembers().then(setStaffMembers).catch(console.error);
  }, []);

  useEffect(() => {
    // Tải lịch xếp ca tuần cho tuần hiện tại
    staffService.getWeeklySchedules(currentWeekStart)
      .then(setWeeklySchedules)
      .catch(console.error);
  }, [currentWeekStart]);

  // Tự động gợi ý nhân viên trực theo lịch xếp ca tuần
  useEffect(() => {
    if (!activeShift && form.shift_name && weeklySchedules.length > 0 && staffMembers.length > 0 && !isStaffManuallySelected) {
      const match = weeklySchedules.find(
        (s) => s.shift_name === form.shift_name && s.day_of_week === todayDayIndex
      );
      if (match && match.staff_member_id) {
        const scheduledStaff = staffMembers.find((sm) => sm.id === match.staff_member_id);
        if (scheduledStaff) {
          setActiveStaff(scheduledStaff);
        }
      } else {
        setActiveStaff(null);
      }
    }
  }, [form.shift_name, weeklySchedules, staffMembers, activeShift, todayDayIndex, isStaffManuallySelected, setActiveStaff]);



  const previousShift = latestClosedShift;
  const previousEndingCash = previousShift ? Number(previousShift.ending_cash || 0) : 0;

  // Tính toán tiền bàn giao khi có ca đang mở
  const calculateHandoverCash = async (shift) => {
    try {
      if (!shift) return 0;

      // Lấy tất cả TM payments cho ca này (Hội viên)
      const payments = await paymentService.getPaymentsByShift(shift.id, 'TM', true);
      const totalMemberCash = payments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Lấy doanh thu dịch vụ (TM)
      const totalServiceCash = await additionalService.getServiceRevenueForShift(shift.id, 'TM');

      // Lấy doanh thu nước bằng Tiền mặt (TM) cho ca này
      const totalDrinkCash = await productService.getDrinkRevenueForShift(shift.id, 'TM');

      // Lấy tổng chi
      const shiftExpense = await expenseService.getTotalByShift(shift.id);
      setTotalExpense(shiftExpense);

      return computeHandoverCash({
        startingCash: shift.starting_cash,
        memberCash: totalMemberCash,
        serviceCash: totalServiceCash,
        drinkCash: totalDrinkCash,
        expenses: shiftExpense,
      });
    } catch (error) {
      console.error('Error calculating handover cash:', error);
      setError('Không tính được tiền dự kiến cuối ca (lỗi mạng?). Vui lòng tải lại trang trước khi chốt ca: ' + error.message);
      return 0;
    }
  };

  // Cập nhật suggested cash khi activeShift thay đổi
  useEffect(() => {
    if (activeShift) {
      calculateHandoverCash(activeShift).then(setSuggestedEndingCash);
      expenseService.getByShift(activeShift.id).then(setExpenses).catch(() => setExpenses([]));

      // Đồng bộ nhân viên đang trực nếu local state chưa có (Quan trọng cho Admin xem ca của nhân viên)
      if (!activeStaff && activeShift.staff_members) {
        setActiveStaff(activeShift.staff_members);
      }

      // Đồng bộ tên ca đang mở vào form
      setForm(prev => (prev.shift_name === activeShift.shift_name ? prev : { ...prev, shift_name: activeShift.shift_name }));
    } else {
      setSuggestedEndingCash(0);
      setTotalExpense(0);
      setExpenses([]);
      setIsStaffManuallySelected(false);
    }
  }, [activeShift, activeStaff, setActiveStaff]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setError('');
    if (!isTrusted) {
      setError('Thiết bị này chưa được tin cậy. Vui lòng kích hoạt thiết bị để thực hiện.');
      return;
    }
    if (!activeShift?.id) {
      setError('Vui lòng mở ca trước khi ghi nhận chi.');
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
        staffMemberId: activeStaff?.id,
        action: 'Thêm khoản chi',
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

  const handleStartEditExpense = (item) => {
    setEditingExpenseId(item.id);
    setEditingExpenseForm({ amount: String(item.amount || ''), reason: item.reason || '' });
  };

  const handleSaveExpense = async (id) => {
    setError('');
    try {
      await expenseService.updateExpense(id, {
        amount: Number(editingExpenseForm.amount || 0),
        reason: editingExpenseForm.reason,
      });
      setEditingExpenseId(null);
      if (activeShift) {
        const [rows, suggested] = await Promise.all([
          expenseService.getByShift(activeShift.id),
          calculateHandoverCash(activeShift),
        ]);
        setExpenses(rows);
        setSuggestedEndingCash(suggested);
      }
    } catch (err) {
      setError('Lỗi khi sửa khoản chi: ' + err.message);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khoản chi này?')) return;
    setError('');
    try {
      await expenseService.deleteExpense(id);
      if (activeShift) {
        const [rows, suggested] = await Promise.all([
          expenseService.getByShift(activeShift.id),
          calculateHandoverCash(activeShift),
        ]);
        setExpenses(rows);
        setSuggestedEndingCash(suggested);
      }
    } catch (err) {
      setError('Lỗi khi xóa khoản chi: ' + err.message);
    }
  };

  const handleDeleteShiftNote = async (shiftId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ghi chú bàn giao này?')) return;
    try {
      setError('');
      await shiftService.deleteShiftNote(shiftId, user?.id, activeStaff?.id);
      await loadShifts();
    } catch (err) {
      setError('Lỗi khi xóa ghi chú: ' + err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');

    if (!isTrusted) {
      setError('Thiết bị này chưa được tin cậy. Vui lòng kích hoạt thiết bị để thực hiện.');
      return;
    }

    setSubmitting(true);
    try {
      if (activeShift) {
        if (form.ending_cash === '') {
          throw new Error('Vui lòng nhập tiền kết ca trước khi chốt ca.');
        }

        await shiftService.closeShift({
          shiftId: activeShift.id,
          endingCash: Number(form.ending_cash),
          note: form.note,
          staffId: activeStaff?.id,
        });

        // Reset nhân viên đang trực sau khi chốt ca
        setActiveStaff(null);
      } else {
        if (!activeStaff) {
          throw new Error('Vui lòng chọn nhân viên trực trước khi mở ca.');
        }
        if (form.starting_cash === '') {
          throw new Error('Vui lòng nhập tiền đầu ca trước khi mở ca.');
        }

        await shiftService.openShift({
          shiftName: form.shift_name,
          startingCash: Number(form.starting_cash),
          note: form.note,
          staffId: activeStaff.id,
          skipTimeCheck: profile?.role === 'admin' && skipTimeCheck,
        });
      }

      setForm({ ...form, starting_cash: '', ending_cash: '', note: '' });
      await loadShifts();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modern-stack">
      <div className="shifts-grid-layout">
        <div className="modern-card">
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <button type="button" className={activeTab === 'shift' ? 'primary-btn' : 'ghost-btn'} onClick={() => setActiveTab('shift')}>
              CA TRỰC
            </button>
            <button type="button" className={activeTab === 'expense' ? 'primary-btn' : 'ghost-btn'} onClick={() => setActiveTab('expense')}>
              CHI
            </button>
          </div>
          <h3 className="modern-title flex-row"><Clock size={18} /> Bàn giao ca trực</h3>

          {!isTrusted ? (
            <div className="modern-card" style={{ background: '#fff7ed', border: '1px solid #ffedd5', padding: '20px', textAlign: 'center' }}>
              <p style={{ color: '#9a3412', fontWeight: '600', marginBottom: '12px' }}>
                ⚠️ Thiết bị này chưa được kích hoạt để thực hiện các thao tác quan trọng.
              </p>
              <div className="modern-form">
                <input
                  type="password"
                  placeholder="Nhập mã bí mật Admin..."
                  value={deviceSecret}
                  onChange={(e) => setDeviceSecret(e.target.value)}
                  style={{ marginBottom: '12px' }}
                />
                <button
                  className="primary-btn"
                  onClick={() => {
                    if (deviceSecurity.trustThisDevice(deviceSecret)) {
                      setIsTrusted(true);
                      setError('');
                    } else {
                      setError('Mã bí mật không chính xác!');
                    }
                  }}
                >
                  Kích hoạt thiết bị này
                </button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'shift' && (
                <form className="modern-form" onSubmit={handleSubmit}>
                  {/* Dropdown chọn nhân viên trực */}
                  <label className="field-label">Nhân viên trực</label>
                  {activeShift ? (
                    <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '10px', border: '1px solid #bfdbfe', fontWeight: '600', color: '#1d4ed8', marginBottom: '4px' }}>
                      👤 {activeStaff?.full_name || activeShift.staff_members?.full_name || 'Không xác định'}
                    </div>
                  ) : (
                    <select
                      value={activeStaff?.id || ''}
                      onChange={(e) => {
                        const found = staffMembers.find(s => s.id === e.target.value);
                        setActiveStaff(found || null);
                        setIsStaffManuallySelected(true);
                      }}
                      required
                    >
                      <option value="">-- Chọn nhân viên trực --</option>
                      {staffMembers.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name}</option>
                      ))}
                    </select>
                  )}

                  <label className="field-label">Chọn ca làm</label>
                  <select 
                    value={form.shift_name} 
                    onChange={(e) => {
                      setForm(prev => ({ ...prev, shift_name: e.target.value }));
                      setIsStaffManuallySelected(false);
                    }} 
                    disabled={!!activeShift}
                  >
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
                            Dự kiến: {suggestedEndingCash.toLocaleString('vi-VN')}đ (Tiền đầu ca + TM hội viên/dịch vụ + TM nước - chi)
                          </small>
                        )}
                        <br></br>
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

                  <button type="submit" className="primary-btn large" disabled={submitting}>
                    {submitting ? 'Đang xử lý...' : (activeShift ? 'Chốt Ca Trực' : 'Mở Ca Trực')}
                  </button>
                </form>
              )}

              {activeTab === 'expense' && (
                <ExpensePanel
                  activeShift={activeShift}
                  expenses={expenses}
                  totalExpense={totalExpense}
                  expenseForm={expenseForm}
                  setExpenseForm={setExpenseForm}
                  editingExpenseId={editingExpenseId}
                  setEditingExpenseId={setEditingExpenseId}
                  editingExpenseForm={editingExpenseForm}
                  setEditingExpenseForm={setEditingExpenseForm}
                  handleAddExpense={handleAddExpense}
                  handleStartEditExpense={handleStartEditExpense}
                  handleSaveExpense={handleSaveExpense}
                  handleDeleteExpense={handleDeleteExpense}
                />
              )}
            </>
          )}
        </div>

        <HandoverNotesPanel
          shifts={shifts}
          isAdmin={profile?.role === 'admin'}
          onDeleteNote={handleDeleteShiftNote}
        />
      </div>

      {error && <div className="modern-error">{error}</div>}
      {loading && <div className="modern-info">Đang tải ca làm...</div>}

      <ShiftHistory
        shifts={shifts}
        filterDate={shiftFilterDate}
        onFilterDateChange={setShiftFilterDate}
        onOpenDetail={openShiftDetail}
      />

      {showDetailModal && (
        <ShiftDetailModal
          summary={selectedShiftSummary}
          loading={summaryLoading}
          onClose={() => setShowDetailModal(false)}
        />
      )}
    </div>
  );
}
