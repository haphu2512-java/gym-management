import { useMemo, useState } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';
import { staffLogService } from '../../services/staffLogService';
import { useAuthStore } from '../../store/useAuthStore';

function getStatus(endDate) {
  const today = new Date();
  const target = new Date(endDate);
  return target >= new Date(today.toDateString()) ? 'Active' : 'Expired';
}

import { addMonths } from '../../utils/formatters';

const initialForm = {
  full_name: '',
  package_type: '1',
  fee: '',
  payment_method: 'TM',
  fingerprint_status: false,
  note: '',
};

export default function Members() {
  const { user } = useAuthStore();
  const { members, loading, addMember, updateMember } = useMembers();
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewForm, setRenewForm] = useState({ package_type: '1', fee: '' });

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const keyword = searchTerm.toLowerCase();
      return (
        (m.full_name || '').toLowerCase().includes(keyword)
        || String(m.id || '').toLowerCase().includes(keyword)
      );
    });
  }, [members, searchTerm]);

  const openCreateModal = () => {
    setEditingMember(null);
    setForm(initialForm);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setForm({
      full_name: member.full_name || '',
      package_type: String(member.package_type || 1),
      fee: String(member.fee || 0),
      payment_method: member.payment_method || 'TM',
      fingerprint_status: Boolean(member.fingerprint_status),
      note: member.note || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const endDate = addMonths(now, Number(form.package_type || 1)).toISOString().slice(0, 10);
      const payload = {
        full_name: form.full_name,
        package_type: Number(form.package_type || 1),
        start_date: editingMember?.start_date || startDate,
        end_date: editingMember?.end_date || endDate,
        fee: Number(form.fee || 0),
        payment_method: form.payment_method,
        fingerprint_status: Boolean(form.fingerprint_status),
        note: form.note,
      };

      if (editingMember?.id) {
        const updated = await updateMember(editingMember.id, payload);
        await staffLogService.logAction({
          staffId: user?.id,
          action: 'Cập nhật hội viên',
          targetItem: updated.full_name,
          details: { before: editingMember, after: updated },
          note: 'Cập nhật thông tin hội viên',
        });
      } else {
        const created = await addMember(payload);
        await staffLogService.logAction({
          staffId: user?.id,
          action: 'Thêm hội viên',
          targetItem: created.full_name,
          details: { after: created },
          note: 'Thêm hội viên mới',
        });
      }

      setShowModal(false);
      setForm(initialForm);
      setEditingMember(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const openRenewModal = (member) => {
    setRenewingMember(member);
    setRenewForm({ package_type: '1', fee: '' });
    setError('');
    setShowRenewModal(true);
  };

  const handleRenew = async (e) => {
    e.preventDefault();
    if (!renewingMember) return;
    setError('');
    try {
      const updated = await memberService.renewMember(
        renewingMember,
        renewForm.package_type,
        renewForm.fee
      );
      await updateMember(renewingMember.id, {
        start_date: updated.start_date,
        end_date: updated.end_date,
        package_type: updated.package_type,
        fee: updated.fee,
        note: updated.note,
      });

      await staffLogService.logAction({
        staffId: user?.id,
        action: 'Gia hạn hội viên',
        targetItem: renewingMember.full_name,
        details: { before: renewingMember, after: updated },
        note: `Gia hạn thêm ${updated.package_type} tháng`,
      });
      setShowRenewModal(false);
      setRenewingMember(null);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modern-stack">
      <div className="modern-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            value={searchTerm}
            placeholder="Tìm theo tên hoặc ID..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button type="button" className="primary-btn" onClick={openCreateModal}>
          <Plus size={16} /> Thêm hội viên
        </button>
      </div>

      {error && <div className="modern-error">{error}</div>}

      <div className="modern-table-wrap">
        <table className="modern-table">
          <thead>
            <tr>
              <th>Hội viên</th>
              <th>Gói/Hạn</th>
              <th>Phí</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="table-empty-cell">Không có dữ liệu</td>
              </tr>
            )}
            {filtered.map((m) => {
              const status = getStatus(m.end_date);
              return (
                <tr key={m.id}>
                  <td>
                    <p className="cell-main">{m.full_name}</p>
                    <p className="cell-sub">ID: {m.id}</p>
                  </td>
                  <td>
                    <p className="cell-main">{m.package_type} tháng</p>
                    <p className="cell-sub">Hết hạn: {m.end_date}</p>
                  </td>
                  <td>
                    <p className="cell-main">{Number(m.fee || 0).toLocaleString('vi-VN')}đ</p>
                    <span className={`pay-badge ${m.payment_method === 'TM' ? 'cash' : 'transfer'}`}>
                      {m.payment_method}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${status === 'Active' ? 'active' : 'expired'}`}>
                      {status === 'Active' ? 'Đang tập' : 'Hết hạn'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="link-btn" onClick={() => openEditModal(m)}>
                        Chi tiết
                      </button>
                      <button type="button" className="link-btn" onClick={() => openRenewModal(m)}>
                        <CreditCard size={14} /> Gia hạn
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>{editingMember ? 'Chi tiết hội viên' : 'Thêm hội viên mới'}</h3>
            <form className="modern-form" onSubmit={handleSubmit}>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Họ tên hội viên"
                required
              />
              <div className="form-grid-2">
                <input
                  type="number"
                  value={form.package_type}
                  onChange={(e) => setForm({ ...form, package_type: e.target.value })}
                  placeholder="Gói (tháng)"
                  required
                />
                <input
                  type="number"
                  value={form.fee}
                  onChange={(e) => setForm({ ...form, fee: e.target.value })}
                  placeholder="Học phí"
                  required
                />
              </div>
              <select
                value={form.payment_method}
                onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              >
                <option value="TM">TM - Tiền mặt</option>
                <option value="R">R - Chuyển khoản</option>
              </select>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.fingerprint_status}
                  onChange={(e) => setForm({ ...form, fingerprint_status: e.target.checked })}
                />
                Đã đăng ký vân tay
              </label>
              <textarea
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Ghi chú"
              />
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="primary-btn">Lưu</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRenewModal && (
        <div className="modal-backdrop" onClick={() => setShowRenewModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Gia hạn hội viên: {renewingMember?.full_name}</h3>
            <form className="modern-form" onSubmit={handleRenew}>
              <div className="form-grid-2">
                <input
                  type="number"
                  value={renewForm.package_type}
                  onChange={(e) => setRenewForm({ ...renewForm, package_type: e.target.value })}
                  placeholder="Gói (tháng)"
                  required
                />
                <input
                  type="number"
                  value={renewForm.fee}
                  onChange={(e) => setRenewForm({ ...renewForm, fee: e.target.value })}
                  placeholder="Học phí"
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setShowRenewModal(false)}>Hủy</button>
                <button type="submit" className="primary-btn">Xác nhận</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

