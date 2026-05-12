import { useMemo, useState, useEffect } from 'react';
import { CreditCard, Plus, Search, Eye, Trash2, RefreshCcw, PauseCircle } from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { memberLogService } from '../../services/memberLogService';
import supabase from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { formatDate, getLocalISODate, addMonths } from '../../utils/formatters';

function getStatus(member) {
  if (member.suspended_at) return 'Suspended';
  const today = new Date();
  const target = new Date(member.end_date);
  return target >= new Date(today.toDateString()) ? 'Active' : 'Expired';
}



const PRICING_TIERS = {
  normal: { 1: 350000, 3: 795000, 6: 1440000 },
  couple: { 1: 320000, 3: 720000, 6: 1320000 },
  team: { 1: 300000, 3: 660000, 6: 1200000 }
};

function calculateFee(category, packageType) {
  return PRICING_TIERS[category]?.[packageType] || '';
}

const initialForm = {
  member_code: '',
  full_name: '',
  membership_category: 'normal',
  package_type: '1',
  fee: '350000',
  payment_method: 'TM',
  fingerprint_status: false,
  note: '',
  start_date: new Date().toISOString().slice(0, 10),
};

export default function Members() {
  const { user, profile, activeStaff } = useAuthStore();
  const { members, loading, addMember, updateMember, fetchMembers, suspendMember, reactivateMember } = useMembers();
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'suspended'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [form, setForm] = useState(initialForm);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewForm, setRenewForm] = useState({ membership_category: 'normal', package_type: '1', fee: '350000', payment_method: 'TM' });

  const [activeShift, setActiveShift] = useState(null);

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [deletingMember, setDeletingMember] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendingMember, setSuspendingMember] = useState(null);
  const [suspendInfo, setSuspendInfo] = useState({ remainingDays: 0, endDate: '' });

  useEffect(() => {
    const fetchShift = async () => {
      const { shift } = await shiftService.validateShiftForLogin();
      setActiveShift(shift);
    };
    fetchShift();
  }, []);

  const openHistoryModal = async (member) => {
    setRenewingMember(member);
    setShowHistoryModal(true);
    setHistoryLoading(true);
    try {
      const logs = await memberLogService.getLogsByMember(member.id);
      setHistoryLogs(logs);
    } catch (err) {
      setError("Không thể tải lịch sử: " + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const keyword = searchTerm.toLowerCase();
      const matchSearch = (m.full_name || '').toLowerCase().includes(keyword)
        || (m.member_code || '').toLowerCase().includes(keyword);

      let matchDate = true;
      if (filterDate) {
        const expDate = m.end_date ? m.end_date.split('T')[0] : '';
        const regDate = m.start_date ? m.start_date.split('T')[0] : '';
        matchDate = (expDate === filterDate) || (regDate === filterDate);
      }

      let matchStatus = true;
      const status = getStatus(m);
      if (activeTab === 'suspended') {
        matchStatus = status === 'Suspended';
      } else {
        matchStatus = status !== 'Suspended';
      }

      if (filterStatus === 'pending_ck' && matchStatus) {
        matchStatus = m.payment_method === 'CK' && !m.is_payment_verified;
      }

      return matchSearch && matchDate && matchStatus;
    });
  }, [members, searchTerm, filterStatus, filterDate, activeTab]);

  const handleLogVerification = async (log) => {
    if (!window.confirm(`Xác nhận đã nhận đủ ${Number(log.fee || 0).toLocaleString()}đ chuyển khoản cho lần gia hạn này?`)) return;

    try {
      const effectiveStaffId = activeStaff?.id || user?.id;
      await memberService.verifyLogPayment(log.id, effectiveStaffId);

      setHistoryLogs(prevLogs =>
        prevLogs.map(l => l.id === log.id ? { ...l, is_payment_verified: true } : l)
      );

      await fetchMembers();

      if (editingMember && editingMember.id === log.member_id) {
        const { data: freshMember } = await supabase
          .from('member_current_status')
          .select('*')
          .eq('id', log.member_id)
          .single();
        if (freshMember) setEditingMember(freshMember);
      }

      await staffLogService.logAction({
        staffId: effectiveStaffId,
        action: 'Duyệt thanh toán CK',
        targetItem: `Gia hạn ID: ${log.id}`,
        details: { log_id: log.id, member_id: log.member_id },
        note: 'Admin duyệt thanh toán từ bảng lịch sử chi tiết',
      });
    } catch (err) {
      setError("Lỗi duyệt thanh toán: " + err.message);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    try {
    const effectiveStaffId = activeStaff?.id || user?.id;
      await memberService.deleteMember(deletingMember.id);

        await staffLogService.logAction({
          staffId: effectiveStaffId,
          staffMemberId: activeStaff?.id,
          action: 'Xoa hoi vien',
          targetItem: deletingMember.full_name,
          details: { member_id: deletingMember.id, member_code: deletingMember.member_code },
          note: 'Admin thuc hien xoa hoi vien (soft delete)',
        });

      await fetchMembers();
      setDeletingMember(null);
    } catch (err) {
      setError("Lỗi xóa hội viên: " + err.message);
    }
  };

  const openCreateModal = () => {
    setEditingMember(null);
    setForm(initialForm);
    setError('');
    setShowModal(true);
  };

  const openEditModal = async (member) => {
    setEditingMember(member);
    setForm({
      member_code: member.member_code || '',
      full_name: member.full_name || '',
      membership_category: member.membership_category || 'normal',
      package_type: String(member.package_type || 1),
      fee: String(member.fee || 0),
      payment_method: member.payment_method || 'TM',
      fingerprint_status: member.fingerprint_status === true || member.fingerprint_status === 'true',
      note: member.note || '',
    });
    setError('');
    setShowModal(true);

    // Tự động tải lịch sử khi xem chi tiết
    setHistoryLoading(true);
    try {
      const logs = await memberLogService.getLogsByMember(member.id);
      setHistoryLogs(logs.filter(log => log.action === 'CREATE' || log.action === 'RENEW'));
    } catch (err) {
      console.error("Lỗi tải lịch sử:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleFormChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'package_type' || field === 'membership_category') {
        const fee = calculateFee(next.membership_category, next.package_type);
        if (fee !== '') next.fee = String(fee);
      }
      return next;
    });
  };

  const handleRenewFormChange = (field, value) => {
    setRenewForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'package_type' || field === 'membership_category') {
        const fee = calculateFee(next.membership_category, next.package_type);
        if (fee !== '') next.fee = String(fee);
      }
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!activeShift?.id) {
      setError("Vui lòng mở ca trước khi thêm hội viên mới.");
      return;
    }

    try {
      const startDate = form.start_date || getLocalISODate();
      const startObj = new Date(startDate);
      const endDate = getLocalISODate(addMonths(startObj, Number(form.package_type || 1)));

      const payload = {
        member_code: form.member_code,
        full_name: form.full_name,
        membership_category: form.membership_category || 'normal',
        package_type: Number(form.package_type || 1),
        start_date: editingMember?.start_date || startDate,
        end_date: editingMember?.end_date || endDate,
        fee: Number(form.fee || 0),
        payment_method: form.payment_method,
        is_payment_verified: form.payment_method === 'TM' ? true : (editingMember ? editingMember.is_payment_verified : false),
        fingerprint_status: Boolean(form.fingerprint_status),
        note: form.note,
        shift_id: activeShift.id,
        staff_id: activeStaff?.id || user?.id,
      };

      if (editingMember?.id) {
        const updatePayload = {
          member_code: form.member_code,
          full_name: form.full_name,
          fingerprint_status: form.fingerprint_status,
          note: form.note,
        };
        const updated = await updateMember(editingMember.id, updatePayload);

        await memberLogService.logAction({
          memberId: editingMember.id,
          staffId: user?.id,
          staffMemberId: activeStaff?.id,
          action: 'UPDATE',
          details: { before: editingMember, after: updated },
          note: 'Cập nhật thông tin hội viên'
        });

        await staffLogService.logAction({
          staffId: user?.id,
          staffMemberId: activeStaff?.id,
          action: 'Cập nhật hội viên',
          targetItem: updated.full_name,
          details: { before: editingMember, after: updated },
          note: 'Cập nhật thông tin hội viên',
        });
      } else {
        if (payload.package_type < 1 || payload.package_type > 36) {
          setError('Goi tap tu 1 den 36 thang.');
          return;
        }
        await addMember(payload);
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
    const cat = member.membership_category || 'normal';
    setRenewForm({
      membership_category: cat,
      package_type: '1',
      fee: calculateFee(cat, '1') || '',
      payment_method: 'TM'
    });
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
      const packageType = Number(renewForm.package_type || 0);
      if (packageType < 1 || packageType > 36) {
        setError('Goi tap tu 1 den 36 thang.');
        return;
      }

      const result = await memberService.renewMember(renewingMember.id, {
        packageType,
        membershipCategory: renewForm.membership_category,
        fee: Number(renewForm.fee || 0),
        paymentMethod: renewForm.payment_method,
        staffId: activeStaff?.id || user?.id,
        shiftId: activeShift.id,
      });

      // Quan trọng: Làm mới danh sách để cập nhật ngày hết hạn mới
      await fetchMembers();

      setShowRenewModal(false);
      setRenewingMember(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const openSuspendModal = (member) => {
    const today = new Date();
    const expDate = new Date(member.end_date);
    
    // Đặt giờ về 0 để so sánh ngày chính xác
    today.setHours(0,0,0,0);
    expDate.setHours(0,0,0,0);
    
    const diffTime = expDate - today;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    if (diffDays < 13) {
      alert(`Không thể bảo lưu. Hội viên chỉ còn ${diffDays} ngày tập (yêu cầu tối thiểu 13 ngày).`);
      return;
    }

    setSuspendingMember(member);
    setSuspendInfo({ remainingDays: diffDays, endDate: member.end_date });
    setShowSuspendModal(true);
  };

  const handleSuspendConfirm = async () => {
    if (!suspendingMember) return;
    try {
      await suspendMember(suspendingMember.id, activeStaff?.id || user?.id);
      setShowSuspendModal(false);
      setSuspendingMember(null);
    } catch (err) {
      setError("Lỗi bảo lưu: " + err.message);
    }
  };

  const handleReactivate = async (member) => {
    if (!window.confirm(`Kích hoạt lại cho hội viên ${member.full_name}? Ngày hết hạn mới sẽ được cộng thêm ${member.remaining_days} ngày kể từ hôm nay.`)) return;
    try {
      await reactivateMember(member.id, activeStaff?.id || user?.id);
    } catch (err) {
      setError("Lỗi kích hoạt lại: " + err.message);
    }
  };

  return (
    <div className="modern-stack">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'active' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'active' ? 'white' : '#64748b',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Hội viên đang tập
        </button>
        <button
          className={`tab-btn ${activeTab === 'suspended' ? 'active' : ''}`}
          onClick={() => setActiveTab('suspended')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'suspended' ? '#2563eb' : '#f1f5f9',
            color: activeTab === 'suspended' ? 'white' : '#64748b',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Danh sách bảo lưu
        </button>
      </div>

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

        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ddd', minWidth: '130px' }}
          title="Lọc theo ngày đăng ký hoặc hết hạn"
        />

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
              <th>Ngày gia hạn</th>
              <th>Mã hội viên</th>
              <th>Ngày hết hạn</th>
              <th>Trạng thái</th>
              {activeTab === 'suspended' && <th>Ngày bảo lưu</th>}
              <th>Ghi chú</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty-cell">Không có dữ liệu</td>
              </tr>
            )}
            {filtered.map((m) => {
              const status = getStatus(m);
              return (
                <tr key={m.id}>
                  <td>
                    <p className="cell-main">{formatDate(m.start_date) || 'N/A'}</p>
                  </td>
                  <td>
                    <p className="cell-main">{m.member_code}</p>
                    <p className="cell-sub">{m.full_name}</p>
                  </td>
                  <td>
                    <p className="cell-main">{formatDate(m.end_date) || 'N/A'}</p>
                    <p className="cell-sub">
                      {m.membership_category ? `(${m.membership_category.toUpperCase()}) ` : ''}
                      {m.package_type ? `${m.package_type} tháng` : 'Chưa có gói'} - {Number(m.fee || 0).toLocaleString()}đ
                    </p>
                  </td>
                  <td>
                    <span className={`status-badge ${status === 'Active' ? 'active' : status === 'Suspended' ? 'suspended' : 'expired'}`}
                        style={status === 'Suspended' ? { background: '#fef3c7', color: '#92400e' } : {}}
                     >
                       {status === 'Active' ? 'Đang tập' : status === 'Suspended' ? 'Bảo lưu' : 'Hết hạn'}
                     </span>
                    {m.payment_method === 'CK' && !m.is_payment_verified && (
                      <span className="pay-badge" style={{ background: '#fef08a', color: '#854d0e', marginLeft: '4px' }}>Chờ duyệt</span>
                    )}
                  </td>
                  {activeTab === 'suspended' && (
                     <td>
                       <p className="cell-main">{formatDate(m.suspended_at)}</p>
                       <p className="cell-sub">Còn {m.remaining_days} ngày</p>
                     </td>
                   )}
                  <td style={{ maxWidth: '150px' }}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '12px',
                        color: '#64748b'
                      }}
                      title={m.note}
                    >
                      {m.note || '-'}
                    </div>
                  </td>
                  <td>
                    <div className="table-actions" style={{ gap: '8px' }}>
                      <button
                        type="button"
                        className="ghost-btn-sm"
                        onClick={() => openEditModal(m)}
                        title="Xem chi tiết & Sửa"
                        style={{ padding: '6px', color: '#2563eb' }}
                      >
                        <Eye size={18} />
                      </button>
                      {status !== 'Suspended' && (
                        <button
                          type="button"
                          className="ghost-btn-sm"
                          onClick={() => openRenewModal(m)}
                          title="Gia hạn gói tập"
                          style={{ padding: '6px', color: '#10b981' }}
                        >
                          <RefreshCcw size={18} />
                        </button>
                      )}
                      {status === 'Suspended' ? (
                         <button
                           type="button"
                           className="ghost-btn-sm"
                           onClick={() => handleReactivate(m)}
                           title="Kích hoạt lại"
                           style={{ padding: '6px', color: '#8b5cf6' }}
                         >
                           <Plus size={18} />
                         </button>
                       ) : status === 'Active' && (
                         <button
                           type="button"
                           className="ghost-btn-sm"
                           onClick={() => openSuspendModal(m)}
                           title="Bảo lưu gói tập"
                           style={{ padding: '6px', color: '#f59e0b' }}
                         >
                           <PauseCircle size={18} />
                         </button>
                       )}
                      {profile?.role === 'admin' && (
                        <button
                          type="button"
                          className="ghost-btn-sm"
                          style={{ color: '#dc2626', padding: '6px' }}
                          onClick={() => setDeletingMember(m)}
                          title="Xóa hội viên"
                        >
                          <Trash2 size={18} />
                        </button>
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
          <div className="modal-panel" style={{ width: 'min(900px, 96vw)', maxWidth: '900px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Chi tiết hội viên: {editingMember?.full_name || 'Mới'}</h3>
              <button className="ghost-btn" onClick={() => setShowModal(false)}>Đóng</button>
            </div>

            <div className="form-grid-2" style={{ gap: '24px', alignItems: 'start' }}>
              {/* Cột 1: Thông tin hội viên */}
              <div className="modern-card" style={{ padding: '20px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>Thông tin cơ bản</h4>
                <form className="modern-form" onSubmit={handleSubmit}>
                  <div className="form-grid-2">
                    <div>
                      <label className="cell-sub">Mã HV</label>
                      <input
                        value={form.member_code}
                        onChange={(e) => setForm({ ...form, member_code: e.target.value })}
                        placeholder="Mã hội viên"
                        required
                      />
                    </div>
                    <div>
                      <label className="cell-sub">Họ tên</label>
                      <input
                        value={form.full_name}
                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        placeholder="Họ tên hội viên"
                        required
                      />
                    </div>
                  </div>

                  {!editingMember && (
                    <>
                      <div style={{ marginTop: '12px' }}>
                        <label className="cell-sub">Ngày bắt đầu tập</label>
                        <input
                          type="date"
                          value={form.start_date}
                          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                          required
                        />
                      </div>
                      <div style={{ marginTop: '12px' }}>
                        <label className="cell-sub">Loại thẻ</label>
                        <select
                          value={form.membership_category}
                          onChange={(e) => handleFormChange('membership_category', e.target.value)}
                        >
                          <option value="normal">Thường</option>
                          <option value="couple">Couple</option>
                          <option value="team">Team</option>
                        </select>
                      </div>
                      <div className="form-grid-2" style={{ marginTop: '12px' }}>
                        <div>
                          <label className="cell-sub">Gói (tháng)</label>
                          <input
                            type="number"
                            value={form.package_type}
                            onChange={(e) => handleFormChange('package_type', e.target.value)}
                            placeholder="Gói (tháng)"
                            required
                          />
                        </div>
                        <div>
                          <label className="cell-sub">Học phí</label>
                          <input
                            type="number"
                            value={form.fee}
                            onChange={(e) => handleFormChange('fee', e.target.value)}
                            placeholder="Học phí"
                            required
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {!editingMember && (
                    <div>
                      <label className="cell-sub">Hình thức thanh toán</label>
                      <select
                        value={form.payment_method}
                        onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      >
                        <option value="TM">TM - Tiền mặt</option>
                        <option value="CK">CK - Chuyển khoản</option>
                      </select>
                    </div>
                  )}

                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}>
                    <input
                      type="checkbox"
                      id="fingerprint_status"
                      checked={form.fingerprint_status}
                      onChange={(e) => setForm({ ...form, fingerprint_status: e.target.checked })}
                      disabled={editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')}
                      style={{ width: '20px', height: '20px', cursor: (editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')) ? 'not-allowed' : 'pointer', accentColor: '#2563eb' }}
                    />
                    <label
                      htmlFor="fingerprint_status"
                      style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: (editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')) ? '#94a3b8' : '#334155',
                        cursor: (editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')) ? 'not-allowed' : 'pointer',
                        userSelect: 'none',
                        margin: 0
                      }}
                    >
                      {editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true')
                        ? 'Đã đăng ký vân tay (Đã thiết lập)'
                        : 'Đã đăng ký vân tay'}
                    </label>
                  </div>

                  <div style={{ marginTop: '8px' }}>
                    <label className="cell-sub">Ghi chú</label>
                    <textarea
                      rows={3}
                      value={form.note}
                      onChange={(e) => setForm({ ...form, note: e.target.value })}
                      placeholder="Ghi chú"
                    />
                  </div>

                  <div className="modal-actions" style={{ marginTop: '16px' }}>
                    <button type="submit" className="primary-btn" style={{ width: '100%' }}>
                      {editingMember ? 'Cập nhật thông tin' : 'Tạo hội viên mới'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Cột 2: Lịch sử gia hạn */}
              <div className="modern-card" style={{ padding: '20px', border: '1px solid #e2e8f0', flex: 1 }}>
                <h4 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px' }}>Lịch sử gia hạn & Hoạt động</h4>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {editingMember ? (
                    <div className="modern-table-wrap" style={{ border: 'none' }}>
                      <table className="modern-table" style={{ minWidth: '100%' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                          <tr>
                            <th>Ngày</th>
                            <th>Hành động</th>
                            <th>Chi tiết gói</th>
                            {profile?.role === 'admin' && <th>Nhân viên</th>}
                            {profile?.role === 'admin' && <th>Thanh toán</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {historyLoading ? (
                            <tr><td colSpan={profile?.role === 'admin' ? 5 : 3} className="table-empty-cell">Đang tải...</td></tr>
                          ) : historyLogs.length === 0 ? (
                            <tr><td colSpan={profile?.role === 'admin' ? 5 : 3} className="table-empty-cell">Chưa có lịch sử</td></tr>
                          ) : historyLogs.map(log => (
                            <tr key={log.id} style={{ fontSize: '12px' }}>
                              <td>{formatDate(log.created_at)}</td>
                              <td>
                                <strong style={{ color: '#0f172a' }}>
                                  {log.action === 'CREATE' && '🆕 Đăng ký'}
                                  {log.action === 'RENEW' && '⏳ Gia hạn'}
                                  {log.action === 'UPDATE' && '📝 Sửa'}
                                  {log.action === 'VERIFY_PAYMENT' && '✅ Duyệt'}
                                </strong>
                              </td>
                              <td>
                                {log.package_type && (
                                  <div>{log.package_type} th - {Number(log.fee || 0).toLocaleString()}đ</div>
                                )}
                                <div className="cell-sub">{log.note}</div>
                              </td>
                              {profile?.role === 'admin' && (
                                <td>{log.staff_members?.full_name || log.profiles?.full_name || 'Hệ thống'}</td>
                              )}
                              {profile?.role === 'admin' && (
                                <td>
                                  {log.payment_method === 'CK' && !log.is_payment_verified ? (
                                    <button
                                      className="primary-btn"
                                      style={{ background: '#f59e0b', padding: '6px 10px', fontSize: '11px' }}
                                      onClick={() => handleLogVerification(log)}
                                    >
                                      Duyệt CK
                                    </button>
                                  ) : log.payment_method === 'CK' ? (
                                    <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ Đã duyệt</span>
                                  ) : log.payment_method === 'TM' ? (
                                    <span style={{ color: '#64748b' }}>Tiền mặt</span>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="modern-info">Lịch sử sẽ hiển thị sau khi hội viên được tạo.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRenewModal && (
        <div className="modal-backdrop" onClick={() => setShowRenewModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Gia hạn hội viên: {renewingMember?.full_name}</h3>
            <form className="modern-form" onSubmit={handleRenew}>
              <div>
                <label className="cell-sub">Loại thẻ</label>
                <select
                  value={renewForm.membership_category}
                  onChange={(e) => handleRenewFormChange('membership_category', e.target.value)}
                >
                  <option value="normal">Thường</option>
                  <option value="couple">Couple</option>
                  <option value="team">Team</option>
                </select>
              </div>
              <div className="form-grid-2" style={{ marginTop: '12px' }}>
                <div>
                  <label className="cell-sub">Gói (tháng)</label>
                  <input
                    type="number"
                    value={renewForm.package_type}
                    onChange={(e) => handleRenewFormChange('package_type', e.target.value)}
                    placeholder="Gói (tháng)"
                    required
                  />
                </div>
                <div>
                  <label className="cell-sub">Học phí</label>
                  <input
                    type="number"
                    value={renewForm.fee}
                    onChange={(e) => handleRenewFormChange('fee', e.target.value)}
                    placeholder="Học phí"
                    required
                  />
                </div>
              </div>
              <div style={{ marginTop: '12px' }}>
                <label className="cell-sub">Hình thức thanh toán</label>
                <select
                  value={renewForm.payment_method}
                  onChange={(e) => setRenewForm({ ...renewForm, payment_method: e.target.value })}
                >
                  <option value="TM">TM - Tiền mặt</option>
                  <option value="CK">CK - Chuyển khoản</option>
                </select>
              </div>
              <div className="modal-actions" style={{ marginTop: '16px' }}>
                <button type="button" className="ghost-btn" onClick={() => setShowRenewModal(false)}>Hủy</button>
                <button type="submit" className="primary-btn">Xác nhận gia hạn</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal xác nhận xóa hội viên */}
      {deletingMember && (
        <div className="modal-backdrop" onClick={() => setDeletingMember(null)}>
          <div className="modal-panel" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: '#dc2626' }}>Xác nhận xóa hội viên</h3>
            <p>
              Bạn có chắc muốn xóa hội viên <strong>{deletingMember.full_name}</strong> ({deletingMember.member_code})?
              Hành động này sẽ ẩn hội viên khỏi danh sách quản lý.
            </p>
            <div className="modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setDeletingMember(null)}>Hủy</button>
              <button
                type="button"
                className="primary-btn"
                style={{ background: '#dc2626' }}
                onClick={handleConfirmDelete}
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

       {/* Modal bảo lưu */}
       {showSuspendModal && (
         <div className="modal-backdrop" onClick={() => setShowSuspendModal(false)}>
           <div className="modal-panel" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
             <h3 style={{ color: '#f59e0b' }}>Bảo lưu hội viên</h3>
             <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
               Hội viên <strong>{suspendingMember?.full_name}</strong> sẽ được tạm dừng gói tập từ hôm nay.
             </p>
             <div className="modern-info" style={{ background: '#fffbeb', border: '1px solid #fef3c7', marginBottom: '20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                 <span>Ngày hết hạn hiện tại:</span>
                 <strong>{formatDate(suspendInfo.endDate)}</strong>
               </div>
               <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <span>Số ngày còn lại:</span>
                 <strong style={{ color: '#b45309', fontSize: '18px' }}>{suspendInfo.remainingDays} ngày</strong>
               </div>
             </div>
             <p style={{ fontSize: '12px', color: '#94a3b8' }}>
               * Lưu ý: Sau khi bảo lưu, hội viên sẽ không thể check-in cho đến khi được kích hoạt lại.
             </p>
             <div className="modal-actions" style={{ marginTop: '24px' }}>
               <button type="button" className="ghost-btn" onClick={() => setShowSuspendModal(false)}>Hủy</button>
               <button
                 type="button"
                 className="primary-btn"
                 style={{ background: '#f59e0b' }}
                 onClick={handleSuspendConfirm}
               >
                 Xác nhận bảo lưu
               </button>
             </div>
           </div>
         </div>
       )}
    </div>
  );
}


