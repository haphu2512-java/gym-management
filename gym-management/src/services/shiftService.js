import supabase from '../config/supabase';

const SHIFT_TABLE = 'shifts';

function isCurrentTimeInRange(startAt, endAt) {
  const now = new Date().getTime();
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : Number.MAX_SAFE_INTEGER;
  return now >= start && now <= end;
}

export const shiftService = {
  async getAllShifts() {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .select('*')
      .order('start_time', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async validateShiftForLogin() {
    const shifts = await this.getAllShifts();
    const active = shifts.find((s) => s.status === 'open' && isCurrentTimeInRange(s.start_time, s.end_time));
    return {
      valid: Boolean(active),
      shift: active || null,
    };
  },

  async createShift(payload) {
    const { data, error } = await supabase.from(SHIFT_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async openShift({ shiftId, startingCash = 0, note = '' }) {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .update({
        status: 'open',
        starting_cash: startingCash,
        note,
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async closeShift({ shiftId, endingCash = 0, note = '' }) {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .update({
        status: 'closed',
        ending_cash: endingCash,
        end_time: new Date().toISOString(),
        note,
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
};
