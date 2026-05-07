import supabase from '../config/supabase';

const TABLE_NAME = 'member_logs';

export const memberLogService = {
  async logAction({ memberId, staffId, action, details = {}, note = '' }) {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .insert([{
          member_id: memberId,
          staff_id: staffId,
          action,
          details,
          note
        }]);
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to log member action:', error);
      // We don't throw here to avoid blocking the main operation if logging fails
    }
  },

  async getLogsByMember(memberId) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select(`
        *,
        profiles (full_name)
      `)
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};
