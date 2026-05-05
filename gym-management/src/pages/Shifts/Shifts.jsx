import React, { useState, useEffect } from 'react';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function Shifts() {
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    staff: '',
    date: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    loadShifts();
  }, []);

  const loadShifts = async () => {
    setLoading(true);
    try {
      // TODO: Fetch shifts from Supabase
      setShifts([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'staff', label: 'Nhân viên' },
    { key: 'date', label: 'Ngày' },
    { key: 'startTime', label: 'Giờ bắt đầu' },
    { key: 'endTime', label: 'Giờ kết thúc' },
    { key: 'status', label: 'Trạng thái' },
  ];

  const handleAddShift = async () => {
    try {
      // TODO: Add shift to Supabase
      setFormData({ staff: '', date: '', startTime: '', endTime: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding shift:', error);
    }
  };

  return (
    <div className="shifts-page">
      <div className="page-header">
        <h1>Quản lý ca làm & Bàn giao</h1>
        <Button onClick={() => setIsModalOpen(true)}>+ Thêm ca làm</Button>
      </div>

      <Table columns={columns} data={shifts} loading={loading} />

      <Modal
        isOpen={isModalOpen}
        title="Thêm ca làm"
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleAddShift}
      >
        <Input
          label="Nhân viên"
          placeholder="Chọn nhân viên"
          value={formData.staff}
          onChange={(e) => setFormData({ ...formData, staff: e.target.value })}
        />
        <Input
          label="Ngày"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
        />
        <Input
          label="Giờ bắt đầu"
          type="time"
          value={formData.startTime}
          onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
        />
        <Input
          label="Giờ kết thúc"
          type="time"
          value={formData.endTime}
          onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
        />
      </Modal>
    </div>
  );
}
