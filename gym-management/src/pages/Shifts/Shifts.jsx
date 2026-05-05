import React, { useEffect, useState } from 'react';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import { shiftService } from '../../services/shiftService';
import { useAuthStore } from '../../store/useAuthStore';

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString('vi-VN');
}

export default function Shifts() {
  const { profile, assignedShift, setAssignedShift } = useAuthStore();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cashModalType, setCashModalType] = useState('');
  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [formData, setFormData] = useState({
    shift_name: '',
    start_time: '',
    end_time: '',
    note: '',
  });
  const [cashData, setCashData] = useState({ amount: '', note: '' });

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await shiftService.getAllShifts();
      setShifts(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'shift_name', label: 'Tên ca' },
    { key: 'start_time', label: 'Bắt đầu', render: formatDateTime },
    { key: 'end_time', label: 'Kết thúc', render: formatDateTime },
    { key: 'starting_cash', label: 'Tiền đầu ca', render: (v) => Number(v || 0).toLocaleString('vi-VN') + 'đ' },
    { key: 'ending_cash', label: 'Tiền cuối ca', render: (v) => Number(v || 0).toLocaleString('vi-VN') + 'đ' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'note', label: 'Ghi chú' },
  ];

  const handleAddShift = async () => {
    try {
      await shiftService.createShift({
        shift_name: formData.shift_name,
        start_time: formData.start_time,
        end_time: formData.end_time || null,
        note: formData.note,
        status: 'open',
      });
      setFormData({ shift_name: '', start_time: '', end_time: '', note: '' });
      setIsModalOpen(false);
      await loadShifts();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleOpenCloseShift = async () => {
    const shiftId = selectedShiftId || assignedShift?.id;
    if (!shiftId) {
      setError('Vui lòng chọn ca cần thao tác.');
      return;
    }

    try {
      if (cashModalType === 'open') {
        const updated = await shiftService.openShift({
          shiftId,
          startingCash: Number(cashData.amount || 0),
          note: cashData.note,
        });
        setAssignedShift(updated);
      }

      if (cashModalType === 'close') {
        const updated = await shiftService.closeShift({
          shiftId,
          endingCash: Number(cashData.amount || 0),
          note: cashData.note,
        });
        setAssignedShift(updated);
      }

      setCashData({ amount: '', note: '' });
      setCashModalType('');
      setSelectedShiftId('');
      await loadShifts();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="shifts-page">
      <div className="page-header">
        <h1>Quản lý ca làm & bàn giao</h1>
        {profile?.role !== 'staff' && <Button onClick={() => setIsModalOpen(true)}>+ Thêm ca làm</Button>}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-group">
        <label>Chọn ca để mở/kết ca</label>
        <select className="input" value={selectedShiftId} onChange={(e) => setSelectedShiftId(e.target.value)}>
          <option value="">-- Chọn ca --</option>
          {shifts.map((shift) => (
            <option key={shift.id} value={shift.id}>
              {shift.shift_name} ({formatDateTime(shift.start_time)})
            </option>
          ))}
        </select>
      </div>

      <div className="shift-actions" style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <Button onClick={() => setCashModalType('open')}>Mở ca</Button>
        <Button variant="danger" onClick={() => setCashModalType('close')}>Kết ca</Button>
      </div>

      <Table columns={columns} data={shifts} loading={loading} />

      <Modal
        isOpen={isModalOpen && profile?.role !== 'staff'}
        title="Thêm ca làm"
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleAddShift}
      >
        <Input label="Tên ca" value={formData.shift_name} onChange={(e) => setFormData({ ...formData, shift_name: e.target.value })} />
        <Input label="Thời gian bắt đầu" type="datetime-local" value={formData.start_time} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
        <Input label="Thời gian kết thúc" type="datetime-local" value={formData.end_time} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
        <Input label="Ghi chú" value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} />
      </Modal>

      <Modal
        isOpen={Boolean(cashModalType)}
        title={cashModalType === 'open' ? 'Mở ca' : 'Kết ca'}
        onClose={() => setCashModalType('')}
        onConfirm={handleOpenCloseShift}
      >
        <Input
          label={cashModalType === 'open' ? 'Tiền đầu ca' : 'Tiền cuối ca'}
          type="number"
          value={cashData.amount}
          onChange={(e) => setCashData({ ...cashData, amount: e.target.value })}
        />
        <Input label="Ghi chú" value={cashData.note} onChange={(e) => setCashData({ ...cashData, note: e.target.value })} />
      </Modal>
    </div>
  );
}
