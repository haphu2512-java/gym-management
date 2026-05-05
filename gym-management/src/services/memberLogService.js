import supabase from '../config/supabase';

const TABLE_NAME = 'member_logs';

export const memberLogService = {
  async createLog({ memberId, action, changedBy, beforeData = null, afterData = null, note = '' }) {
    const payload = {
      member_id: memberId,
      action,
      changed_by: changedBy,
      before_data: beforeData,
      after_data: afterData,
      note,
      changed_at: new Date().toISOString(),
    };

    const { error } = await supabase.from(TABLE_NAME).insert([payload]);
    if (error) throw new Error(error.message);
  },

  async getLogs() {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('changed_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },
};

