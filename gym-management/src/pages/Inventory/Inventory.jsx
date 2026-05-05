import React, { useState, useEffect } from 'react';
import Table from '../../components/ui/Table';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', quantity: '', price: '' });

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      // TODO: Fetch inventory from Supabase
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { key: 'name', label: 'Sản phẩm' },
    { key: 'quantity', label: 'Số lượng' },
    { key: 'price', label: 'Giá', render: (val) => `${val?.toLocaleString('vi-VN')}₫` },
    { key: 'lastUpdated', label: 'Cập nhật lần cuối' },
  ];

  const handleAddProduct = async () => {
    try {
      // TODO: Add product to Supabase
      setFormData({ name: '', quantity: '', price: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error adding product:', error);
    }
  };

  return (
    <div className="inventory-page">
      <div className="page-header">
        <h1>Kho nước & Bán hàng</h1>
        <Button onClick={() => setIsModalOpen(true)}>+ Thêm sản phẩm</Button>
      </div>

      <Table columns={columns} data={products} loading={loading} />

      <Modal
        isOpen={isModalOpen}
        title="Thêm sản phẩm"
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleAddProduct}
      >
        <Input
          label="Tên sản phẩm"
          placeholder="Nhập tên sản phẩm"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          label="Số lượng"
          type="number"
          placeholder="Nhập số lượng"
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
        />
        <Input
          label="Giá"
          type="number"
          placeholder="Nhập giá"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
        />
      </Modal>
    </div>
  );
}
