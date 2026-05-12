import { useEffect, useMemo, useState, useCallback } from 'react';
import { staffService } from '../../services/staffService';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { formatDate } from '../../utils/formatters';

const DAYS = ['Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun'];
const SHIFTS = ['Ca 1', 'Ca 2', 'Ca 3', 'Ca 4', 'Ca 5'];

function getMonday(d) {
  d = new Date(d);
  var day = d.getDay(),
      diff = d.getDate() - day + (day === 0 ? -6 : 1); 
  const monday = new Date(d.setDate(diff));
  
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, '0');
  const date = String(monday.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export default function Staff() {
  const { profile } = useAuthStore();
  const { showConfirm, addToast } = useUIStore();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [schedule, setSchedule] = useState({});
  const [salaryConfigs, setSalaryConfigs] = useState([]);
  const [adjustments, setAdjustments] = useState({});
  const [newStaffName, setNewStaffName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch initial data
  const loadData = useCallback(async () => {
    if (profile?.role !== 'admin') return;
    setLoading(true);
    try {
      const [staffData, configData, scheduleData, adjustmentData] = await Promise.all([
        staffService.getStaffs(),
        staffService.getSalaryConfigs(),
        staffService.getWeeklySchedules(weekStart),
        staffService.getAllSalaryAdjustments(weekStart)
      ]);
      
      setStaffs(staffData);
      setSalaryConfigs(configData);
      
      const schedMap = {};
      scheduleData.forEach(s => {
        schedMap[`${s.shift_name}-${DAYS[s.day_of_week]}`] = s.staff_id;
      });
      setSchedule(schedMap);

      const adjMap = {};
      adjustmentData.forEach(a => {
        adjMap[a.staff_id] = {
          commission: a.commission,
          others: a.others, // mapping logic: 'others' in UI is likely 'reason' or a general field
          // Actually checking DB schema: commission, shortage, penalty, reason
          // Let's use 'others' for UI compatibility but mapping to DB correctly
          shortage: a.shortage,
          penalty: a.penalty,
          reason: a.reason
        };
      });
      setAdjustments(adjMap);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile?.role, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const updateSchedule = async (shift, day, staffId) => {
    try {
      const dayIndex = DAYS.indexOf(day);
      if (staffId) {
        await staffService.upsertWeeklySchedule({
          staff_id: staffId,
          week_start: weekStart,
          shift_name: shift,
          day_of_week: dayIndex
        });
      } else {
        // Correctly handle removal by deleting the record from DB
        await staffService.deleteWeeklyScheduleEntry({
          weekStart,
          shiftName: shift,
          dayOfWeek: dayIndex
        });
      }
      setSchedule(prev => ({ ...prev, [`${shift}-${day}`]: staffId }));
    } catch (e) {
      addToast("Lỗi cập nhật lịch: " + e.message, "error");
    }
  };

  const updateRate = async (id, val) => {
    try {
      await staffService.updateSalaryRate(id, Number(val));
      setSalaryConfigs(prev => prev.map(c => c.id === id ? { ...c, rate_per_shift: Number(val) } : c));
    } catch (e) {
      addToast("Lỗi cập nhật đơn giá: " + e.message, "error");
    }
  };

  const updateStaffType = async (staffId, val) => {
    try {
      await staffService.updateStaffProfile(staffId, { staff_type: val });
      setStaffs(prev => prev.map(s => s.id === staffId ? { ...s, staff_type: val } : s));
    } catch (e) {
      addToast("Lỗi cập nhật loại nhân viên: " + e.message, "error");
    }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaffName.trim()) return;
    try {
      await staffService.addStaffMember({ full_name: newStaffName, staff_type: 'CT' });
      setNewStaffName('');
      setShowAddForm(false);
      loadData();
    } catch (e) {
      addToast("Lỗi thêm nhân viên: " + e.message, "error");
    }
  };

  const handleDeleteStaff = async (id, name) => {
    showConfirm({
      title: 'Xóa nhân viên',
      message: `Bạn có chắc muốn xóa nhân viên "${name}"? Các lịch làm việc liên quan cũng sẽ bị ảnh hưởng.`,
      type: 'danger',
      onConfirm: async () => {
        try {
          await staffService.deleteStaffMember(id);
          loadData();
          addToast("Đã xóa nhân viên thành công!");
        } catch (e) {
          addToast("Lỗi xóa nhân viên: " + e.message, "error");
        }
      }
    });
  };

  const updateAdj = async (staffId, field, val) => {
    const numericVal = Number(val) || 0;
    const currentAdj = adjustments[staffId] || {};
    const updatedAdj = { ...currentAdj, [field]: numericVal };
    
    try {
      // Optimistic UI update
      setAdjustments(prev => ({
        ...prev,
        [staffId]: updatedAdj
      }));

      await staffService.upsertSalaryAdjustment({
        staff_id: staffId,
        adjustment_date: weekStart,
        commission: field === 'commission' ? numericVal : (currentAdj.commission || 0),
        shortage: field === 'shortage' ? numericVal : (currentAdj.shortage || 0),
        penalty: field === 'penalty' ? numericVal : (currentAdj.penalty || 0),
        reason: field === 'others' ? String(val) : (currentAdj.reason || ''),
        created_by: profile.id
      });
    } catch (e) {
      console.error("Lỗi cập nhật phụ cấp:", e.message);
      // Revert on error if needed
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    const counts = {}; 
    staffs.forEach(s => counts[s.id] = { 'Ca 1': 0, 'Ca 2': 0, 'Ca 3': 0, 'Ca 4': 0, 'Ca 5': 0 });

    Object.entries(schedule).forEach(([key, staffId]) => {
      if (!staffId) return;
      const [shift] = key.split('-');
      if (counts[staffId] && counts[staffId][shift] !== undefined) {
        counts[staffId][shift]++;
      }
    });

    const results = staffs.map(s => {
      const type = s.staff_type || 'CT';
      let baseSalary = 0;
      
      SHIFTS.forEach(shift => {
        const count = counts[s.id][shift];
        const config = salaryConfigs.find(c => c.shift_name === shift && c.staff_type === type);
        baseSalary += count * (config?.rate_per_shift || 0);
      });

      const adj = adjustments[s.id] || { commission: 0, shortage: 0, penalty: 0, others: 0 };
      const finalSalary = baseSalary + (adj.commission || 0) + (Number(adj.others) || 0) - (adj.shortage || 0) - (adj.penalty || 0);

      return {
        ...s,
        type,
        counts: counts[s.id],
        baseSalary,
        adj,
        finalSalary
      };
    });

    return results;
  }, [staffs, schedule, salaryConfigs, adjustments]);

  if (profile?.role !== 'admin') {
    return <div className="modern-error">Chỉ admin được truy cập mục quản lý nhân viên.</div>;
  }

  const inputStyle = { width: '100%', padding: '6px', border: '1px solid #e2e8f0', borderRadius: '4px', outline: 'none' };

  return (
    <div className="modern-stack max-width-full" style={{ maxWidth: '100%' }}>
      <div className="modern-toolbar">
        <div>
          <h3 className="modern-title">Quản lý Ca làm & Bảng lương</h3>
          <p className="muted-text">Xếp ca tuần từ: <strong>{weekStart}</strong>. Dữ liệu lưu Supabase.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600 }}>Chọn tuần (Thứ 2):</label>
          <input 
            type="date" 
            value={weekStart} 
            onChange={(e) => setWeekStart(getMonday(e.target.value))}
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
          />
          <button className="ghost-btn" onClick={() => {
            showConfirm({
              title: 'Xóa lịch tuần',
              message: 'Bạn có chắc muốn xóa sạch bảng xếp ca tuần này trên hệ thống?',
              type: 'danger',
              onConfirm: async () => {
                try {
                  await staffService.deleteWeeklySchedule(weekStart);
                  setSchedule({});
                  addToast("Đã xóa lịch tuần thành công!");
                } catch(e) {
                  addToast("Lỗi: " + e.message, "error");
                }
              }
            });
          }}>Xóa lịch tuần</button>
          <button className="modern-btn" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? 'Hủy' : '+ Thêm nhân viên'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="modern-card" style={{ padding: '20px', marginBottom: '20px', border: '2px solid #3b82f6', background: '#eff6ff' }}>
          <h4 style={{ marginBottom: '15px' }}>Thêm nhân viên mới</h4>
          <form onSubmit={handleAddStaff} style={{ display: 'flex', gap: '10px' }}>
            <input 
              type="text" 
              placeholder="Nhập họ tên đầy đủ..." 
              value={newStaffName} 
              onChange={e => setNewStaffName(e.target.value)}
              style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
              required
            />
            <button type="submit" className="modern-btn">Xác nhận thêm</button>
          </form>
        </div>
      )}

      {loading && <div className="modern-info">Đang tải dữ liệu nhân viên...</div>}
      
      {/* 1. Schedule Table */}
      <div className="modern-card" style={{ overflowX: 'auto', padding: '16px' }}>
        <h4 style={{ marginBottom: '16px', color: '#0f172a', fontWeight: 600 }}>1. Bảng Xếp Ca Tuần</h4>
        <table className="modern-table" style={{ minWidth: '800px', border: '1px solid #e2e8f0' }}>
          <thead>
            <tr>
              <th style={{ width: '80px', background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>Ca \ Thứ</th>
              {DAYS.map(d => <th key={d} style={{ textAlign: 'center', background: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>{d}</th>)}
            </tr>
          </thead>
          <tbody>
            {SHIFTS.map(shift => (
              <tr key={shift}>
                <td style={{ fontWeight: 'bold', background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>{shift}</td>
                {DAYS.map(day => (
                  <td key={day} style={{ padding: '0', borderRight: '1px solid #e2e8f0' }}>
                    <select 
                      style={{ width: '100%', padding: '8px', border: 'none', background: schedule[`${shift}-${day}`] ? '#eff6ff' : 'transparent', outline: 'none', fontWeight: schedule[`${shift}-${day}`] ? 'bold' : 'normal', color: schedule[`${shift}-${day}`] ? '#1d4ed8' : '#64748b' }}
                      value={schedule[`${shift}-${day}`] || ''}
                      onChange={(e) => updateSchedule(shift, day, e.target.value)}
                    >
                      <option value="">-</option>
                      {staffs.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2. Rates Config Table */}
      <div className="modern-card" style={{ overflowX: 'auto', padding: '16px' }}>
        <h4 style={{ marginBottom: '16px', color: '#0f172a', fontWeight: 600 }}>2. Bảng Chấm Công & Khai Báo Đơn Giá</h4>
        <table className="modern-table" style={{ minWidth: '1100px', fontSize: '13px', border: '1px solid #e2e8f0' }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ background: '#f8fafc', borderRight: '1px solid #e2e8f0' }}>Nhân viên</th>
              <th rowSpan={2} style={{ background: '#f8fafc', width: '110px', borderRight: '1px solid #e2e8f0' }}>Loại</th>
              {SHIFTS.map(s => (
                <th colSpan={2} key={s} style={{ textAlign: 'center', borderRight: '2px solid #cbd5e1', background: '#f8fafc' }}>{s}</th>
              ))}
              <th rowSpan={2} style={{ background: '#f8fafc', textAlign: 'right' }}>Tiền Ca (VND)</th>
            </tr>
            <tr>
              {SHIFTS.map(s => (
                <td colSpan={2} key={s} style={{ padding: 0, borderRight: '2px solid #cbd5e1' }}>
                  <div style={{ display: 'flex' }}>
                    <div style={{ flex: 1, padding: '4px', background: '#f1f5f9', borderRight: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>CT</div>
                      <input 
                        type="number" 
                        style={{ width: '100%', padding: '4px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }} 
                        value={salaryConfigs.find(c => c.shift_name === s && c.staff_type === 'CT')?.rate_per_shift || 0} 
                        onChange={e => {
                          const config = salaryConfigs.find(c => c.shift_name === s && c.staff_type === 'CT');
                          if (config) updateRate(config.id, e.target.value);
                        }} 
                      />
                    </div>
                    <div style={{ flex: 1, padding: '4px', background: '#f1f5f9' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>TV</div>
                      <input 
                        type="number" 
                        style={{ width: '100%', padding: '4px', fontSize: '12px', border: '1px solid #cbd5e1', borderRadius: '4px' }} 
                        value={salaryConfigs.find(c => c.shift_name === s && c.staff_type === 'TV')?.rate_per_shift || 0} 
                        onChange={e => {
                          const config = salaryConfigs.find(c => c.shift_name === s && c.staff_type === 'TV');
                          if (config) updateRate(config.id, e.target.value);
                        }} 
                      />
                    </div>
                  </div>
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {calculations.map(calc => (
              <tr key={calc.id}>
                <td style={{ fontWeight: 'bold', borderRight: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px' }}>
                  <span>{calc.full_name}</span>
                  <button 
                    onClick={() => handleDeleteStaff(calc.id, calc.full_name)}
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '16px', padding: '4px' }}
                    title="Xóa nhân viên"
                  >
                    🗑️
                  </button>
                </td>
                <td style={{ borderRight: '1px solid #e2e8f0' }}>
                  <select value={calc.type} onChange={e => updateStaffType(calc.id, e.target.value)} style={{ padding: '4px', width: '100%', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                    <option value="CT">Chính thức</option>
                    <option value="TV">Thử việc</option>
                  </select>
                </td>
                {SHIFTS.map(s => (
                  <td colSpan={2} key={s} style={{ borderRight: '2px solid #cbd5e1', textAlign: 'center', background: calc.counts[s] > 0 ? '#e0f2fe' : 'transparent', fontWeight: calc.counts[s] > 0 ? 'bold' : 'normal' }}>
                    {calc.counts[s] > 0 ? calc.counts[s] : '-'}
                  </td>
                ))}
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0ea5e9', fontSize: '14px' }}>
                  {calc.baseSalary.toLocaleString('vi-VN')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. Final Salary Table */}
      <div className="modern-card" style={{ overflowX: 'auto', padding: '16px' }}>
        <h4 style={{ marginBottom: '16px', color: '#0f172a', fontWeight: 600 }}>3. Bảng Kết Lương</h4>
        <table className="modern-table" style={{ width: '100%', border: '1px solid #e2e8f0' }}>
          <thead>
            <tr>
              <th style={{ background: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>Nhân viên</th>
              <th style={{ background: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>Hoa hồng</th>
              <th style={{ background: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>Khoản khác</th>
              <th style={{ background: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>Hao hụt</th>
              <th style={{ background: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>Khoản phạt</th>
              <th style={{ background: '#fef3c7', textAlign: 'right' }}>Thực Lãnh</th>
            </tr>
          </thead>
          <tbody>
            {calculations.map(calc => (
              <tr key={calc.id}>
                <td style={{ fontWeight: 'bold', borderRight: '1px solid #e2e8f0' }}>{calc.full_name}</td>
                <td style={{ borderRight: '1px solid #e2e8f0' }}><input type="number" style={inputStyle} value={calc.adj.commission || ''} onChange={e => updateAdj(calc.id, 'commission', e.target.value)} placeholder="0" /></td>
                <td style={{ borderRight: '1px solid #e2e8f0' }}><input type="number" style={inputStyle} value={calc.adj.others || ''} onChange={e => updateAdj(calc.id, 'others', e.target.value)} placeholder="0" /></td>
                <td style={{ borderRight: '1px solid #e2e8f0' }}><input type="number" style={inputStyle} value={calc.adj.shortage || ''} onChange={e => updateAdj(calc.id, 'shortage', e.target.value)} placeholder="0" /></td>
                <td style={{ borderRight: '1px solid #e2e8f0' }}><input type="number" style={inputStyle} value={calc.adj.penalty || ''} onChange={e => updateAdj(calc.id, 'penalty', e.target.value)} placeholder="0" /></td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#16a34a', fontSize: '16px', background: '#f0fdf4' }}>
                  {calc.finalSalary.toLocaleString('vi-VN')}đ
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}
