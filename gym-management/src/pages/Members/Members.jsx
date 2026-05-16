import { useMemo, useState, useEffect } from 'react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { memberLogService } from '../../services/memberLogService';
import supabase from '../../config/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { getLocalISODate, addMonths } from '../../utils/formatters';
import MembersToolbar from './MembersToolbar';
import MembersTable from './MembersTable';
import MemberFormModal from './MemberFormModal';
import RenewModal from './RenewModal';
import DeleteConfirmModal from './DeleteConfirmModal';
import SuspendModal from './SuspendModal';
import ServiceTab from './ServiceTab';

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
  end_date: '',
};

export default function Members() {
  const { user, profile, activeStaff } = useAuthStore();
  const { showConfirm, addToast } = useUIStore();
  const { members, loading, addMember, updateMember, fetchMembers, suspendMember, reactivateMember } = useMembers();
  const [activeTab, setActiveTab] = useState('active');
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

  // Lọc dữ liệu thành viên
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
      const getStatus = (member) => {
        if (member.suspended_at) return 'Suspended';
        const today = new Date();
        const target = new Date(member.end_date);
        return target >= new Date(today.toDateString()) ? 'Active' : 'Expired';
      };
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

  // Xử lý xác nhận thanh toán từ lịch sử
  const handleLogVerification = async (log) => {
    showConfirm({
      title: 'Xác nhận chuyển khoản',
      message: `Xác nhận đã nhận đủ ${Number(log.fee || 0).toLocaleString()}đ chuyển khoản cho lần gia hạn này?`,
      onConfirm: async () => {
        try {
          await memberService.verifyLogPayment(log.id, user?.id, activeStaff?.id);

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
            staffId: user?.id,
            staffMemberId: activeStaff?.id,
            action: 'Duyệt thanh toán CK',
            targetItem: `Gia hạn ID: ${log.id}`,
            details: { log_id: log.id, member_id: log.member_id },
            note: 'Admin duyệt thanh toán từ bảng lịch sử chi tiết',
          });
          
          addToast("Đã duyệt thanh toán thành công!");
        } catch (err) {
          setError("Lỗi duyệt thanh toán: " + err.message);
          addToast("Lỗi duyệt thanh toán", "error");
        }
      }
    });
  };

  // Xử lý xóa hội viên
  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    try {
      const effectiveStaffId = activeStaff?.id || user?.id;
      await memberService.deleteMember(deletingMember.id);

      await staffLogService.logAction({
        staffId: user?.id,
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

  // Mở modal tạo hội viên mới
  const openCreateModal = () => {
    setEditingMember(null);
    setForm(initialForm);
    setError('');
    setShowModal(true);
  };

  // Mở modal chỉnh sửa hội viên
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
      end_date: member.end_date ? new Date(member.end_date).toISOString().slice(0, 10) : '',
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

  // Xử lý thay đổi form
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

  // Xử lý thay đổi form gia hạn
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

  // Submit form tạo/chỉnh sửa hội viên
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
          end_date: form.end_date,
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
          setError('Gói tập từ 1 đến 36 tháng.');
          return;
        }
        await addMember(payload);
        
        await staffLogService.logAction({
          staffId: user?.id,
          staffMemberId: activeStaff?.id,
          action: 'Thêm hội viên mới',
          targetItem: payload.full_name,
          details: { member_code: payload.member_code, package: payload.package_type },
          note: 'Admin/Staff tạo hội viên mới',
        });
      }

      setShowModal(false);
      setForm(initialForm);
      setEditingMember(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Mở modal gia hạn
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

  // Submit gia hạn
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

      await memberService.renewMember(renewingMember.id, {
        packageType,
        membershipCategory: renewForm.membership_category,
        fee: Number(renewForm.fee || 0),
        paymentMethod: renewForm.payment_method,
        staffId: activeStaff?.id || user?.id,
        shiftId: activeShift.id,
      });

      await staffLogService.logAction({
        staffId: user?.id,
        staffMemberId: activeStaff?.id,
        action: 'Gia hạn hội viên',
        targetItem: renewingMember.full_name,
        details: { 
          member_id: renewingMember.id, 
          package: packageType, 
          fee: Number(renewForm.fee || 0) 
        },
        note: 'Admin/Staff thực hiện gia hạn học phí',
      });

      // Làm mới danh sách để cập nhật ngày hết hạn mới
      await fetchMembers();

      setShowRenewModal(false);
      setRenewingMember(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Mở modal bảo lưu
  const openSuspendModal = (member) => {
    const today = new Date();
    const expDate = new Date(member.end_date);
    
    today.setHours(0,0,0,0);
    expDate.setHours(0,0,0,0);
    
    const diffTime = expDate - today;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    if (diffDays < 13) {
      addToast(`Không thể bảo lưu. Hội viên chỉ còn ${diffDays} ngày tập (yêu cầu tối thiểu 13 ngày).`, "error");
      return;
    }

    setSuspendingMember(member);
    setSuspendInfo({ remainingDays: diffDays, endDate: member.end_date });
    setShowSuspendModal(true);
  };

  // Xác nhận bảo lưu
  const handleSuspendConfirm = async () => {
    if (!suspendingMember) return;
    setError('');

    if (!activeShift?.id) {
      setError("Vui lòng mở ca trước khi thực hiện bảo lưu.");
      return;
    }

    try {
      await suspendMember(suspendingMember.id, activeStaff?.id || user?.id, activeShift.id);
      
      await staffLogService.logAction({
        staffId: user?.id,
        staffMemberId: activeStaff?.id,
        action: 'Bảo lưu hội viên',
        targetItem: suspendingMember.full_name,
        details: { member_id: suspendingMember.id },
        note: 'Admin/Staff thực hiện bảo lưu (tạm dừng)',
      });

      setShowSuspendModal(false);
      setSuspendingMember(null);
      addToast("Đã bảo lưu hội viên thành công!");
    } catch (err) {
      setError("Lỗi bảo lưu: " + err.message);
    }
  };

  // Kích hoạt lại hội viên
  const handleReactivate = async (member) => {
    if (!activeShift?.id) {
      addToast("Vui lòng mở ca trước khi kích hoạt lại hội viên.", "error");
      return;
    }

    showConfirm({
      title: 'Kích hoạt lại hội viên',
      message: `Kích hoạt lại cho hội viên ${member.full_name}? Ngày hết hạn mới sẽ được cộng thêm ${member.remaining_days} ngày kể từ hôm nay.`,
      onConfirm: async () => {
        try {
          await reactivateMember(member.id, activeStaff?.id || user?.id, activeShift.id);
          
          await staffLogService.logAction({
            staffId: user?.id,
            staffMemberId: activeStaff?.id,
            action: 'Kích hoạt lại hội viên',
            targetItem: member.full_name,
            details: { member_id: member.id },
            note: 'Admin/Staff kích hoạt lại từ trạng thái bảo lưu',
          });

          addToast("Đã kích hoạt lại hội viên thành công!");
        } catch (err) {
          setError("Lỗi kích hoạt lại: " + err.message);
          addToast("Lỗi kích hoạt lại", "error");
        }
      }
    });
  };


  return (
    <div className="modern-stack">
      <MembersToolbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterDate={filterDate}
        setFilterDate={setFilterDate}
        onAddMember={openCreateModal}
        profile={profile}
      />

      {error && <div className="modern-error">{error}</div>}

      {activeTab === 'services' ? (
        <ServiceTab />
      ) : (
        <MembersTable
          members={members}
          loading={loading}
          filtered={filtered}
          activeTab={activeTab}
          profile={profile}
          onEditMember={openEditModal}
          onRenewMember={openRenewModal}
          onSuspendMember={openSuspendModal}
          onReactivateMember={handleReactivate}
          onDeleteMember={setDeletingMember}
        />
      )}

      {showModal && (
        <MemberFormModal
          editingMember={editingMember}
          form={form}
          onFormChange={handleFormChange}
          onSubmit={handleSubmit}
          onCancel={() => setShowModal(false)}
          historyLogs={historyLogs}
          historyLoading={historyLoading}
          profile={profile}
          onLogVerification={handleLogVerification}
        />
      )}

      {showRenewModal && (
        <RenewModal
          member={renewingMember}
          renewForm={renewForm}
          onFormChange={handleRenewFormChange}
          onSubmit={handleRenew}
          onCancel={() => setShowRenewModal(false)}
        />
      )}

      {deletingMember && (
        <DeleteConfirmModal
          member={deletingMember}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingMember(null)}
        />
      )}

      {showSuspendModal && (
        <SuspendModal
          member={suspendingMember}
          suspendInfo={suspendInfo}
          onConfirm={handleSuspendConfirm}
          onCancel={() => setShowSuspendModal(false)}
        />
      )}
    </div>
  );
}


