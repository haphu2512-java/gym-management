import React, { useState } from 'react';
import { useMembers } from '../../hooks/useMembers';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function Members() {
  const { members, loading, addMember, updateMember, deleteMember } = useMembers();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });

  const columns = [
    { key: 'name', label: 'Tên học viên' },
    { key: 'phone', label: 'Số điện thoại' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Trạng thái', render: (val) => <span className={`badge badge-${val}`}>{val}</span> },
  ];

  const handleAddMember = async () => {
    try {
      await addMember(formData);
      setFormData({ name: '', phone: '', email: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding member:', error);
    }
  };

  const handleDeleteMember = async (id) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa học viên này?')) {
      await deleteMember(id);
    }
  };

  return (
    <div className="members-page">
      <div className="page-header">
        <h1>Quản lý học viên</h1>
        <Button onClick={() => setIsModalOpen(true)}>+ Thêm học viên</Button>
      </div>

      <Table
        columns={columns}
        data={members}
        loading={loading}
        actions={(row) => (
          <div className="action-buttons">
            <Button variant="secondary" size="sm">Sửa</Button>
            <Button variant="danger" size="sm" onClick={() => handleDeleteMember(row.id)}>Xóa</Button>
          </div>
        )}
      />

      <Modal
        isOpen={isModalOpen}
        title="Thêm học viên mới"
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleAddMember}
      >
        <Input
          label="Tên học viên"
          placeholder="Nhập tên"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          label="Số điện thoại"
          placeholder="Nhập số điện thoại"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <Input
          label="Email"
          type="email"
          placeholder="Nhập email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </Modal>
    </div>
  );
}
