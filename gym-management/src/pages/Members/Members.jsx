import { useMemo, useState, useEffect } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';
import { staffLogService } from '../../services/staffLogService';
import { paymentService } from '../../services/paymentService';
import { shiftService } from '../../services/shiftService';
import { useAuthStore } from '../../store/useAuthStore';

function getStatus(endDate) {
  const today = new Date();
  const target = new Date(endDate);
  return target >= new Date(today.toDateString()) ? 'Active' : 'Expired';
}

import { addMonths } from '../../utils/formatters';

const initialForm = {
  member_code: '',
  full_name: '',
  package_type: '1',
  fee: '',
  payment_method: 'TM',
  fingerprint_status: false,
  note: '',
};

export default function Members() {
  const { user, profile } = useAuthStore();
  const { members, loading, addMember, updateMember } = useMembers();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewForm, setRenewForm] = useState({ package_type: '1', fee: '', payment_method: 'TM' });

  const [activeShift, setActiveShift] = useState(null);

  useEffect(() => {
    const fetchShift = async () => {
      const { shift } = await shiftService.validateShiftForLogin();
      setActiveShift(shift);
    };
    fetchShift();
  }, []);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const keyword = searchTerm.toLowerCase();
      const matchSearch = (m.full_name || '').toLowerCase().includes(keyword)
        || (m.member_code || '').toLowerCase().includes(keyword);
        
      if (filterStatus === 'pending_ck') {
        return matchSearch && m.payment_method === 'CK' && !m.is_payment_verified;
      }
      return matchSearch;
    });
  }, [members, searchTerm, filterStatus]);

  const handleTogglePaymentVerification = async (member) => {
    try {
      const newStatus = !member.is_payment_verified;
      const updated = await updateMember(member.id, { is_payment_verified: newStatus });
      
      // Also update payment_logs if exists or create if missing (simplified: just update member)
      // Ideally we would search for the CK payment_log and verify it
      
      await staffLogService.logAction({
        staffId: user?.id,
        action: newStatus ? 'Duyệt thanh toán' : 'Hủy duyệt thanh toán',
        targetItem: updated.full_name,
        details: { memberId: member.id, status: newStatus },
        note: newStatus ? 'Admin duyệt thanh toán chuyển khoản' : 'Admin hủy duyệt thanh toán chuyển khoản',
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const openCreateModal = () => {
    setEditingMember(null);
    setForm(initialForm);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setForm({
      member_code: member.member_code || '',
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

    if (!activeShift?.id) {
       setError("Vui lòng mở ca trước khi thêm hội viên mới.");
       return;
    }

    try {
      const now = new Date();
      const startDate = now.toISOString().slice(0, 10);
      const endDate = addMonths(now, Number(form.package_type || 1)).toISOString().slice(0, 10);
      const payload = {
        member_code: form.member_code,
        full_name: form.full_name,
        package_type: Number(form.package_type || 1),
        start_date: editingMember?.start_date || startDate,
        end_date: editingMember?.end_date || endDate,
        fee: Number(form.fee || 0),
        payment_method: form.payment_method,
        is_payment_verified: form.payment_method === 'TM' ? true : (editingMember ? editingMember.is_payment_verified : false),
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
        
        // Create payment log
        await paymentService.createPaymentLog({
          memberId: created.id,
          shiftId: activeShift.id,
          amount: payload.fee,
          method: payload.payment_method,
          type: 'new',
          staffId: user?.id,
          note: `Thêm mới HV: ${created.full_name}`
        });

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
    setRenewForm({ package_type: '1', fee: '', payment_method: 'TM' });
    setError('');
    setShowRenewModal(true);
  };

  const handleRenew = async (e) => {
    e.preventDefault();
    if (!renewingMember) return;
    setError('');

    if (!activeShift?.id) {
       setError("Vui lòng mở ca trước khi gia hạn hội viên.");
       return;
    }

    try {
      const updated = await memberService.renewMember(
        renewingMember,
        renewForm.package_type,
        renewForm.fee
      );

      // Add payment method to update
      await updateMember(renewingMember.id, {
        start_date: updated.start_date,
        end_date: updated.end_date,
        package_type: updated.package_type,
        fee: updated.fee,
        payment_method: renewForm.payment_method,
        is_payment_verified: renewForm.payment_method === 'TM',
        note: updated.note,
      });

      // Create payment log
      await paymentService.createPaymentLog({
        memberId: renewingMember.id,
        shiftId: activeShift.id,
        amount: renewForm.fee,
        method: renewForm.payment_method,
        type: 'renew',
        staffId: user?.id,
        note: `Gia hạn HV: ${renewingMember.full_name}`
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
            placeholder="Tìm theo tên hoặc Mã HV..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        {profile?.role === 'admin' && (
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}
          >
            <option value="all">Tất cả</option>
            <option value="pending_ck">Chờ duyệt CK</option>
          </select>
        )}
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
                    <p className="cell-sub">Mã: {m.member_code}</p>
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
                    {m.payment_method === 'CK' && !m.is_payment_verified && (
                      <span className="pay-badge" style={{ background: '#fef08a', color: '#854d0e', marginLeft: '4px' }}>Chờ duyệt</span>
                    )}
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
                      {profile?.role === 'admin' && m.payment_method === 'CK' && (
                        <label 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            cursor: 'pointer', 
                            color: m.is_payment_verified ? '#16a34a' : '#ef4444', 
                            background: m.is_payment_verified ? '#f0fdf4' : '#fef2f2',
                            padding: '4px 8px',
                            borderRadius: '8px',
                            border: '1px solid currentColor',
                            fontSize: '13px',
                            fontWeight: '700',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <input 
                            type="checkbox" 
                            checked={m.is_payment_verified} 
                            onChange={() => handleTogglePaymentVerification(m)}
                            style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                          />
                          {m.is_payment_verified ? 'Đã duyệt' : 'Duyệt CK'}
                        </label>
                      )}
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
              <div className="form-grid-2">
                <input
                  value={form.member_code}
                  onChange={(e) => setForm({ ...form, member_code: e.target.value })}
                  placeholder="Mã hội viên"
                  required
                />
                <input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Họ tên hội viên"
                  required
                />
              </div>
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
                <option value="CK">CK - Chuyển khoản</option>
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
              <select
                value={renewForm.payment_method}
                onChange={(e) => setRenewForm({ ...renewForm, payment_method: e.target.value })}
              >
                <option value="TM">TM - Tiền mặt</option>
                <option value="CK">CK - Chuyển khoản</option>
              </select>
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

