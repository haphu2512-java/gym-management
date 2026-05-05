import React, { useEffect, useMemo, useState } from 'react';
import supabase from '../../config/supabase';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useAuthStore } from '../../store/useAuthStore';

export default function Staff() {
  const { profile } = useAuthStore();
  const [staffs, setStaffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [salaryModal, setSalaryModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [salaryInput, setSalaryInput] = useState({
    base_salary: '0',
    work_days: '26',
    overtime_hours: '0',
    overtime_rate: '0',
    bonus: '0',
    deduction: '0',
  });

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadStaffs();
    }
  }, [profile?.role]);

  const loadStaffs = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id, full_name, role, created_at, note')
        .order('created_at', { ascending: false });
      if (queryError) throw queryError;
      setStaffs((data || []).filter((x) => x.role === 'staff'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: 'full_name', label: 'Nhân viên' },
      { key: 'role', label: 'Vai trò' },
      { key: 'created_at', label: 'Ngày tạo', render: (v) => new Date(v).toLocaleDateString('vi-VN') },
      { key: 'note', label: 'Ghi chú' },
    ],
    [],
  );

  if (profile?.role !== 'admin') {
    return <div className="alert alert-warning">Chỉ admin được truy cập trang này.</div>;
  }

  const salaryResult = (() => {
    const baseSalary = Number(salaryInput.base_salary || 0);
    const workDays = Number(salaryInput.work_days || 0);
    const overtimeHours = Number(salaryInput.overtime_hours || 0);
    const overtimeRate = Number(salaryInput.overtime_rate || 0);
    const bonus = Number(salaryInput.bonus || 0);
    const deduction = Number(salaryInput.deduction || 0);

    const daySalary = workDays > 0 ? baseSalary / workDays : 0;
    const overtimeSalary = overtimeHours * overtimeRate;
    const total = baseSalary + overtimeSalary + bonus - deduction;

    return { daySalary, overtimeSalary, total };
  })();

  return (
    <div>
      <div className="page-header">
        <h1>Quản lý nhân viên & tính lương</h1>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <Table
        columns={columns}
        data={staffs}
        loading={loading}
        actions={(row) => (
          <Button
            size="sm"
            onClick={() => {
              setSelectedStaff(row);
              setSalaryModal(true);
            }}
          >
            Tính lương
          </Button>
        )}
      />

      <Modal
        isOpen={salaryModal}
        title={`Tính lương: ${selectedStaff?.full_name || ''}`}
        onClose={() => setSalaryModal(false)}
      >
        <Input label="Lương cơ bản" type="number" value={salaryInput.base_salary} onChange={(e) => setSalaryInput({ ...salaryInput, base_salary: e.target.value })} />
        <Input label="Số ngày công chuẩn" type="number" value={salaryInput.work_days} onChange={(e) => setSalaryInput({ ...salaryInput, work_days: e.target.value })} />
        <Input label="Số giờ OT" type="number" value={salaryInput.overtime_hours} onChange={(e) => setSalaryInput({ ...salaryInput, overtime_hours: e.target.value })} />
        <Input label="Đơn giá OT / giờ" type="number" value={salaryInput.overtime_rate} onChange={(e) => setSalaryInput({ ...salaryInput, overtime_rate: e.target.value })} />
        <Input label="Thưởng" type="number" value={salaryInput.bonus} onChange={(e) => setSalaryInput({ ...salaryInput, bonus: e.target.value })} />
        <Input label="Khấu trừ" type="number" value={salaryInput.deduction} onChange={(e) => setSalaryInput({ ...salaryInput, deduction: e.target.value })} />

        <div className="alert alert-success" style={{ marginTop: 10 }}>
          Lương/ngày: {salaryResult.daySalary.toLocaleString('vi-VN')}đ<br />
          Tiền OT: {salaryResult.overtimeSalary.toLocaleString('vi-VN')}đ<br />
          Tổng lương: {salaryResult.total.toLocaleString('vi-VN')}đ
        </div>
      </Modal>
    </div>
  );
}
