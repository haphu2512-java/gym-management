import { useMemo, useState, useEffect } from 'react';
import { CreditCard, Plus, Search } from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { memberLogService } from '../../services/memberLogService';
import supabase from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { formatDate, getLocalISODate, addMonths } from '../../utils/formatters';

function getStatus(endDate) {
  const today = new Date();
  const target = new Date(endDate);
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
  const { user, profile } = useAuthStore();
  const { members, loading, addMember, updateMember, fetchMembers } = useMembers();
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
  const [historyLoading, setHistoryLoading] = useState(false);

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
      if (filterStatus === 'pending_ck') {
        matchStatus = m.payment_method === 'CK' && !m.is_payment_verified;
      }
      
      return matchSearch && matchDate && matchStatus;
    });
  }, [members, searchTerm, filterStatus, filterDate]);

  const handleLogVerification = async (log) => {
    if (!window.confirm(`Xác nhận đã nhận đủ ${Number(log.fee || 0).toLocaleString()}đ chuyển khoản cho lần gia hạn này?`)) return;
    
    try {
      await memberService.verifyLogPayment(log.id, user.id);
      
      // 1. Cập nhật ngay lập tức state History Logs để UI thay đổi nút -> dấu tích
      setHistoryLogs(prevLogs => 
        prevLogs.map(l => l.id === log.id ? { ...l, is_payment_verified: true } : l)
      );

      // 2. Làm mới danh sách hội viên tổng quát
      await fetchMembers();
      
      // 3. Nếu đang xem đúng hội viên này, cập nhật lại editingMember để đồng bộ thông tin
      if (editingMember && editingMember.id === log.member_id) {
        const { data: freshMember } = await supabase
          .from('member_current_status')
          .select('*')
          .eq('id', log.member_id)
          .single();
        if (freshMember) setEditingMember(freshMember);
      }

      // Ghi log hoạt động của Admin
      await staffLogService.logAction({
        staffId: user?.id,
        action: 'Duyệt thanh toán CK',
        targetItem: `Gia hạn ID: ${log.id}`,
        details: { log_id: log.id, member_id: log.member_id },
        note: 'Admin duyệt thanh toán từ bảng lịch sử chi tiết',
      });
    } catch (err) {
      setError("Lỗi duyệt thanh toán: " + err.message);
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
        staff_id: user?.id,
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
          action: 'UPDATE',
          details: { before: editingMember, after: updated },
          note: 'Cập nhật thông tin hội viên'
        });

        await staffLogService.logAction({
          staffId: user?.id,
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
        staffId: user?.id,
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
              <th>Mã hội viên</th>
              <th>Ngày hết hạn</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="table-empty-cell">Không có dữ liệu</td>
              </tr>
            )}
            {filtered.map((m) => {
              const status = getStatus(m.end_date);
              return (
                <tr key={m.id}>
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
                    <span className={`status-badge ${status === 'Active' ? 'active' : 'expired'}`}>
                      {status === 'Active' ? 'Đang tập' : 'Hết hạn'}
                    </span>
                    {m.payment_method === 'CK' && !m.is_payment_verified && (
                      <span className="pay-badge" style={{ background: '#fef08a', color: '#854d0e', marginLeft: '4px' }}>Chờ duyệt</span>
                    )}
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

                  {editingMember && (editingMember.fingerprint_status === true || editingMember.fingerprint_status === 'true') ? (
                    <div style={{ marginTop: '8px' }}>
                      <label className="check-row" style={{ color: '#64748b', cursor: 'not-allowed' }}>
                        <input
                          type="checkbox"
                          checked={form.fingerprint_status}
                          disabled
                        />
                        Đã đăng ký vân tay (Đã thiết lập)
                      </label>
                    </div>
                  ) : (
                    <label className="check-row" style={{ marginTop: '8px' }}>
                      <input
                        type="checkbox"
                        checked={form.fingerprint_status}
                        onChange={(e) => setForm({ ...form, fingerprint_status: e.target.checked })}
                      />
                      Đã đăng ký vân tay
                    </label>
                  )}
                  
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
                                <td>{log.profiles?.full_name || 'Hệ thống'}</td>
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
    </div>
  );
}


