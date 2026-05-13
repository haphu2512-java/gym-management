import supabase from '../config/supabase';

const TABLE_NAME = 'member_logs';

export const memberLogService = {
  async logAction({ memberId, staffId, staffMemberId, action, details = {}, note = '', created_at = null }) {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([{
          member_id: memberId,
          staff_id: staffId,
          staff_member_id: staffMemberId,
          action,
          details,
          note,
          created_at: created_at || new Date().toISOString()
        }]);
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to log member action:', error);
    }
  },

  async getLogsByMember(memberId) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        profiles (full_name),
        staff_members (full_name)
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};
