import supabase from '../config/supabase';

const SHIFT_TABLE = 'shifts';

const DEFAULT_SHIFTS = ['Ca 1 (5h-9h)', 'Ca 2 (9h-13h)', 'Ca 3 (13h-17h)', 'Ca 4 (17h-21h)', 'Ca 5 (21h-23h)'];

function formatDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export const shiftService = {
  shiftOptions: DEFAULT_SHIFTS,

  async getLatestShifts(limit = 20) {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .select('*')
      .order('start_time', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getTodayShifts() {
    const dayKey = formatDateKey();
    const start = `${dayKey}T00:00:00.000Z`;
    const end = `${dayKey}T23:59:59.999Z`;

    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .select('*')
      .gte('start_time', start)
      .lte('start_time', end)
      .order('start_time', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async validateShiftForLogin() {
    const shifts = await this.getTodayShifts();
    const active = shifts.find((item) => item.status === 'open');
    return { valid: Boolean(active), shift: active || null };
  },

  async openShift({ shiftName, startingCash = 0, note = '' }) {
    const payload = {
      shift_name: shiftName,
      start_time: new Date().toISOString(),
      starting_cash: Number(startingCash || 0),
      status: 'open',
      note,
    };

    const { data, error } = await supabase.from(SHIFT_TABLE).insert([payload]).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async closeShift({ shiftId, endingCash = 0, note = '' }) {
    const { data, error } = await supabase
      .from(SHIFT_TABLE)
      .update({
        ending_cash: Number(endingCash || 0),
        end_time: new Date().toISOString(),
        status: 'closed',
        note,
      })
      .eq('id', shiftId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },
};
