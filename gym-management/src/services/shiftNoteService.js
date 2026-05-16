import supabase from '../config/supabase';

const TABLE_NAME = 'shift_notes';

export const shiftNoteService = {
  async getAllNotes() {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*, staff_members(full_name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addNote(content, staffMemberId) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([{ 
        content, 
        created_by_member: staffMemberId 
      }])
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  async updateNote(id, content) {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({ content })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteNote(id) {
    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    
    if (error) throw new Error(error.message);
    return true;
  }
};
