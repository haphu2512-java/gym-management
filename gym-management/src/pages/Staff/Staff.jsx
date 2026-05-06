import { useEffect, useMemo, useState } from 'react';
import { staffService } from '../../services/staffService';
import { useAuthStore } from '../../store/useAuthStore';

export default function Staff() {
  const { profile } = useAuthStore();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSalaryModal, setShowSalaryModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [salary, setSalary] = useState({
    base_salary: '0',
    work_days: '26',
    overtime_hours: '0',
    overtime_rate: '0',
    bonus: '0',
    deduction: '0',
  });

  useEffect(() => {
    if (profile?.role !== 'admin') return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await staffService.getStaffs();
        setStaffs(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.role]);

  const result = useMemo(() => {
    const baseSalary = Number(salary.base_salary || 0);
    const workDays = Number(salary.work_days || 0);
    const overtimeHours = Number(salary.overtime_hours || 0);
    const overtimeRate = Number(salary.overtime_rate || 0);
    const bonus = Number(salary.bonus || 0);
    const deduction = Number(salary.deduction || 0);

    const daySalary = workDays > 0 ? baseSalary / workDays : 0;
    const overtimeSalary = overtimeHours * overtimeRate;
    const total = baseSalary + overtimeSalary + bonus - deduction;
    return { daySalary, overtimeSalary, total };
  }, [salary]);

  if (profile?.role !== 'admin') {
    return <div className="modern-error">Chỉ admin được truy cập mục quản lý nhân viên.</div>;
  }

  return (
    <div className="modern-stack">
      <div className="modern-card">
        <h3 className="modern-title">Quản lý nhân viên & tính lương</h3>
        {error && <div className="modern-error">{error}</div>}
        {loading && <div className="modern-info">Đang tải nhân viên...</div>}

        <div className="modern-table-wrap">
          <table className="modern-table">
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Vai trò</th>
                <th>Ngày tạo</th>
                <th>Ghi chú</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {staffs.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty-cell">Không có dữ liệu nhân viên</td>
                </tr>
              )}
              {staffs.map((item) => (
                <tr key={item.id}>
                  <td className="cell-main">{item.full_name}</td>
                  <td>{item.role}</td>
                  <td>{new Date(item.created_at).toLocaleDateString('vi-VN')}</td>
                  <td>{item.note || '-'}</td>
                  <td>
                    <button
                      type="button"
                      className="link-btn"
                      onClick={() => {
                        setSelectedStaff(item);
                        setShowSalaryModal(true);
                      }}
                    >
                      Tính lương
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showSalaryModal && (
        <div className="modal-backdrop" onClick={() => setShowSalaryModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Tính lương: {selectedStaff?.full_name || ''}</h3>
            <div className="modern-form">
              <input type="number" placeholder="Lương cơ bản" value={salary.base_salary} onChange={(e) => setSalary({ ...salary, base_salary: e.target.value })} />
              <input type="number" placeholder="Số ngày công chuẩn" value={salary.work_days} onChange={(e) => setSalary({ ...salary, work_days: e.target.value })} />
              <input type="number" placeholder="Số giờ OT" value={salary.overtime_hours} onChange={(e) => setSalary({ ...salary, overtime_hours: e.target.value })} />
              <input type="number" placeholder="Đơn giá OT" value={salary.overtime_rate} onChange={(e) => setSalary({ ...salary, overtime_rate: e.target.value })} />
              <input type="number" placeholder="Thưởng" value={salary.bonus} onChange={(e) => setSalary({ ...salary, bonus: e.target.value })} />
              <input type="number" placeholder="Khấu trừ" value={salary.deduction} onChange={(e) => setSalary({ ...salary, deduction: e.target.value })} />

              <div className="modern-success">
                Lương/ngày: {result.daySalary.toLocaleString('vi-VN')}đ<br />
                Tiền OT: {result.overtimeSalary.toLocaleString('vi-VN')}đ<br />
                Tổng lương: {result.total.toLocaleString('vi-VN')}đ
              </div>

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowSalaryModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

