import supabase from '../config/supabase';

const TABLE_NAME = 'members';

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

export const memberService = {
  async getAllMembers() {
    const { data, error } = await supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getRecentMembers(limit = 5) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
  },

  async createMember(member) {
    const { data, error } = await supabase.from(TABLE_NAME).insert([member]).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateMember(id, updates) {
    const { data, error } = await supabase.from(TABLE_NAME).update(updates).eq('id', id).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async renewMember(member, months, fee) {
    const now = new Date();
    const currentEnd = member.end_date ? new Date(member.end_date) : null;
    const startBase = currentEnd && currentEnd > now ? currentEnd : now;

    // Calculate new end date
    const newEnd = new Date(startBase);
    newEnd.setMonth(newEnd.getMonth() + Number(months || 1));

    const updated = await this.updateMember(member.id, {
      start_date: toDateOnly(now),
      end_date: toDateOnly(newEnd),
      package_type: Number(months || 1),
      fee: Number(fee || 0),
      note: `Gia hạn ngày ${toDateOnly(now)}`,
    });

    return updated;
  },

  async deleteMember(id) {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    if (error) throw new Error(error.message);
  },
};
