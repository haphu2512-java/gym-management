import { useMemo, useState, useEffect } from 'react';
import { AlertTriangle, CheckCheck } from 'lucide-react';
import { useMembers } from '../../hooks/useMembers';
import { memberService } from '../../services/memberService';
import { paymentService } from '../../services/paymentService';
import { staffLogService } from '../../services/staffLogService';
import { shiftService } from '../../services/shiftService';
import { memberLogService } from '../../services/memberLogService';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { getLocalISODate, addMonths } from '../../utils/formatters';
import { exportMembersToExcel } from '../../utils/excelExport';
import { getMemberStatus } from '../../utils/memberStatus';
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

const getInitialForm = () => ({
  member_code: '',
  full_name: '',
  membership_category: 'normal',
  package_type: '1',
  fee: '350000',
  payment_method: 'TM',
  fingerprint_status: false,
  note: '',
  start_date: getLocalISODate(),
  end_date: '',
});

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
  const [form, setForm] = useState(getInitialForm);
  const [submitting, setSubmitting] = useState(false);
  // Sinh khi mở modal (không phải khi bấm Lưu) để bấm lại sau lỗi mạng không tạo trùng giao dịch
  const [idempotencyKey, setIdempotencyKey] = useState(null);

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewingMember, setRenewingMember] = useState(null);
  const [renewForm, setRenewForm] = useState({ membership_category: 'normal', package_type: '1', fee: '350000', payment_method: 'TM', renew_from: 'today' });

  const [activeShift, setActiveShift] = useState(null);

  const [historyLogs, setHistoryLogs] = useState([]);
  const [deletingMember, setDeletingMember] = useState(null);
  const [deleteShiftPayments, setDeleteShiftPayments] = useState([]);
  const [deletePaymentsLoading, setDeletePaymentsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [suspendingMember, setSuspendingMember] = useState(null);
  const [suspendInfo, setSuspendInfo] = useState({ remainingDays: 0, endDate: '' });
  const [verifyingAll, setVerifyingAll] = useState(false);

  const pendingCkCount = useMemo(() => {
    return members.filter((m) => m.payment_method === 'CK' && !m.is_payment_verified).length;
  }, [members]);

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
        const actDate = (m.last_active_at || m.created_at || '').split('T')[0];
        matchDate = (expDate === filterDate) || (actDate === filterDate);
      }

      let matchStatus;
      const status = getMemberStatus(m);
      
      if (activeTab === 'suspended') {
        matchStatus = status === 'Suspended';
      } else {
        matchStatus = status !== 'Suspended';
      }

      if (filterStatus === 'pending_ck' && matchStatus) {
        matchStatus = m.payment_method === 'CK' && !m.is_payment_verified;
      }

      if (filterStatus === 'missing_code' && matchStatus) {
        matchStatus = !m.member_code;
      }

      if (filterStatus === 'expired' && matchStatus) {
        matchStatus = status === 'Expired';
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
          await memberService.verifyLogPayment(log.id, activeStaff?.id);

          setHistoryLogs(prevLogs =>
            prevLogs.map(l => l.id === log.id ? { ...l, is_payment_verified: true } : l)
          );

          await fetchMembers();

          if (editingMember && editingMember.id === log.member_id) {
            const freshMember = await memberService.getMember(log.member_id);
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

  // Duyệt chuyển khoản cho tất cả hội viên đang chờ
  const handleVerifyAllPendingCk = async () => {
    if (pendingCkCount === 0) {
      addToast('Hiện không có chuyển khoản nào chờ duyệt.', 'info');
      return;
    }

    showConfirm({
      title: 'Duyệt chuyển khoản tất cả',
      message: `Bạn có chắc chắn muốn duyệt chuyển khoản cho tất cả ${pendingCkCount} hội viên đang chờ duyệt không?`,
      confirmText: 'Duyệt tất cả',
      onConfirm: async () => {
        setVerifyingAll(true);
        setError('');
        try {
          const result = await memberService.verifyAllPendingPayments(activeStaff?.id);

          await staffLogService.logAction({
            staffId: user?.id,
            staffMemberId: activeStaff?.id,
            action: 'Duyệt tất cả thanh toán CK',
            targetItem: `Duyệt ${result.count || pendingCkCount} giao dịch CK`,
            details: { count: result.count, totalPending: pendingCkCount },
            note: 'Admin duyệt chuyển khoản hàng loạt cho tất cả hội viên',
          });

          await fetchMembers();
          addToast(`Đã duyệt chuyển khoản thành công cho tất cả (${result.count || pendingCkCount} giao dịch)!`, 'success');
        } catch (err) {
          setError('Lỗi duyệt chuyển khoản: ' + err.message);
          addToast('Lỗi duyệt chuyển khoản: ' + err.message, 'error');
        } finally {
          setVerifyingAll(false);
        }
      }
    });
  };

  // Mở modal xóa, tải các khoản thu của hội viên trong ca đang mở (để xóa do nhập nhầm)
  const openDeleteModal = async (member) => {
    setDeletingMember(member);
    setDeleteShiftPayments([]);
    if (!activeShift?.id) return;
    setDeletePaymentsLoading(true);
    try {
      setDeleteShiftPayments(await paymentService.getMemberPaymentsInShift(member.id, activeShift.id));
    } catch (err) {
      console.error('Lỗi tải khoản thu trong ca:', err);
    } finally {
      setDeletePaymentsLoading(false);
    }
  };

  // Xử lý xóa hội viên.
  // Nhập nhầm: server hoàn đúng các khoản đã thu trong ca đang mở.
  // Lý do khác: khoản thu cũ giữ nguyên; nếu hoàn tiền thì ghi vào ca đang mở.
  const handleConfirmDelete = async ({ voidCurrentShift = false, voidTotal = 0, refundAmount = 0, refundMethod = 'TM', note = '' } = {}) => {
    if (!deletingMember) return;
    if ((voidCurrentShift || refundAmount > 0) && !activeShift?.id) {
      setError('Vui lòng mở ca trước khi xóa hội viên có hoàn tiền.');
      return;
    }
    try {
      await memberService.deleteMember(deletingMember.id, {
        shiftId: activeShift?.id,
        staffId: activeStaff?.id,
        refundAmount,
        refundMethod,
        note,
        voidCurrentShift,
      });

      await fetchMembers();
      setDeletingMember(null);
      if (voidCurrentShift) {
        addToast(`Đã xóa hội viên nhập nhầm và hủy ${Number(voidTotal).toLocaleString()}đ trong ca`);
      } else {
        addToast(refundAmount > 0 ? `Đã xóa hội viên và ghi hoàn tiền ${Number(refundAmount).toLocaleString()}đ` : 'Đã xóa hội viên');
      }
    } catch (err) {
      setDeletingMember(null);
      setError("Lỗi xóa hội viên: " + err.message);
    }
  };

  // Đổi TM <-> CK cho một lượt đăng ký/gia hạn trong ca đang mở
  const handleChangePaymentMethod = (log) => {
    const newMethod = log.payment_method === 'CK' ? 'TM' : 'CK';
    showConfirm({
      title: 'Đổi hình thức thanh toán',
      message: `Đổi khoản ${Number(log.fee || 0).toLocaleString()}đ từ ${log.payment_method === 'CK' ? 'chuyển khoản' : 'tiền mặt'} sang ${newMethod === 'CK' ? 'chuyển khoản' : 'tiền mặt'}?`
        + (newMethod === 'CK' ? ' Tiền mặt trong ca sẽ giảm tương ứng và khoản này chờ Admin duyệt CK.' : ' Tiền mặt trong ca sẽ tăng tương ứng.'),
      onConfirm: async () => {
        try {
          await memberService.changePaymentMethod(log.id, newMethod, activeStaff?.id);
          setHistoryLogs(prevLogs =>
            prevLogs.map(l => l.id === log.id ? { ...l, payment_method: newMethod, is_payment_verified: newMethod === 'TM' } : l)
          );
          await fetchMembers();
          addToast(`Đã đổi sang ${newMethod === 'CK' ? 'chuyển khoản' : 'tiền mặt'}`);
        } catch (err) {
          addToast('Lỗi đổi hình thức thanh toán: ' + err.message, 'error');
        }
      }
    });
  };

  // Mở modal tạo hội viên mới
  const openCreateModal = () => {
    setEditingMember(null);
    setForm(getInitialForm());
    setIdempotencyKey(crypto.randomUUID());
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
    if (submitting) return;
    setError('');

    if (!activeShift?.id) {
      setError("Vui lòng mở ca trước khi thêm hội viên mới.");
      return;
    }

    setSubmitting(true);
    try {
      const startDate = form.start_date || getLocalISODate();
      const startObj = new Date(startDate);
      const endDate = getLocalISODate(addMonths(startObj, Number(form.package_type || 1)));

      const payload = {
        member_code: form.member_code?.trim() || null,
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
        staff_id: activeStaff?.id,
        idempotencyKey,
      };

      if (editingMember?.id) {
        const updatePayload = {
          member_code: form.member_code?.trim() || null,
          full_name: form.full_name,
          fingerprint_status: form.fingerprint_status,
          note: form.note,
          end_date: form.end_date,
        };
        const updated = await updateMember(editingMember.id, updatePayload);

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
          setSubmitting(false);
          return;
        }
        await addMember(payload);
      }

      setShowModal(false);
      setForm(getInitialForm());
      setEditingMember(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
      payment_method: 'TM',
      renew_from: 'today',
      custom_renew_date: member.end_date ? new Date(member.end_date).toISOString().slice(0, 10) : getLocalISODate(),
      note: ''
    });
    setIdempotencyKey(crypto.randomUUID());
    setError('');
    setShowRenewModal(true);
  };

  // Submit gia hạn
  const handleRenew = async (e) => {
    e.preventDefault();
    if (!renewingMember) return;
    if (submitting) return;
    setError('');

    if (!activeShift?.id) {
      setError("Vui lòng mở ca trước khi gia hạn hội viên.");
      return;
    }

    setSubmitting(true);
    try {
      const packageType = Number(renewForm.package_type || 0);
      if (packageType < 1 || packageType > 36) {
        setError('Gói tập từ 1 đến 36 tháng.');
        setSubmitting(false);
        return;
      }

      await memberService.renewMember(renewingMember.id, {
        packageType,
        membershipCategory: renewForm.membership_category,
        fee: Number(renewForm.fee || 0),
        paymentMethod: renewForm.payment_method,
        staffId: activeStaff?.id,
        shiftId: activeShift.id,
        renewFrom: renewForm.renew_from,
        customRenewDate: renewForm.custom_renew_date,
        note: renewForm.note,
        idempotencyKey,
      });

      // Làm mới danh sách để cập nhật ngày hết hạn mới
      await fetchMembers();

      setShowRenewModal(false);
      setRenewingMember(null);
      addToast("Gia hạn thành công!");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
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
    if (submitting) return;
    setError('');

    if (!activeShift?.id) {
      setError("Vui lòng mở ca trước khi thực hiện bảo lưu.");
      return;
    }

    setSubmitting(true);
    try {
      await suspendMember(suspendingMember.id, activeStaff?.id, activeShift.id);


      setShowSuspendModal(false);
      setSuspendingMember(null);
      addToast("Đã bảo lưu hội viên thành công!");
    } catch (err) {
      setError("Lỗi bảo lưu: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Kích hoạt lại hội viên
  const handleReactivate = async (member) => {
    if (!activeShift?.id) {
      addToast("Vui lòng mở ca trước khi kích hoạt lại hội viên.", "error");
      return;
    }
    if (submitting) return;

    showConfirm({
      title: 'Kích hoạt lại hội viên',
      message: `Kích hoạt lại cho hội viên ${member.full_name}? Ngày hết hạn mới sẽ được cộng thêm ${member.remaining_days} ngày kể từ hôm nay.`,
      onConfirm: async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
          await reactivateMember(member.id, activeStaff?.id, activeShift.id);


          addToast("Đã kích hoạt lại hội viên thành công!");
        } catch (err) {
          setError("Lỗi kích hoạt lại: " + err.message);
          addToast("Lỗi kích hoạt lại", "error");
        } finally {
          setSubmitting(false);
        }
      }
    });
  };


  // Xuất danh sách hội viên ra Excel (Admin only)
  const handleExportExcel = () => {
    exportMembersToExcel(filtered);
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
        onExportExcel={handleExportExcel}
        profile={profile}
        pendingCkCount={pendingCkCount}
        onVerifyAllPendingCk={handleVerifyAllPendingCk}
        verifyingAll={verifyingAll}
      />

      {profile?.role === 'admin' && pendingCkCount > 0 && activeTab !== 'services' && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--warn-soft)',
          border: '1px solid var(--warn-soft)',
          borderRadius: 'var(--radius)',
          color: 'var(--warn-ink)',
          fontSize: '13px',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>
              Có <strong>{pendingCkCount}</strong> hội viên thanh toán chuyển khoản đang <strong>chờ duyệt</strong>.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {filterStatus !== 'pending_ck' && (
              <button
                type="button"
                onClick={() => setFilterStatus('pending_ck')}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--warn)',
                  color: 'var(--warn-ink)',
                  borderRadius: 'var(--radius)',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Lọc danh sách chờ duyệt
              </button>
            )}
            <button
              type="button"
              onClick={handleVerifyAllPendingCk}
              disabled={verifyingAll}
              style={{
                background: 'var(--ok)',
                border: 'none',
                color: 'white',
                borderRadius: 'var(--radius)',
                padding: '5px 14px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: verifyingAll ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <CheckCheck size={15} />
              {verifyingAll ? 'Đang duyệt...' : 'Duyệt chuyển khoản tất cả'}
            </button>
          </div>
        </div>
      )}

      {error && <div className="modern-error">{error}</div>}

      {activeTab === 'services' ? (
        <ServiceTab />
      ) : (
        <MembersTable
          loading={loading}
          filtered={filtered}
          activeTab={activeTab}
          profile={profile}
          onEditMember={openEditModal}
          onRenewMember={openRenewModal}
          onSuspendMember={openSuspendModal}
          onReactivateMember={handleReactivate}
          onDeleteMember={openDeleteModal}
          activeShiftStart={activeShift?.start_time || null}
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
          onChangePaymentMethod={handleChangePaymentMethod}
          activeShiftStart={activeShift?.start_time || null}
          submitting={submitting}
        />
      )}

      {showRenewModal && (
        <RenewModal
          member={renewingMember}
          renewForm={renewForm}
          onFormChange={handleRenewFormChange}
          onSubmit={handleRenew}
          onCancel={() => setShowRenewModal(false)}
          submitting={submitting}
        />
      )}

      {deletingMember && (
        <DeleteConfirmModal
          member={deletingMember}
          hasActiveShift={Boolean(activeShift?.id)}
          shiftPayments={deleteShiftPayments}
          paymentsLoading={deletePaymentsLoading}
          isAdmin={profile?.role === 'admin'}
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
          submitting={submitting}
        />
      )}
    </div>
  );
}


