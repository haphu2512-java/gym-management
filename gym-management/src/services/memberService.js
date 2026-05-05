import supabase from '../config/supabase';

const TABLE_NAME = 'members';

export const memberService = {
  async getAllMembers() {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async createMember(member) {
    try {
      const { data, error } = await supabase.from(TABLE_NAME).insert([member]).select().single();
      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async updateMember(id, updates) {
    try {
      const { data, error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      throw new Error(error.message);
    }
  },

  async deleteMember(id) {
    try {
      const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      throw new Error(error.message);
    }
  },
};
