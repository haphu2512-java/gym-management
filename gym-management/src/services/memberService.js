import supabase from '../config/supabase';
import { addMonths, format } from 'date-fns';

const TABLE_NAME = 'members';
const VIEW_NAME = 'member_current_status';

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export async function validateMemberDates(startDate, packageType) {
  const parsedPackage = Number(packageType || 0);
  const start = new Date(startDate);
  const end = addMonths(start, parsedPackage);

  if (end < new Date()) {
    throw new Error(`Ngay ket thuc (${format(end, 'dd/MM/yyyy')}) khong duoc o qua khu`);
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
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRecentMembers(limit = 5) {
    const { data, error } = await supabase
      .from(VIEW_NAME)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createMember(memberData) {
    const packageType = Number(memberData.package_type || 1);
    await validateMemberDates(memberData.start_date || new Date(), packageType);

    const { data, error } = await supabase.rpc('create_member_transaction', {
      p_code: memberData.member_code,
      p_name: memberData.full_name,
      p_package_type: packageType,
      p_fee: Number(memberData.fee || 0),
      p_payment_method: memberData.payment_method,
      p_shift_id: memberData.shift_id,
      p_staff_id: memberData.staff_id,
    });

    if (error) throw new Error('Tao hoi vien that bai: ' + error.message);
    if (!data?.success || !data?.member_id) throw new Error(data?.error || 'Tao hoi vien that bai');

    const { data: member, error: memberError } = await supabase
      .from(VIEW_NAME)
      .select('*')
      .eq('id', data.member_id)
      .single();

    if (memberError) throw new Error('Tao thanh cong nhung tai du lieu that bai: ' + memberError.message);
    return member;
  },

  async updateMember(id, updates) {
    // Separate member fields and log fields
    const memberFields = ['full_name', 'member_code', 'fingerprint_status', 'note', 'deleted_at'];
    const logFields = ['package_type', 'start_date', 'end_date', 'fee', 'payment_method', 'is_payment_verified'];

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

    // If any log fields changed, create an UPDATE log entry
    if (Object.keys(logUpdates).length > 0) {
      // Get current values to fill the gaps in the log
      const { data: current } = await supabase.from(VIEW_NAME).select('*').eq('id', id).single();

      await supabase.from('member_logs').insert([{
        member_id: id,
        action: 'UPDATE',
        package_type: logUpdates.package_type ?? current.package_type,
        start_date: logUpdates.start_date ?? current.start_date,
        end_date: logUpdates.end_date ?? current.end_date,
        fee: logUpdates.fee ?? current.fee,
        payment_method: logUpdates.payment_method ?? current.payment_method,
        is_payment_verified: logUpdates.is_payment_verified ?? current.is_payment_verified,
        details: { updates: logUpdates },
        note: 'Cập nhật trạng thái hội viên'
      }]);
    }

    const { data, error } = await supabase.from(VIEW_NAME).select().eq('id', id).single();
    if (error) throw new Error(error.message);
    return data;
  },

  async renewMember(memberId, renewalData) {
    const packageType = Number(renewalData.packageType || 1);
    const fee = Number(renewalData.fee || 0);
    const paymentMethod = renewalData.paymentMethod || 'TM';
    const staffId = renewalData.staffId || null;
    const shiftId = renewalData.shiftId || null;

    const { data: member, error: memberError } = await supabase
      .from(VIEW_NAME)
      .select('*')
      .eq('id', memberId)
      .single();

    if (memberError) throw new Error(memberError.message);
    if (!member) throw new Error('Khong tim thay hoi vien');

    const now = new Date();
    const currentEnd = member.end_date ? new Date(member.end_date) : null;
    const renewalStart = currentEnd && currentEnd > now ? currentEnd : now;
    const newEndDate = addMonths(renewalStart, packageType);

    await validateMemberDates(renewalStart, packageType);

    // 1. Create payment log
    const { data: payment, error: paymentError } = await supabase
      .from('payment_logs')
      .insert([
        {
          member_id: memberId,
          shift_id: shiftId,
          staff_id: staffId,
          amount: fee,
          payment_method: paymentMethod,
          payment_type: 'renew',
          is_verified: paymentMethod === 'TM',
          verified_by: paymentMethod === 'TM' ? staffId : null,
          verified_at: paymentMethod === 'TM' ? new Date().toISOString() : null,
        },
      ])
      .select()
      .single();

    if (paymentError) throw paymentError;

    // 2. Create renewal log (This now holds the state)
    await supabase.from('member_logs').insert([
      {
        member_id: memberId,
        staff_id: staffId,
        action: 'RENEW',
        package_type: packageType,
        start_date: toDateOnly(renewalStart),
        end_date: toDateOnly(newEndDate),
        fee,
        payment_method: paymentMethod,
        is_payment_verified: paymentMethod === 'TM',
        details: {
          payment_id: payment.id,
        },
        note: `Gia han ${packageType} thang ngay ${toDateOnly(now)}`,
      },
    ]);

    await supabase.from('staff_logs').insert([
      {
        staff_id: staffId,
        action: 'Gia han hoi vien',
        target_item: `${member.member_code} - ${member.full_name}`,
        details: {
          member_id: memberId,
          fee,
          payment_id: payment.id,
        },
      },
    ]);

    // 3. Fetch the updated state from view
    const { data: updatedMember } = await supabase
      .from(VIEW_NAME)
      .select('*')
      .eq('id', memberId)
      .single();

    return { member: updatedMember, payment };
  },

  async verifyLogPayment(logId, staffId) {
    // 1. Lấy thông tin log để tìm payment_id liên quan
    const { data: log, error: logError } = await supabase
      .from('member_logs')
      .select('*')
      .eq('id', logId)
      .single();
    
    if (logError) throw new Error('Không tìm thấy bản ghi log: ' + logError.message);

    // 2. Cập nhật bảng member_logs
    const { error: updateLogError } = await supabase
      .from('member_logs')
      .update({ 
        is_payment_verified: true,
        note: (log.note || '') + ' (Admin đã duyệt)'
      })
      .eq('id', logId);
    
    if (updateLogError) throw new Error('Cập nhật log thất bại: ' + updateLogError.message);

    // 3. Cập nhật bảng payment_logs nếu có payment_id
    const paymentId = log.details?.payment_id;
    if (paymentId) {
      const { error: payError } = await supabase
        .from('payment_logs')
        .update({
          is_verified: true,
          verified_by: staffId,
          verified_at: new Date().toISOString()
        })
        .eq('id', paymentId);
      if (payError) console.error('Cập nhật payment_log thất bại:', payError);
    }

    return true;
  },

  async deleteMember(id) {
    const { error } = await supabase.from(TABLE_NAME).update({ deleted_at: new Date() }).eq('id', id);
    if (error) throw new Error(error.message);
  },
};
