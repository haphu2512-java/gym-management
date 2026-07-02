import supabase from '../config/supabase';
import { addMonths, getLocalISODate } from '../utils/formatters';

const TABLE_NAME = 'members';
const VIEW_NAME = 'member_current_status';

function toDateOnly(date) {
  return getLocalISODate(date);
}

export async function validateMemberDates(startDate, packageType, allowPastEnd = false) {
  const parsedPackage = Number(packageType || 0);
  const start = new Date(startDate);
  const end = addMonths(start, parsedPackage);

  if (!allowPastEnd && end < new Date()) {
    const day = String(end.getDate()).padStart(2, '0');
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const year = end.getFullYear();
    throw new Error(`Ngay ket thuc (${day}-${month}-${year}) khong duoc o qua khu`);
  }

  if (parsedPackage > 36) {
    throw new Error('Goi tap toi da 36 thang');
  }

  if (parsedPackage < 1) {
    throw new Error('Goi tap toi thieu 1 thang');
  }

  return true;
}

export const memberService = {
  async getAllMembers() {
    const { data, error } = await supabase
      .from(VIEW_NAME)
      .select('*')
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRecentMembers(limit = 5, filters = {}) {
    let query = supabase
      .from(VIEW_NAME)
      .select('*')
      .order('last_active_at', { ascending: false, nullsFirst: false });

    if (filters.date) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('last_active_at', startOfDay.toISOString())
        .lte('last_active_at', endOfDay.toISOString());
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRecentTransactions(limit = 20, filters = {}) {
    let query = supabase
      .from('member_logs')
      .select(`
        *,
        members (
          full_name,
          member_code,
          note
        )
      `)
      .in('action', ['CREATE', 'RENEW'])
      .order('created_at', { ascending: false });

    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      query = query.gte('created_at', start.toISOString());
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    if (filters.date && !filters.startDate && !filters.endDate) {
      const startOfDay = new Date(filters.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(filters.date);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data || []).map(log => ({
      ...log,
      full_name: log.members?.full_name,
      member_code: log.members?.member_code,
      note: log.members?.note || log.note,
      last_active_at: log.created_at,
    }));
  },
  async createMember(memberData) {
    const packageType = Number(memberData.package_type || 1);
    await validateMemberDates(memberData.start_date || new Date(), packageType);

    const { data, error } = await supabase.rpc('create_member_transaction', {
      p_code: memberData.member_code,
      p_name: memberData.full_name,
      p_package_type: packageType,
      p_membership_category: memberData.membership_category || 'normal',
      p_fee: Number(memberData.fee || 0),
      p_payment_method: memberData.payment_method,
      p_shift_id: memberData.shift_id,
      p_staff_id: memberData.staff_id,
      p_fingerprint_status: Boolean(memberData.fingerprint_status),
      p_note: memberData.note || '',
      p_start_date: memberData.start_date || getLocalISODate(),
      p_created_at: new Date().toISOString(),
      p_idempotency_key: memberData.idempotencyKey || null
    });

    if (error) {
      if (error.message.includes('unique constraint') || error.message.includes('already exists')) {
        throw new Error('Mã hội viên đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.');
      }
      throw new Error('Tạo hội viên thất bại: ' + error.message);
    }

    if (data?.success === false) {
      const errorMsg = data?.error || '';
      if (errorMsg.includes('unique constraint') || errorMsg.includes('already exists') || errorMsg.includes('duplicate key')) {
        throw new Error('Mã hội viên đã tồn tại trên hệ thống. Vui lòng kiểm tra lại.');
      }
      throw new Error(data?.error || 'Tạo hội viên thất bại');
    }

    return data;
  },

  async updateMember(id, updates) {
    // Separate member fields and log fields
    const memberFields = ['full_name', 'member_code', 'fingerprint_status', 'note', 'deleted_at'];
    const logFields = ['package_type', 'membership_category', 'start_date', 'end_date', 'fee', 'payment_method', 'is_payment_verified'];

    const memberUpdates = {};
    const logUpdates = {};

    Object.keys(updates).forEach(key => {
      if (memberFields.includes(key)) memberUpdates[key] = updates[key];
      if (logFields.includes(key)) logUpdates[key] = updates[key];
    });

    // Update members table if needed
    if (Object.keys(memberUpdates).length > 0) {
      const { error } = await supabase.from(TABLE_NAME).update(memberUpdates).eq('id', id);
      if (error) throw new Error(error.message);
    }

    // If any log fields changed, create an UPDATE log entry if values differ
    if (Object.keys(logUpdates).length > 0) {
      // Get current values to fill the gaps in the log
      const { data: current } = await supabase.from(VIEW_NAME).select('*').eq('id', id).single();

      const changedLogUpdates = {};
      Object.keys(logUpdates).forEach(key => {
        const currentVal = current[key];
        const newVal = logUpdates[key];
        // Check difference, convert both to string to avoid type mismatches (e.g. 1 vs "1")
        if (currentVal !== newVal && String(currentVal || '') !== String(newVal || '')) {
          changedLogUpdates[key] = newVal;
        }
      });

      if (Object.keys(changedLogUpdates).length > 0) {
        const { error: logError } = await supabase.from('member_logs').insert([{
          member_id: id,
          action: 'UPDATE',
          package_type: logUpdates.package_type ?? current.package_type,
          membership_category: logUpdates.membership_category ?? current.membership_category,
          start_date: logUpdates.start_date ?? current.start_date,
          end_date: logUpdates.end_date ?? current.end_date,
          fee: logUpdates.fee ?? current.fee,
          payment_method: logUpdates.payment_method ?? current.payment_method,
          is_payment_verified: logUpdates.is_payment_verified ?? current.is_payment_verified,
          details: { updates: changedLogUpdates },
          note: 'Cập nhật trạng thái hội viên',
          created_at: new Date().toISOString()
        }]);

        if (logError) throw new Error('Lỗi lưu log cập nhật hội viên: ' + logError.message);
      }
    }

    const { data, error } = await supabase.from(VIEW_NAME).select().eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async renewMember(memberId, renewalData) {
    const packageType = Number(renewalData.packageType || 1);
    const membershipCategory = renewalData.membershipCategory || 'normal';
    const fee = Number(renewalData.fee || 0);
    const paymentMethod = renewalData.paymentMethod || 'TM';
    const staffId = renewalData.staffId || null;
    const shiftId = renewalData.shiftId || null;
    const renewFrom = renewalData.renewFrom || 'today';
    const customRenewDate = renewalData.customRenewDate || null;
    const note = renewalData.note || '';
    const idempotencyKey = renewalData.idempotencyKey || null;

    const { data: member, error: memberError } = await supabase
      .from(VIEW_NAME)
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error('Khong tim thay hoi vien');

    const todayStr = getLocalISODate();
    const currentEnd = member.end_date;
    const isExpired = !currentEnd || currentEnd < todayStr;

    let renewalStart;
    if (isExpired) {
      if (renewFrom === 'expired') {
        renewalStart = customRenewDate || currentEnd || todayStr;
      } else {
        renewalStart = todayStr;
      }
    } else {
      renewalStart = currentEnd;
    }

    const allowPastEnd = renewFrom === 'expired';
    await validateMemberDates(renewalStart, packageType, allowPastEnd);

    const createdAt = new Date().toISOString();

    const { data: result, error: rpcError } = await supabase.rpc('renew_member_transaction', {
      p_member_id: memberId,
      p_package_type: packageType,
      p_membership_category: membershipCategory,
      p_fee: fee,
      p_payment_method: paymentMethod,
      p_shift_id: shiftId,
      p_staff_id: staffId,
      p_start_date: renewalStart,
      p_created_at: createdAt,
      p_idempotency_key: idempotencyKey
    });

    if (rpcError) throw new Error('Gia hạn thất bại: ' + rpcError.message);
    if (result?.success === false) {
      throw new Error(result.error || 'Gia hạn thất bại');
    }

    // Lưu ghi chú nếu có
    if (note && result.payment_id) {
      try {
        await Promise.all([
          supabase.from('payment_logs').update({ note }).eq('id', result.payment_id),
          supabase.from('members').update({ note }).eq('id', memberId),
          supabase.from('member_logs').update({ note }).eq('member_id', memberId).eq('action', 'RENEW').eq('created_at', createdAt)
        ]);
      } catch (err) {
        console.error("Lỗi lưu ghi chú gia hạn:", err);
      }
    }

    return { member: result.member || result, payment: { id: result.payment_id } };
  },

  async verifyLogPayment(logId, staffId, staffMemberId = null) {
    const { data: log, error: logError } = await supabase
      .from('member_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (logError) throw new Error('Không tìm thấy bản ghi log: ' + logError.message);

    const paymentId = log.details?.payment_id;
    if (!paymentId) {
      throw new Error('Không tìm thấy payment liên quan để xác thực.');
    }

    const { data, error } = await supabase.rpc('verify_payment_atomic', {
      p_payment_id: paymentId,
      p_admin_id: staffId,
      p_staff_member_id: staffMemberId,
      p_verified_at: new Date().toISOString()
    });

    if (error) throw new Error('Xác thực thanh toán thất bại: ' + error.message);
    if (data?.success === false) {
      throw new Error(data.error || 'Xác thực thanh toán thất bại');
    }

    return true;
  },

  async deleteMember(id) {
    const { data: member } = await supabase.from(TABLE_NAME).select('member_code, created_at').eq('id', id).single();
    if (member) {
      const now = new Date();
      const created = new Date(member.created_at);
      const isWithinOneWeek = (now - created) <= 7 * 24 * 60 * 60 * 1000;

      const newCode = `${member.member_code}_del_${Date.now()}`;
      const { error } = await supabase
        .from(TABLE_NAME)
        .update({
          deleted_at: now.toISOString(),
          member_code: newCode
        })
        .eq('id', id);
      if (error) throw new Error(error.message);

      if (isWithinOneWeek) {
        const { error: paymentError } = await supabase
          .from('payment_logs')
          .update({ amount: 0 })
          .eq('member_id', id);
        if (paymentError) throw new Error(paymentError.message);

        const { error: logError } = await supabase
          .from('member_logs')
          .update({ fee: 0 })
          .eq('member_id', id);
        if (logError) throw new Error(logError.message);
      }
    }
  },

  async suspendMember(id, staffId, shiftId) {
    const { data, error } = await supabase.rpc('suspend_member', {
      p_member_id: id,
      p_staff_id: staffId,
      p_shift_id: shiftId
    });

    if (error) throw new Error('Bảo lưu thất bại: ' + error.message);
    if (data?.success === false) throw new Error(data.error || 'Bảo lưu thất bại');
    return data;
  },

  async reactivateMember(id, staffId, shiftId) {
    const { data, error } = await supabase.rpc('reactivate_member', {
      p_member_id: id,
      p_staff_id: staffId,
      p_shift_id: shiftId
    });

    if (error) throw new Error('Kích hoạt lại thất bại: ' + error.message);
    return data;
  },

  async revertRenewTransaction(logId, adminId) {
    const { data, error } = await supabase.rpc('revert_renew_transaction', {
      p_log_id: logId,
      p_admin_id: adminId
    });

    if (error) throw new Error('Hoàn tác gia hạn thất bại: ' + error.message);
    if (data?.success === false) {
      throw new Error(data.error || 'Hoàn tác gia hạn thất bại');
    }
    return data;
  }
};