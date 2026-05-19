import { useEffect, useMemo, useState } from 'react';
import { Clock, Banknote, FileText, Plus, Receipt } from 'lucide-react';
import { shiftService } from '../../services/shiftService';
import { staffService } from '../../services/staffService';
import { useAuthStore } from '../../store/useAuthStore';
import { paymentService } from '../../services/paymentService';
import { productService } from '../../services/productService';
import { additionalService } from '../../services/additionalService';
import { expenseService } from '../../services/expenseService';
import { staffLogService } from '../../services/staffLogService';
import { shiftNoteService } from '../../services/shiftNoteService';
import { formatDateTime } from '../../utils/formatters';
import { deviceSecurity } from '../../utils/deviceSecurity';

export default function Shifts() {
  const { user, profile, activeStaff, setActiveStaff } = useAuthStore();
  const [staffMembers, setStaffMembers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [skipTimeCheck, setSkipTimeCheck] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('shift');
  const [isTrusted, setIsTrusted] = useState(deviceSecurity.isDeviceTrusted());
  const [deviceSecret, setDeviceSecret] = useState('');
  const [suggestedEndingCash, setSuggestedEndingCash] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [sharedNotes, setSharedNotes] = useState([]);
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
      const [shiftsData] = await Promise.all([
        shiftService.getLatestShifts()
      ]);
      setShifts(shiftsData);
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
    // Tải danh sách nhân viên cho dropdown
    staffService.getStaffMembers().then(setStaffMembers).catch(console.error);
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

      // Lấy doanh thu dịch vụ (TM)
      const totalServiceCash = await additionalService.getServiceRevenueForShift(shift.id, 'TM');

      // Lấy doanh thu nước bằng Tiền mặt (TM) cho ca này
      const totalDrinkCash = await productService.getDrinkRevenueForShift(shift.id, 'TM');

      // Lấy tổng chi
      const shiftExpense = await expenseService.getTotalByShift(shift.id);
      setTotalExpense(shiftExpense);

      // Công thức: Tiền kết ca = Tiền đầu ca + TM hội viên + TM dịch vụ + TM nước - Chi
      return (Number(shift.starting_cash) || 0) + totalMemberCash + totalServiceCash + totalDrinkCash - shiftExpense;
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

      // Đồng bộ nhân viên đang trực nếu local state chưa có (Quan trọng cho Admin xem ca của nhân viên)
      if (!activeStaff && activeShift.staff_members) {
        setActiveStaff(activeShift.staff_members);
      }

      // Đồng bộ tên ca đang mở vào form
      if (form.shift_name !== activeShift.shift_name) {
        setForm(prev => ({ ...prev, shift_name: activeShift.shift_name }));
      }
    } else {
      setSuggestedEndingCash(0);
      setTotalExpense(0);
      setExpenses([]);
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
        staffMemberId: activeStaff?.id,
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

    if (!isTrusted) {
      setError('Thiết bị này chưa được tin cậy. Vui lòng kích hoạt thiết bị để thực hiện.');
      return;
    }

    try {
      if (activeShift) {
        if (form.ending_cash === '') {
          throw new Error('Vui lòng nhập tiền kết ca trước khi chốt ca.');
        }

        await shiftService.closeShift({
          shiftId: activeShift.id,
          endingCash: Number(form.ending_cash),
          note: form.note,
          authId: user?.id,
          staffId: activeStaff?.id,
          shiftName: activeShift.shift_name,
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
          authId: user?.id,
          staffId: activeStaff.id,
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

                  <button type="submit" className="primary-btn large">
                    {activeShift ? 'Chốt Ca Trực' : 'Mở Ca Trực'}
                  </button>
                </form>
              )}

              {activeTab === 'expense' && (
                <div className="modern-stack" style={{ maxWidth: '480px' }}>
                  {/* Summary Card */}
                  <div style={{ background: 'linear-gradient(135deg, #fef2f2, #fee2e2)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid #fecaca', boxShadow: '0 4px 12px rgba(220, 38, 38, 0.05)' }}>
                    <div>
                      <p style={{ margin: 0, color: '#991b1b', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tổng chi ca hiện tại</p>
                      <h3 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: '700', color: '#7f1d1d' }}>
                        {Number(totalExpense || 0).toLocaleString('vi-VN')}<span style={{ fontSize: '18px', marginLeft: '2px' }}>đ</span>
                      </h3>
                    </div>
                    <div style={{ width: '48px', height: '48px', background: '#ffffff', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <Receipt size={24} strokeWidth={2.5} />
                    </div>
                  </div>

                  {/* Add Expense Form */}
                  <form className="modern-form" onSubmit={handleAddExpense} style={{ background: '#ffffff', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Plus size={16} /> Ghi nhận khoản chi mới
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}><Banknote size={16} /></div>
                        <input
                          type="number"
                          value={expenseForm.amount}
                          onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                          placeholder="Số tiền chi (VNĐ)"
                          style={{ paddingLeft: '36px' }}
                          required
                        />
                      </div>
                      <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }}><FileText size={16} /></div>
                        <input
                          type="text"
                          value={expenseForm.reason}
                          onChange={(e) => setExpenseForm({ ...expenseForm, reason: e.target.value })}
                          placeholder="Lý do chi (vd: Hoàn id, Clinh)"
                          style={{ paddingLeft: '36px' }}
                          required
                        />
                      </div>
                      <button type="submit" className="primary-btn" style={{ width: '100%', marginTop: '4px' }} disabled={!activeShift}>
                        Thêm khoản chi
                      </button>
                    </div>
                  </form>

                  {/* Modern List of Expenses */}
                  <div style={{ marginTop: '4px' }}>
                    <h4 style={{ margin: '0 0 12px 4px', fontSize: '14px', fontWeight: '700', color: '#64748b' }}>Lịch sử chi trong ca ({expenses.length})</h4>
                    <div className="modern-list">
                      {expenses.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '24px', background: '#f8fafc', borderRadius: '12px', color: '#94a3b8', fontSize: '14px', border: '1px dashed #cbd5e1' }}>
                          Chưa có khoản chi nào
                        </div>
                      )}
                      {expenses.map((item) => (
                        <div key={item.id} className="modern-list-item" style={{ background: '#ffffff', border: '1px solid #f1f5f9', padding: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                          <div style={{ width: '40px', height: '40px', background: '#fef2f2', color: '#ef4444', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Banknote size={18} />
                          </div>
                          <div className="flex-1">
                            <p style={{ margin: 0, fontWeight: '600', color: '#0f172a', fontSize: '14px' }}>{item.reason || 'Không có lý do'}</p>
                            <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: '12px' }}>{formatDateTime(item.created_at)}</p>
                          </div>
                          <div style={{ fontWeight: '700', color: '#dc2626', fontSize: '15px' }}>
                            -{Number(item.amount || 0).toLocaleString('vi-VN')}đ
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modern-card notes-panel">
          <h3 className="modern-title flex-row" style={{ color: '#92400e' }}>📜 Nhật ký bàn giao</h3>
          <div className="notes-list">
            {shifts.filter(s => s.note).map((s) => (
              <div key={s.id} className="note-item">
                <div className="note-header">
                  <strong>{s.shift_name}</strong>
                  <span>{formatDateTime(s.start_time)}</span>
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
                    <p className="cell-sub">Nhân viên trực ca</p>
                    <p className="cell-main">{selectedShiftSummary.shift?.staff_members?.full_name || selectedShiftSummary.shift?.profiles?.full_name || 'N/A'}</p>
                  </div>
                  <div className="modern-card" style={{ padding: '12px', background: '#f8fafc' }}>
                    <p className="cell-sub">Doanh thu dự kiến (TM)</p>
                    <p className="cell-main">
                      {Number(
                        (selectedShiftSummary.shift?.starting_cash || 0) +
                        selectedShiftSummary.payments.filter(p => p.payment_method === 'TM').reduce((s, p) => s + p.amount, 0) +
                        selectedShiftSummary.serviceSales.filter(s => s.payment_method === 'TM').reduce((s, p) => s + p.total_price, 0) +
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
                  <h4 style={{ marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>Bán Dịch vụ ({selectedShiftSummary.serviceSales?.length || 0})</h4>
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
                      {(!selectedShiftSummary.serviceSales || selectedShiftSummary.serviceSales.length === 0) && (
                        <tr><td colSpan={4} className="table-empty-cell">Không có phát sinh</td></tr>
                      )}
                      {selectedShiftSummary.serviceSales?.map(s => (
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
