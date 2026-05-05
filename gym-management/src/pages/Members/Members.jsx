import React, { useMemo, useState } from 'react';
import { useMembers } from '../../hooks/useMembers';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { useAuthStore } from '../../store/useAuthStore';
import { memberLogService } from '../../services/memberLogService';

const initialForm = {
  full_name: '',
  package_type: '1',
  start_date: '',
  end_date: '',
  fee: '',
  payment_method: 'TM',
  fingerprint_status: false,
  note: '',
};

function addMonths(startDate, months) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + Number(months || 1));
  return d.toISOString().slice(0, 10);
}

export default function Members() {
  const { user, profile } = useAuthStore();
  const { members, loading, addMember, updateMember } = useMembers();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(initialForm);

  const columns = useMemo(
    () => [
      { key: 'full_name', label: 'Họ tên' },
      { key: 'package_type', label: 'Gói (tháng)' },
      { key: 'start_date', label: 'Ngày bắt đầu' },
      { key: 'end_date', label: 'Ngày kết thúc' },
      { key: 'fee', label: 'Học phí', render: (v) => Number(v || 0).toLocaleString('vi-VN') + 'đ' },
      { key: 'payment_method', label: 'Thanh toán' },
      { key: 'fingerprint_status', label: 'Vân tay', render: (v) => (v ? 'Đã có' : 'Chưa có') },
    ],
    [],
  );

  const openCreateForm = () => {
    setSelectedMember(null);
    const today = new Date().toISOString().slice(0, 10);
    setFormData({ ...initialForm, start_date: today, end_date: addMonths(today, 1) });
    setError('');
    setIsFormOpen(true);
  };

  const openDetail = (member) => {
    setSelectedMember(member);
    setFormData({
      full_name: member.full_name || '',
      package_type: String(member.package_type || 1),
      start_date: member.start_date || '',
      end_date: member.end_date || '',
      fee: String(member.fee || ''),
      payment_method: member.payment_method || 'TM',
      fingerprint_status: Boolean(member.fingerprint_status),
      note: member.note || '',
    });
    setError('');
    setIsFormOpen(true);
  };

  const createPayload = () => ({
    full_name: formData.full_name,
    package_type: Number(formData.package_type || 1),
    start_date: formData.start_date,
    end_date: formData.end_date,
    fee: Number(formData.fee || 0),
    payment_method: formData.payment_method,
    fingerprint_status: Boolean(formData.fingerprint_status),
    note: formData.note,
  });

  const handleSaveMember = async () => {
    setError('');
    try {
      const payload = createPayload();
      if (selectedMember?.id) {
        const beforeData = selectedMember;
        const updated = await updateMember(selectedMember.id, payload);
        await memberLogService.createLog({
          memberId: selectedMember.id,
          action: 'update_member',
          changedBy: user?.id,
          beforeData,
          afterData: updated,
          note: 'Cập nhật hội viên',
        });
      } else {
        const created = await addMember(payload);
        await memberLogService.createLog({
          memberId: created.id,
          action: 'create_member',
          changedBy: user?.id,
          afterData: created,
          note: 'Tạo hội viên mới',
        });
      }
      setIsFormOpen(false);
      setSelectedMember(null);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleRenew = async (row) => {
    try {
      const startDate = new Date().toISOString().slice(0, 10);
      const endDate = addMonths(startDate, row.package_type || 1);
      const updated = await updateMember(row.id, { start_date: startDate, end_date: endDate });
      await memberLogService.createLog({
        memberId: row.id,
        action: 'renew_member',
        changedBy: user?.id,
        beforeData: row,
        afterData: updated,
        note: 'Gia hạn theo gói hiện tại',
      });
    } catch (e) {
      setError(e.message);
    }
  };

  const handleOpenLogs = async () => {
    setError('');
    try {
      const data = await memberLogService.getLogs();
      setLogs(data);
      setIsLogOpen(true);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="members-page">
      <div className="page-header">
        <h1>Quản lý hội viên</h1>
        <div style={{ display: 'flex', gap: 10 }}>
          {profile?.role === 'admin' && (
            <Button variant="secondary" onClick={handleOpenLogs}>
              Xem logs
            </Button>
          )}
          <Button onClick={openCreateForm}>+ Thêm hội viên</Button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <Table
        columns={columns}
        data={members}
        loading={loading}
        actions={(row) => (
          <div className="action-buttons">
            <Button variant="secondary" size="sm" onClick={() => openDetail(row)}>
              Chi tiết
            </Button>
            <Button size="sm" onClick={() => handleRenew(row)}>
              Gia hạn
            </Button>
          </div>
        )}
      />

      <Modal
        isOpen={isFormOpen}
        title={selectedMember ? 'Chi tiết hội viên' : 'Thêm hội viên'}
        onClose={() => setIsFormOpen(false)}
        onConfirm={handleSaveMember}
      >
        <Input label="Họ tên" value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} />
        <Input
          label="Gói tập (tháng)"
          type="number"
          value={formData.package_type}
          onChange={(e) => {
            const packageType = e.target.value;
            setFormData({
              ...formData,
              package_type: packageType,
              end_date: formData.start_date ? addMonths(formData.start_date, packageType) : formData.end_date,
            });
          }}
        />
        <Input
          label="Ngày bắt đầu"
          type="date"
          value={formData.start_date}
          onChange={(e) => {
            const startDate = e.target.value;
            setFormData({
              ...formData,
              start_date: startDate,
              end_date: startDate ? addMonths(startDate, formData.package_type) : formData.end_date,
            });
          }}
        />
        <Input label="Ngày kết thúc" type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
        <Input label="Học phí" type="number" value={formData.fee} onChange={(e) => setFormData({ ...formData, fee: e.target.value })} />
        <div className="form-group">
          <label>Phương thức thanh toán</label>
          <select className="input" value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}>
            <option value="TM">TM - Tiền mặt</option>
            <option value="R">R - Chuyển khoản</option>
          </select>
        </div>
        <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="fingerprint_status"
            type="checkbox"
            checked={formData.fingerprint_status}
            onChange={(e) => setFormData({ ...formData, fingerprint_status: e.target.checked })}
          />
          <label htmlFor="fingerprint_status">Đã đăng ký vân tay</label>
        </div>
        <Input label="Ghi chú" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} />
      </Modal>

      <Modal isOpen={isLogOpen} title="Lịch sử logs hội viên" onClose={() => setIsLogOpen(false)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {logs.length === 0 && <div>Chưa có logs</div>}
          {logs.map((log) => (
            <div key={log.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
              <div><strong>Action:</strong> {log.action}</div>
              <div><strong>Member ID:</strong> {log.member_id}</div>
              <div><strong>By:</strong> {log.changed_by}</div>
              <div><strong>At:</strong> {new Date(log.changed_at).toLocaleString('vi-VN')}</div>
              <div><strong>Note:</strong> {log.note || '-'}</div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
