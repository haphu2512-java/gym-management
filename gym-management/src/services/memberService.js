import supabase from '../config/supabase';
import { addMonths, format } from 'date-fns';

const TABLE_NAME = 'members';

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
      .from(TABLE_NAME)
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRecentMembers(limit = 5) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .is('deleted_at', null)
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
      .from(TABLE_NAME)
      .select('*')
      .eq('id', data.member_id)
      .single();

    if (memberError) throw new Error('Tao thanh cong nhung tai du lieu that bai: ' + memberError.message);
    return member;
  },

  async updateMember(id, updates) {
    const { data, error } = await supabase.from(TABLE_NAME).update(updates).eq('id', id).select().single();
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
      .from(TABLE_NAME)
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

    const { data: updatedMember, error: updateError } = await supabase
      .from(TABLE_NAME)
      .update({
        end_date: newEndDate,
        package_type: packageType,
        fee,
        payment_method: paymentMethod,
        is_payment_verified: paymentMethod === 'TM',
        note: `Gia han ${packageType} thang ngay ${toDateOnly(now)}`,
      })
      .eq('id', memberId)
      .select()
      .single();

    if (updateError) throw updateError;

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

    await supabase.from('member_logs').insert([
      {
        member_id: memberId,
        staff_id: staffId,
        action: 'RENEW',
        details: {
          package_type: packageType,
          fee,
          payment_id: payment.id,
        },
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

    return { member: updatedMember, payment };
  },

  async deleteMember(id) {
    const { error } = await supabase.from(TABLE_NAME).update({ deleted_at: new Date() }).eq('id', id);
    if (error) throw new Error(error.message);
  },
};
